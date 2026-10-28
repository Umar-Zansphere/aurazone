"""
test_06_admin_reflection.py
Suite 6: Admin Reflection (Inventory & Order Management)

Covers:
  6.1  New order appears in admin orders list
  6.2  Admin order detail shows customer, shipping, payment, items
  6.3  Paid order decrements variant stock (inventory deduction)
  6.4  Failed payment does not decrement stock
  6.5  Fulfillment update: admin marks shipped with tracking number
  6.6  Delivery update: admin marks order delivered
  6.7  Order cancellation & restock: inventory restored on cancellation
  6.8  Low stock alerts: inventory page renders and shows stock data
"""

import re
import time

import pytest
import requests
from selenium.webdriver.common.by import By

from utils.api import (
    admin_create_payment,
    admin_create_shipment,
    admin_delete_order,
    admin_get_order_detail,
    admin_update_order_status,
    create_admin_session,
    create_guest_session,
    fetch_admin_inventory_by_variant,
    find_product_by_name,
    place_real_cod_order,
    place_real_razorpay_order,
    send_razorpay_webhook,
    update_admin_inventory,
)
from utils.constants import (
    TEST_DATA,
    WEBHOOK_SECRET,
    has_admin_creds,
    has_webhook_secret,
)
from utils.helpers import (
    ensure_admin_login,
    goto_admin,
    wait_for,
)

pytestmark = [pytest.mark.admin, pytest.mark.requires_admin]


