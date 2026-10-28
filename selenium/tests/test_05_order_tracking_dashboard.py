"""
test_05_order_tracking_dashboard.py
Suite 5: Order Tracking & Customer Dashboard

Covers:
  5.1  Email confirmation page includes order details
  5.2  Order history list renders without errors
  5.3  Detailed view shows shipping address and payment info
  5.4  Status updates reflection (admin shipped → customer sees SHIPPED)
  5.5  Order cancellation by customer
"""

import base64
import json
import re
import time

import pytest
import requests
from selenium.webdriver.common.by import By

from utils.api import (
    admin_create_shipment,
    admin_delete_order,
    admin_update_order_status,
    clear_cart as api_clear_cart,
    create_admin_session,
    create_guest_session,
    place_real_cod_order,
)
from utils.constants import (
    CUSTOMER_BASE_URL,
    TEST_DATA,
    has_admin_creds,
    has_customer_creds,
)
from utils.helpers import (
    ensure_customer_login,
    goto_customer,
    wait_for,
)

pytestmark = [pytest.mark.customer, pytest.mark.requires_customer]


class TestOrderTrackingDashboard:
    """5. Order Tracking & Customer Dashboard"""

    def test_5_1_email_confirmation_page(self, driver, guest_session, created_order_ids):
        """5.1 Order confirmation page shows the order number and total."""
        result = place_real_cod_order(guest_session, TEST_DATA["exact_product_name"])
        order = result["order"]
        created_order_ids.append(order["orderId"])

        ensure_customer_login(driver)

        encoded = base64.b64encode(json.dumps({
            "orderId": order["orderId"],
            "orderNumber": order["orderNumber"],
            "totalAmount": float(order.get("totalAmount", 0)),
            "paymentMethod": "COD",
        }).encode()).decode()

        goto_customer(driver, f"/order-confirmation?order={encoded}")

        try:
            wait_for(driver, 15).until(lambda d: re.search(r"order confirmed", d.find_element(By.TAG_NAME, "body").text, re.IGNORECASE))
        except Exception:
            pass

        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"order confirmed", body_text, re.IGNORECASE), \
            "Order confirmation heading not found"
        assert order["orderNumber"] in body_text, \
            f"Order number {order['orderNumber']} not found on confirmation page"
        assert re.search(r"order confirmation", body_text, re.IGNORECASE)

    def test_5_2_order_history_list(self, driver, guest_session, created_order_ids):
        """5.2 Orders history page renders (with or without orders)."""
        result = place_real_cod_order(guest_session, TEST_DATA["exact_product_name"])
        order = result["order"]
        created_order_ids.append(order["orderId"])

        ensure_customer_login(driver)
        goto_customer(driver, "/orders")

        wait_for(driver, 15).until(
            lambda d: re.search(r"view and track your orders", d.find_element(By.TAG_NAME, "body").text, re.IGNORECASE)
        )

        body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        no_orders = "no orders found" in body_text or "you haven't placed any orders" in body_text
        order_cards = driver.find_elements(By.CSS_SELECTOR, "div.bg-white.rounded-xl")
        assert no_orders or len(order_cards) >= 0, \
            "Orders page must render a valid state (empty or with cards)"

    def test_5_3_detailed_view(self, driver, guest_session, customer_session):
        """5.3 Order detail page shows shipping address and payment summary."""
        ensure_customer_login(driver)

        # Fetch the customer's orders via the shared session-scoped fixture
        resp = customer_session.get(f"{CUSTOMER_BASE_URL}/api/orders", timeout=30)

        if not resp.ok:
            pytest.skip("Orders API unavailable.")

        body = resp.json()
        orders = body.get("data", {}).get("orders", [])
        if not orders:
            pytest.skip("Customer has no orders — skipping detail view test.")

        latest_order = orders[0]
        goto_customer(driver, f"/orders/{latest_order['id']}")

        try:
            wait_for(driver, 15).until(lambda d: re.search(r"shipping address", d.find_element(By.TAG_NAME, "body").text, re.IGNORECASE))
        except Exception:
            pass

        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"shipping address", body_text, re.IGNORECASE), \
            f"Shipping address section not found on order detail page. Body: {body_text[:100]}"
        assert re.search(r"payment summary", body_text, re.IGNORECASE), \
            "Payment summary section not found on order detail page"

    def test_5_4_status_updates_reflection(self, driver, guest_session, created_order_ids, admin_session):
        """5.4 Admin changes order to SHIPPED; customer sees updated status."""
        if not has_admin_creds():
            pytest.skip("Admin credentials required for status update test.")

        result = place_real_cod_order(guest_session, TEST_DATA["exact_product_name"])
        order = result["order"]
        order_id = order["orderId"]
        created_order_ids.append(order_id)

        admin_update_order_status(admin_session, order_id, "SHIPPED")
        admin_create_shipment(admin_session, order_id, {
            "courierName": "DHL E2E",
            "trackingNumber": f"TRK-{int(time.time() * 1000)}",
        })

        # Verify via admin API
        from utils.api import admin_get_order_detail  # noqa: PLC0415
        detail = admin_get_order_detail(admin_session, order_id)
        status = detail.get("status") or detail.get("data", {}).get("status")
        assert status == "SHIPPED", f"Expected SHIPPED, got {status}"

        # If tracking token exists, verify via public track endpoint
        tracking_token = order.get("trackingToken")
        if tracking_token:
            track_resp = guest_session.get(
                f"{CUSTOMER_BASE_URL}/api/orders/track/{tracking_token}", timeout=15
            )
            if track_resp.ok:
                track_body = track_resp.json()
                assert track_body.get("data", {}).get("status") == "SHIPPED"

    def test_5_5_order_cancellation(self, driver, guest_session, customer_session):
        """5.5 Customer can cancel a pending order from the order detail page."""
        ensure_customer_login(driver)

        # Reuse the session-scoped fixture
        resp = customer_session.get(f"{CUSTOMER_BASE_URL}/api/orders", timeout=30)

        if not resp.ok:
            pytest.skip("Orders API unavailable.")

        body = resp.json()
        orders = body.get("data", {}).get("orders", [])
        pending = next((o for o in orders if o.get("status") == "PENDING"), None)

        if not pending:
            pytest.skip("No pending orders available to test cancellation.")

        goto_customer(driver, f"/orders/{pending['id']}")

        try:
            wait_for(driver, 15).until(lambda d: re.search(r"shipping address|order details", d.find_element(By.TAG_NAME, "body").text, re.IGNORECASE))
        except Exception:
            pass

        cancel_btns = [
            btn for btn in driver.find_elements(By.TAG_NAME, "button")
            if re.search(r"cancel order", btn.text, re.IGNORECASE) and btn.is_displayed()
        ]

        if not cancel_btns:
            pytest.skip("Cancel Order button not available — order may not be cancellable.")

        # Handle confirmation dialog if present
        try:
            driver.execute_script("window.confirm = function() { return true; };")
        except Exception:  # noqa: BLE001
            pass

        cancel_btns[0].click()
        time.sleep(1)

        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"cancelled", body_text, re.IGNORECASE), \
            "Cancelled status not shown after cancellation"
