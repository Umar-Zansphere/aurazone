"""
test_04_payment_flow.py
Suite 4: Payment Flow

Covers:
  4.1  COD order placement → confirmation page
  4.2  Razorpay success flow → confirmation page
  4.3  Razorpay dismiss (modal close) → stays on checkout
  4.4  Razorpay decline (invalid signature) → error shown
"""

import re
import time

import pytest
import requests
from selenium.webdriver.common.by import By

from utils.api import (
    add_to_cart,
    clear_cart as api_clear_cart,
    find_product_by_name,
)
from utils.constants import CUSTOMER_BASE_URL, TEST_DATA
from utils.helpers import (
    add_current_product_to_cart,
    fill_guest_address,
    goto_cart,
    goto_checkout,
    goto_customer,
    goto_products_page,
    inject_razorpay_mock,
    open_product_by_name,
    wait_for,
    wait_for_toast,
    wait_for_url_contains,
    wait_for_url_matches,
)

pytestmark = pytest.mark.customer


def _sync_guest_cookie(driver, guest_session: requests.Session) -> None:
    """Inject the guestSessionId cookie from requests.Session into the Selenium driver."""
    guest_cookie = guest_session.cookies.get("guestSessionId")
    if not guest_cookie:
        return
    # Navigate to customer domain so the cookie can be set
    driver.get(CUSTOMER_BASE_URL)
    wait_for(driver, 15).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())
    try:
        driver.add_cookie({"name": "guestSessionId", "value": guest_cookie, "path": "/"})
    except Exception:  # noqa: BLE001
        pass


def _ensure_guest_checkout_cart(driver, guest_session: requests.Session, product_name: str = TEST_DATA["exact_product_name"]) -> None:
    api_clear_cart(guest_session)
    _sync_guest_cookie(driver, guest_session)
    goto_products_page(driver)
    product = find_product_by_name(guest_session, product_name)
    assert product
    open_product_by_name(driver, product["name"])
    add_current_product_to_cart(driver)
    goto_cart(driver)
    wait_for(driver, 30).until(
        lambda d: any(
            el.is_displayed() for el in d.find_elements(
                By.XPATH,
                "//*[@aria-label[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'quantity selector')]]"
            )
        )
    )


class TestPaymentFlow:
    """4. Payment Flow"""

    def test_4_1_cod_order_placement(self, driver, guest_session):
        """4.1 Guest places a COD order and sees the order confirmation page."""
        _ensure_guest_checkout_cart(driver, guest_session)
        goto_checkout(driver)

        wait_for(driver).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())
        fill_guest_address(driver)

        # Select COD payment if selector is present
        cod_selectors = driver.find_elements(
            By.CSS_SELECTOR, "input[value='COD'], [data-payment='COD']"
        )
        if cod_selectors and cod_selectors[0].is_displayed():
            driver.execute_script("arguments[0].click();", cod_selectors[0])

        place_order_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"place order", btn.text, re.IGNORECASE):
                place_order_btn = btn
                break
        assert place_order_btn
        place_order_btn.click()

        wait_for_url_contains(driver, "/order-confirmation", timeout=30)
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"order confirmed", body_text, re.IGNORECASE), \
            "Order confirmation heading not found"

    def test_4_2_razorpay_success_flow(self, driver, guest_session):
        """4.2 Razorpay mock success → payment completes → order confirmed."""
        inject_razorpay_mock(driver, "success")

        _ensure_guest_checkout_cart(driver, guest_session)

        # Mock the payment verification endpoint via JS fetch override
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
            var _origFetch = window.fetch;
            window.fetch = function(url, opts) {
                if (typeof url === 'string' && url.includes('/api/orders/payment/verify')) {
                    return Promise.resolve(new Response(JSON.stringify({success: true}), {
                        status: 200, headers: {'Content-Type': 'application/json'}
                    }));
                }
                return _origFetch.apply(this, arguments);
            };
            """
        })

        goto_checkout(driver)
        wait_for(driver).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())
        fill_guest_address(driver)

        razorpay_selectors = driver.find_elements(
            By.CSS_SELECTOR, "input[value='RAZORPAY'], [data-payment='RAZORPAY']"
        )
        if razorpay_selectors and razorpay_selectors[0].is_displayed():
            driver.execute_script("arguments[0].click();", razorpay_selectors[0])

        place_order_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"place order", btn.text, re.IGNORECASE):
                place_order_btn = btn
                break
        assert place_order_btn
        place_order_btn.click()

        wait_for_url_contains(driver, "/order-confirmation", timeout=30)
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert re.search(r"order confirmed", body_text, re.IGNORECASE)

    def test_4_3_razorpay_dismiss_flow(self, driver, guest_session):
        """4.3 Closing Razorpay modal keeps user on the checkout page."""
        inject_razorpay_mock(driver, "dismiss")

        _ensure_guest_checkout_cart(driver, guest_session)
        goto_checkout(driver)
        wait_for(driver).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())
        fill_guest_address(driver)

        razorpay_selectors = driver.find_elements(
            By.CSS_SELECTOR, "input[value='RAZORPAY'], [data-payment='RAZORPAY']"
        )
        if razorpay_selectors and razorpay_selectors[0].is_displayed():
            driver.execute_script("arguments[0].click();", razorpay_selectors[0])

        place_order_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"place order", btn.text, re.IGNORECASE):
                place_order_btn = btn
                break
        assert place_order_btn
        place_order_btn.click()

        time.sleep(3)

        assert "/checkout" in driver.current_url, \
            f"Expected to stay on checkout page after dismiss, got: {driver.current_url}"

        # Place order button should be available again
        place_order_btns = [
            btn for btn in driver.find_elements(By.TAG_NAME, "button")
            if re.search(r"place order", btn.text, re.IGNORECASE) and btn.is_displayed()
        ]
        assert place_order_btns, "Place Order button should reappear after modal dismiss"

    def test_4_4_razorpay_decline_flow(self, driver, guest_session):
        """4.4 Invalid Razorpay signature triggers payment failure — no confirmation shown."""
        inject_razorpay_mock(driver, "decline")

        _ensure_guest_checkout_cart(driver, guest_session)
        goto_checkout(driver)
        wait_for(driver).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())
        fill_guest_address(driver)

        razorpay_selectors = driver.find_elements(
            By.CSS_SELECTOR, "input[value='RAZORPAY'], [data-payment='RAZORPAY']"
        )
        if razorpay_selectors and razorpay_selectors[0].is_displayed():
            driver.execute_script("arguments[0].click();", razorpay_selectors[0])

        place_order_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"place order", btn.text, re.IGNORECASE):
                place_order_btn = btn
                break
        assert place_order_btn
        place_order_btn.click()

        time.sleep(5)

        body_text = driver.find_element(By.TAG_NAME, "body").text
        is_confirmed = re.search(r"order confirmed", body_text, re.IGNORECASE)
        assert not is_confirmed, \
            "Order should NOT be confirmed after declined payment"

        is_on_checkout = "/checkout" in driver.current_url
        toasts = driver.find_elements(By.CSS_SELECTOR, ".toast-message")
        has_error_toast = any(
            re.search(r"failed|error|invalid", t.text, re.IGNORECASE)
            for t in toasts if t.is_displayed()
        )
        assert is_on_checkout or has_error_toast, \
            "Expected checkout page or error toast after payment decline"