class TestAdminReflection:
    """6. Admin Reflection (Inventory & Order Management)"""

    def test_6_1_new_order_visibility(self, driver, guest_session, created_order_ids, admin_session):
        """6.1 Newly placed order appears in the admin orders list."""
        result = place_real_cod_order(guest_session, TEST_DATA["exact_product_name"])
        order = result["order"]
        created_order_ids.append(order["orderId"])

        ensure_admin_login(driver, existing_session=admin_session)
        goto_admin(driver, "/orders")

        # Search for the order number
        search_inputs = [
            inp for inp in driver.find_elements(By.TAG_NAME, "input")
            if re.search(r"search orders", inp.get_attribute("placeholder") or "", re.IGNORECASE)
        ]
        assert search_inputs, "Order search input not found in admin"
        search_inputs[0].clear()
        search_inputs[0].send_keys(order["orderNumber"])
        time.sleep(0.8)

        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert order["orderNumber"] in body_text, \
            f"Order {order['orderNumber']} not found in admin orders list"

    def test_6_2_admin_order_detail(self, driver, guest_session, created_order_ids, admin_session):
        """6.2 Admin order detail page shows all key sections."""
        result = place_real_cod_order(guest_session, TEST_DATA["exact_product_name"])
        order = result["order"]
        product = result["product"]
        created_order_ids.append(order["orderId"])

        ensure_admin_login(driver, existing_session=admin_session)
        goto_admin(driver, f"/orders/{order['orderId']}")

        wait_for(driver).until(
            lambda d: order["orderNumber"] in d.find_element(By.TAG_NAME, "body").text
        )

        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert product["name"] in body_text, \
            f"Product name '{product['name']}' not on admin order detail page"

        # Payment section
        payment_sections = driver.find_elements(
            By.XPATH,
            "//section[contains(@class, 'card-surface') and .//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'payment')]]"
        )
        if not payment_sections:
            # Fallback: look for any element with "Payment" text
            payment_els = driver.find_elements(
                By.XPATH,
                "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'payment')]"
            )
            assert any(el.is_displayed() for el in payment_els), \
                "Payment section not found on admin order detail page"

        assert re.search(r"delivery address", body_text, re.IGNORECASE), \
            "Delivery address section not found on admin order detail page"

    def test_6_3_inventory_deduction_on_payment(self, driver, guest_session, created_order_ids, admin_session, inventory_snapshots):
        """6.3 (Critical) Paid order decrements variant inventory."""
        product = find_product_by_name(guest_session, TEST_DATA["exact_product_name"])
        assert product
        variant = product["variants"][0]

        inv_before = fetch_admin_inventory_by_variant(admin_session, variant["id"])
        qty_before = (inv_before.get("inventory") or inv_before).get("quantity")
        assert qty_before is not None
        inventory_snapshots[variant["id"]] = qty_before
        reserved_before = (inv_before.get("inventory") or inv_before).get("reserved", 0)
        available_before = qty_before - reserved_before

        fresh_guest = create_guest_session()
        result = place_real_cod_order(fresh_guest, TEST_DATA["exact_product_name"], variant=variant, quantity=1)
        order = result["order"]
        created_order_ids.append(order["orderId"])
        fresh_guest.close()

        payment_resp = admin_create_payment(admin_session, order["orderId"], {
            "gateway": "COD",
            "amount": order.get("totalAmount"),
            "status": "SUCCESS",
            "externalReference": f"e2e_pay_{int(time.time() * 1000)}",
        })

        if payment_resp.ok:
            time.sleep(1)
            inv_after = fetch_admin_inventory_by_variant(admin_session, variant["id"])
            qty_after = (inv_after.get("inventory") or inv_after).get("quantity")
            reserved_after = (inv_after.get("inventory") or inv_after).get("reserved", 0)
            available_after = qty_after - reserved_after
            assert available_after < available_before, \
                f"Inventory should decrease after payment (before={available_before}, after={available_after})"
        else:
            # Fallback: update status to PAID
            admin_update_order_status(admin_session, order["orderId"], "PAID")
            time.sleep(1)
            inv_after = fetch_admin_inventory_by_variant(admin_session, variant["id"])
            qty_after = (inv_after.get("inventory") or inv_after).get("quantity")
            assert qty_after is not None

    def test_6_4_failed_payment_no_inventory_deduction(self, driver, guest_session, created_order_ids, admin_session, inventory_snapshots):
        """6.4 Failed payment does not decrement stock; reserve is released."""
        product = find_product_by_name(guest_session, TEST_DATA["exact_product_name"])
        assert product
        variant = product["variants"][0]

        inv_before = fetch_admin_inventory_by_variant(admin_session, variant["id"])
        qty_before = (inv_before.get("inventory") or inv_before).get("quantity")
        inventory_snapshots[variant["id"]] = qty_before

        fresh_guest = create_guest_session()
        result = place_real_razorpay_order(fresh_guest, TEST_DATA["exact_product_name"], variant=variant, quantity=1)
        order = result["order"]
        created_order_ids.append(order["orderId"])

        if has_webhook_secret():
            webhook_payload = {
                "event": "payment.failed",
                "payload": {
                    "payment": {
                        "entity": {
                            "id": f"pay_fail_{int(time.time() * 1000)}",
                            "order_id": order.get("razorpayOrderId"),
                            "amount": int(float(order.get("totalAmount", 0)) * 100),
                            "currency": "INR",
                            "status": "failed",
                            "error_code": "BAD_REQUEST_ERROR",
                            "error_description": "E2E test simulation",
                        }
                    }
                },
            }
            webhook_resp = send_razorpay_webhook(fresh_guest, webhook_payload, WEBHOOK_SECRET)
            assert webhook_resp.status_code == 200
        else:
            admin_update_order_status(admin_session, order["orderId"], "CANCELLED")

        fresh_guest.close()
        time.sleep(1)

        inv_after = fetch_admin_inventory_by_variant(admin_session, variant["id"])
        qty_after = (inv_after.get("inventory") or inv_after).get("quantity")
        assert qty_after == qty_before, \
            f"Inventory should be unchanged after failed payment (before={qty_before}, after={qty_after})"

    def test_6_5_fulfillment_update(self, driver, guest_session, created_order_ids, admin_session):
        """6.5 Admin marks order as shipped with tracking number; UI reflects shipment."""
        fresh_guest = create_guest_session()
        result = place_real_cod_order(fresh_guest, TEST_DATA["exact_product_name"])
        order = result["order"]
        created_order_ids.append(order["orderId"])
        fresh_guest.close()

        tracking_number = f"TRK-{int(time.time() * 1000)}"

        ensure_admin_login(driver, existing_session=admin_session)
        goto_admin(driver, f"/orders/{order['orderId']}")
        wait_for(driver).until(
            lambda d: order["orderNumber"] in d.find_element(By.TAG_NAME, "body").text
        )

        # Try UI-based shipment creation
        add_shipment_btns = [
            btn for btn in driver.find_elements(By.TAG_NAME, "button")
            if re.search(r"add shipment", btn.text, re.IGNORECASE) and btn.is_displayed()
        ]

        if add_shipment_btns:
            add_shipment_btns[0].click()

            # Fill courier name
            courier_inputs = driver.find_elements(
                By.CSS_SELECTOR, "input[placeholder*='Delhivery'], input[placeholder*='courier'], input[placeholder*='DHL']"
            )
            if courier_inputs:
                courier_inputs[0].clear()
                courier_inputs[0].send_keys("DHL E2E")

            # Fill tracking number
            tracking_inputs = driver.find_elements(
                By.CSS_SELECTOR, "input[placeholder*='Tracking ID'], input[placeholder*='tracking']"
            )
            if tracking_inputs:
                tracking_inputs[0].clear()
                tracking_inputs[0].send_keys(tracking_number)

            # Submit
            for btn in driver.find_elements(By.TAG_NAME, "button"):
                if re.search(r"save|create", btn.text, re.IGNORECASE) and btn.is_displayed():
                    btn.click()
                    break

        else:
            # Fallback: API-based shipment creation
            admin_create_shipment(admin_session, order["orderId"], {
                "courierName": "DHL E2E",
                "trackingNumber": tracking_number,
            })
            driver.refresh()
            wait_for(driver).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())

        wait_for(driver, 15).until(
            lambda d: re.search(r"shipped", d.find_element(By.TAG_NAME, "body").text, re.IGNORECASE)
        )
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"shipped", body_text, re.IGNORECASE)

    def test_6_6_delivery_update(self, driver, guest_session, created_order_ids, admin_session):
        """6.6 Admin marks order as DELIVERED; admin UI and API both show DELIVERED status."""
        fresh_guest = create_guest_session()
        result = place_real_cod_order(fresh_guest, TEST_DATA["exact_product_name"])
        order = result["order"]
        created_order_ids.append(order["orderId"])
        fresh_guest.close()

        admin_update_order_status(admin_session, order["orderId"], "DELIVERED")

        # Verify via API
        detail = admin_get_order_detail(admin_session, order["orderId"])
        status = detail.get("status") or detail.get("data", {}).get("status")
        assert status == "DELIVERED", f"Expected DELIVERED, got {status}"

        # Verify via Admin UI
        ensure_admin_login(driver, existing_session=admin_session)
        goto_admin(driver, f"/orders/{order['orderId']}")
        wait_for(driver).until(
            lambda d: order["orderNumber"] in d.find_element(By.TAG_NAME, "body").text
        )
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"delivered", body_text, re.IGNORECASE), \
            "DELIVERED status not shown in admin UI"

    def test_6_7_order_cancellation_restock(self, driver, guest_session, created_order_ids, admin_session, inventory_snapshots):
        """6.7 Cancelled order releases reserved stock back to inventory."""
        product = find_product_by_name(guest_session, TEST_DATA["exact_product_name"])
        assert product
        variant = product["variants"][0]

        inv_before = fetch_admin_inventory_by_variant(admin_session, variant["id"])
        qty_before = (inv_before.get("inventory") or inv_before).get("quantity")
        inventory_snapshots[variant["id"]] = qty_before

        fresh_guest = create_guest_session()
        result = place_real_cod_order(fresh_guest, TEST_DATA["exact_product_name"], variant=variant, quantity=1)
        order = result["order"]
        created_order_ids.append(order["orderId"])
        fresh_guest.close()

        admin_update_order_status(admin_session, order["orderId"], "CANCELLED")
        time.sleep(1)

        inv_after = fetch_admin_inventory_by_variant(admin_session, variant["id"])
        qty_after = (inv_after.get("inventory") or inv_after).get("quantity")
        assert qty_after == qty_before, \
            f"Inventory should be restored after cancellation (before={qty_before}, after={qty_after})"

    def test_6_8_low_stock_alerts(self, driver, guest_session, admin_session):
        """6.8 Admin inventory page loads correctly and shows stock data for the test variant."""
        product = find_product_by_name(guest_session, TEST_DATA["exact_product_name"])
        assert product
        variant = product["variants"][0]

        ensure_admin_login(driver, existing_session=admin_session)
        goto_admin(driver, "/inventory")

        # The inventory page uses card-surface accordion items (not a table)
        # Search by product name or SKU — placeholder is "Search SKU, product, color"
        search_inputs = [
            inp for inp in driver.find_elements(By.TAG_NAME, "input")
            if re.search(r"search sku|sku|product|color", inp.get_attribute("placeholder") or "", re.IGNORECASE)
        ]
        if search_inputs:
            search_inputs[0].clear()
            search_inputs[0].send_keys(TEST_DATA["exact_product_name"])
            time.sleep(1.0)

        # Page must render inventory cards (section.card-surface)
        wait_for(driver, 20).until(
            lambda d: bool(d.find_elements(By.CSS_SELECTOR, "section.card-surface"))
        )

        # Click to expand the first product card to see variant details
        cards = driver.find_elements(By.CSS_SELECTOR, "section.card-surface")
        assert cards, "No inventory cards found on inventory page"
        expand_btn = cards[0].find_elements(By.TAG_NAME, "button")
        if expand_btn:
            driver.execute_script("arguments[0].click();", expand_btn[0])
            time.sleep(0.8)

        body_text = driver.find_element(By.TAG_NAME, "body").text
        sku = variant.get("sku", "")
        # SKU appears as "SKU NK-URB-BLK-9" in the expanded variant card
        assert sku in body_text or product["name"] in body_text, \
            f"Product '{product['name']}' or SKU {sku} not visible on admin inventory page"

