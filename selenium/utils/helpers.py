"""
helpers.py
Selenium WebDriver page interaction helpers.
All helpers use explicit waits (no time.sleep) and accept a WebDriver instance.
"""

import re
import time
from typing import Optional

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from .constants import (
    ADMIN_BASE_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    BROWSER_TIMEOUT,
    CUSTOMER_BASE_URL,
    CUSTOMER_EMAIL,
    CUSTOMER_PASSWORD,
    admin_url,
    customer_url,
)

# ─── Core Wait Utilities ──────────────────────────────────────────────────────

def wait_for(driver: webdriver.Chrome, timeout: int = BROWSER_TIMEOUT) -> WebDriverWait:
    return WebDriverWait(driver, timeout, poll_frequency=0.5)


def wait_visible(driver: webdriver.Chrome, by: By, value: str, timeout: int = BROWSER_TIMEOUT) -> WebElement:
    return wait_for(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def wait_clickable(driver: webdriver.Chrome, by: By, value: str, timeout: int = BROWSER_TIMEOUT) -> WebElement:
    return wait_for(driver, timeout).until(EC.element_to_be_clickable((by, value)))


def wait_for_url_contains(driver: webdriver.Chrome, fragment: str, timeout: int = BROWSER_TIMEOUT) -> bool:
    return wait_for(driver, timeout).until(EC.url_contains(fragment))


def wait_for_url_matches(driver: webdriver.Chrome, pattern: str, timeout: int = BROWSER_TIMEOUT) -> bool:
    return wait_for(driver, timeout).until(EC.url_matches(pattern))


def wait_text_in_element(driver: webdriver.Chrome, by: By, value: str, text: str, timeout: int = BROWSER_TIMEOUT) -> bool:
    return wait_for(driver, timeout).until(EC.text_to_be_present_in_element((by, value), text))


def find_all(driver: webdriver.Chrome, by: By, value: str) -> list[WebElement]:
    try:
        return driver.find_elements(by, value)
    except Exception:  # noqa: BLE001
        return []


def is_visible(driver: webdriver.Chrome, by: By, value: str) -> bool:
    try:
        el = driver.find_element(by, value)
        return el.is_displayed()
    except (NoSuchElementException, StaleElementReferenceException):
        return False


def safe_click(driver: webdriver.Chrome, element: WebElement, timeout: int = 10) -> None:
    """Scroll into view and click, with a retry on StaleElementReference."""
    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
        element.click()
    except StaleElementReferenceException:
        pass


def fill_input(driver: webdriver.Chrome, element: WebElement, value: str) -> None:
    """Clear and fill an input field."""
    element.clear()
    element.send_keys(value)


def find_by_placeholder(driver: webdriver.Chrome, placeholder: str, partial: bool = True) -> Optional[WebElement]:
    """Find an input by placeholder text (case-insensitive substring)."""
    inputs = driver.find_elements(By.CSS_SELECTOR, "input, textarea")
    for inp in inputs:
        ph = (inp.get_attribute("placeholder") or "").lower()
        if (partial and placeholder.lower() in ph) or (not partial and ph == placeholder.lower()):
            return inp
    return None


def find_button_by_text(driver: webdriver.Chrome, text: str, timeout: int = BROWSER_TIMEOUT) -> Optional[WebElement]:
    """Find a button whose text matches the given string (case-insensitive)."""
    try:
        return wait_for(driver, timeout).until(
            EC.element_to_be_clickable(
                (By.XPATH, f"//button[normalize-space(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'))='{text.lower()}']")
            )
        )
    except TimeoutException:
        return None


def find_element_with_text(driver: webdriver.Chrome, text: str, tag: str = "*", timeout: int = BROWSER_TIMEOUT) -> Optional[WebElement]:
    """Find a visible element containing the given text."""
    try:
        return wait_for(driver, timeout).until(
            EC.visibility_of_element_located(
                (By.XPATH, f"//{tag}[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]")
            )
        )
    except TimeoutException:
        return None


# ─── Navigation ───────────────────────────────────────────────────────────────

def goto_customer(driver: webdriver.Chrome, path: str = "/") -> None:
    driver.get(customer_url(path))


def goto_admin(driver: webdriver.Chrome, path: str = "/") -> None:
    driver.get(admin_url(path))


def goto_products_page(driver: webdriver.Chrome) -> None:
    goto_customer(driver, "/products")
    wait_for(driver).until(
        lambda d: any(
            h.is_displayed() for h in d.find_elements(By.TAG_NAME, "h1")
            if re.search(r"products", h.text, re.IGNORECASE)
        )
    )


def goto_cart(driver: webdriver.Chrome) -> None:
    goto_customer(driver, "/cart")
    wait_for(driver).until(
        lambda d: bool(
            d.find_elements(By.XPATH, "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'order summary')]")
            or d.find_elements(By.XPATH, "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'your cart is empty')]")
        )
    )


def goto_checkout(driver: webdriver.Chrome) -> None:
    goto_customer(driver, "/checkout")
    wait_for(driver).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


# ─── Product Interactions ─────────────────────────────────────────────────────

def search_products(driver: webdriver.Chrome, term: str) -> None:
    """Fill the search input and submit."""
    search_input = None
    for inp in driver.find_elements(By.CSS_SELECTOR, "input"):
        ph = (inp.get_attribute("placeholder") or "").lower()
        if "search" in ph and "product" in ph:
            search_input = inp
            break
    assert search_input, "Could not find search input"
    search_input.clear()
    search_input.send_keys(term)

    search_btn = find_button_by_text(driver, "search", timeout=5)
    if search_btn:
        search_btn.click()
    else:
        search_input.send_keys(Keys.RETURN)

    # Wait until URL reflects the search term
    wait_for(driver).until(lambda d: term in d.current_url or "search" in d.current_url)


def get_product_card_links(driver: webdriver.Chrome) -> list[WebElement]:
    """Return all product card anchor elements."""
    return driver.find_elements(By.CSS_SELECTOR, "a[href^='/product/']")


def wait_for_product_results(driver: webdriver.Chrome, timeout: int = 20) -> str:
    """Wait until products or 'no products found' appear. Returns 'cards' or 'empty'."""
    def _check(d: webdriver.Chrome) -> str:
        cards = d.find_elements(By.CSS_SELECTOR, "a[href^='/product/']")
        if any(c.is_displayed() for c in cards):
            return "cards"
        body = d.find_element(By.TAG_NAME, "body").text.lower()
        if "no products found" in body:
            return "empty"
        return ""

    deadline = time.time() + timeout
    while time.time() < deadline:
        result = _check(driver)
        if result:
            return result
        time.sleep(0.5)
    raise TimeoutException("Product results did not settle within timeout")


def open_product_by_name(driver: webdriver.Chrome, name: str) -> None:
    """Click the product card whose text contains the given name."""
    cards = get_product_card_links(driver)
    for card in cards:
        if name.lower() in (card.text or "").lower():
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", card)
            card.click()
            wait_for_url_matches(driver, r"/product/[^/]+")
            return
    raise NoSuchElementException(f"Product card not found: {name}")


def add_current_product_to_cart(driver: webdriver.Chrome, timeout: int = 45) -> None:
    """Click 'Add to Cart' and wait for the button state change or toast."""
    add_btn_xpath = "//button[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='add to cart']"
    added_btn_xpath = "//button[normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='added to cart']"

    # If already added, skip
    if driver.find_elements(By.XPATH, added_btn_xpath):
        return

    add_btn = wait_for(driver, timeout).until(
        EC.element_to_be_clickable((By.XPATH, add_btn_xpath))
    )
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", add_btn)
    add_btn.click()

    # Wait for state change
    def _success(d: webdriver.Chrome) -> bool:
        if d.find_elements(By.XPATH, added_btn_xpath):
            return True
        toasts = d.find_elements(By.CSS_SELECTOR, ".toast-message")
        for t in toasts:
            if t.is_displayed() and re.search(r"added to cart", t.text, re.IGNORECASE):
                return True
            if t.is_displayed() and re.search(r"error|failed|insufficient|out of stock", t.text, re.IGNORECASE):
                raise AssertionError(f"Add to cart failed: {t.text}")
        return False

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if _success(driver):
                return
        except AssertionError:
            raise
        time.sleep(0.5)
    raise TimeoutException("Add to cart did not complete within timeout")


# ─── Auth Flows ───────────────────────────────────────────────────────────────

def _inject_session_cookies(
    driver: webdriver.Chrome,
    base_url: str,
    api_login_url: str,
    email: str,
    password: str,
    redirect_path: str = "/",
    existing_session: Optional["requests.Session"] = None,
) -> None:
    """
    API-based login: POST credentials, harvest cookies from requests.Session,
    inject them into the Selenium driver. Identical to Playwright's global-setup approach.
    """
    if existing_session:
        session = existing_session
    else:
        import requests as _req  # noqa: PLC0415
        session = _req.Session()
        session.headers.update({"ngrok-skip-browser-warning": "true"})
        resp = session.post(
            api_login_url,
            json={"email": email, "password": password},
            timeout=30,
        )
        if not resp.ok:
            raise RuntimeError(
                f"API login failed {resp.status_code}: {resp.text[:200]}"
            )

    # Navigate to the domain first so we can set cookies for it
    driver.get(base_url + redirect_path)
    wait_for(driver, 30).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())

    # Inject all cookies from the requests session into Selenium
    for cookie in session.cookies:
        cookie_dict: dict = {
            "name": cookie.name,
            "value": cookie.value,
            "path": cookie.path or "/",
        }
        if cookie.domain:
            # Strip leading dot for Selenium
            cookie_dict["domain"] = cookie.domain.lstrip(".")
        if cookie.expires:
            cookie_dict["expiry"] = int(cookie.expires)
        if cookie.secure:
            cookie_dict["secure"] = True
        try:
            driver.add_cookie(cookie_dict)
        except Exception:  # noqa: BLE001
            pass  # Non-critical cookies may fail

    if not existing_session:
        session.close()
    # Reload so the app picks up the injected cookies
    driver.refresh()
    wait_for(driver, 30).until(lambda d: d.find_element(By.TAG_NAME, "body").is_displayed())


def ensure_customer_login(driver: webdriver.Chrome, existing_session: Optional["requests.Session"] = None) -> None:
    """Ensure the browser driver is authenticated as the customer via API cookie injection."""
    if not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD):
        raise RuntimeError("CUSTOMER_EMAIL / CUSTOMER_PASSWORD not set in .env")
    _inject_session_cookies(
        driver=driver,
        base_url=CUSTOMER_BASE_URL,
        api_login_url=f"{CUSTOMER_BASE_URL}/api/auth/login",
        email=CUSTOMER_EMAIL,
        password=CUSTOMER_PASSWORD,
        redirect_path="/account",
        existing_session=existing_session,
    )


def ensure_admin_login(driver: webdriver.Chrome, existing_session: Optional["requests.Session"] = None) -> None:
    """Ensure the browser driver is authenticated as admin via API cookie injection."""
    if not (ADMIN_EMAIL and ADMIN_PASSWORD):
        raise RuntimeError("ADMIN_EMAIL / ADMIN_PASSWORD not set in .env")
    _inject_session_cookies(
        driver=driver,
        base_url=ADMIN_BASE_URL,
        api_login_url=f"{ADMIN_BASE_URL}/api/auth/login",
        email=ADMIN_EMAIL,
        password=ADMIN_PASSWORD,
        redirect_path="/dashboard",
        existing_session=existing_session,
    )


# ─── Checkout Helpers ─────────────────────────────────────────────────────────

def fill_guest_address(driver: webdriver.Chrome, overrides: Optional[dict] = None) -> dict:
    """Fill the guest checkout address form and return the values used."""
    import time as _time  # noqa: PLC0415
    ts = int(_time.time() * 1000)

    values = {
        "name": "E2E Guest User",
        "email": f"e2e.guest.{ts}@example.com",
        "phone": "9876543210",
        "addressLine1": "221B Baker Street",
        "addressLine2": "Near Central Park",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postalCode": "400001",
        **(overrides or {}),
    }

    _fill_placeholder(driver, "enter your full name", values["name"])
    _fill_placeholder(driver, "you@example.com", values["email"])
    _fill_placeholder(driver, "98765", values["phone"])
    _fill_placeholder(driver, "123 main street", values["addressLine1"])
    _fill_placeholder(driver, "apartment", values["addressLine2"])
    _fill_placeholder(driver, "e.g., mumbai", values["city"], partial=True)
    _fill_placeholder(driver, "e.g., maharashtra", values["state"], partial=True)
    _fill_placeholder(driver, "e.g., 400001", values["postalCode"], partial=True)

    return values


def _fill_placeholder(driver: webdriver.Chrome, placeholder: str, value: str, partial: bool = True) -> None:
    el = find_by_placeholder(driver, placeholder, partial=partial)
    if el:
        fill_input(driver, el, value)


# ─── Toast Helpers ────────────────────────────────────────────────────────────

def wait_for_toast(driver: webdriver.Chrome, pattern: str, timeout: int = 15) -> str:
    """Wait for a toast message matching the regex pattern. Returns its text."""
    compiled = re.compile(pattern, re.IGNORECASE)
    deadline = time.time() + timeout
    while time.time() < deadline:
        toasts = driver.find_elements(By.CSS_SELECTOR, ".toast-message")
        for t in toasts:
            if t.is_displayed() and compiled.search(t.text or ""):
                return t.text or ""
        time.sleep(0.3)
    raise TimeoutException(f"Toast matching '{pattern}' not found within {timeout}s")


# ─── INR Parser ───────────────────────────────────────────────────────────────

def parse_inr(text: str) -> Optional[float]:
    match = re.search(r"₹\s*([\d,]+(?:\.\d+)?)", str(text or ""))
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


# ─── Razorpay Mock ────────────────────────────────────────────────────────────

_RAZORPAY_MOCK_SCRIPT = """
window.__razorpayMode = arguments[0];
window.Razorpay = function MockRazorpay(options) {
    this.open = function() {
        var mode = window.__razorpayMode;
        if (mode === 'dismiss') {
            if (options && options.modal && options.modal.ondismiss) {
                options.modal.ondismiss();
            }
            return;
        }
        if (mode === 'decline') {
            if (options && options.handler) {
                options.handler({
                    razorpay_order_id: options.order_id,
                    razorpay_payment_id: 'pay_declined_' + Date.now(),
                    razorpay_signature: 'invalid_signature'
                });
            }
            return;
        }
        // success
        if (options && options.handler) {
            options.handler({
                razorpay_order_id: options.order_id,
                razorpay_payment_id: 'pay_success_' + Date.now(),
                razorpay_signature: 'valid_signature'
            });
        }
    };
};
"""


def inject_razorpay_mock(driver: webdriver.Chrome, mode: str = "success") -> None:
    """
    Inject a Razorpay mock into the page via execute_script.
    Must be called BEFORE navigating to the checkout page (use CDP or call after nav
    then reload). In Selenium 4 we inject on every navigation via CDP.
    """
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": _RAZORPAY_MOCK_SCRIPT.replace("arguments[0]", f"'{mode}'")},
    )


def get_cart_badge_count(driver: webdriver.Chrome) -> int:
    """Return the cart badge count, or 0 if not found."""
    try:
        badges = driver.find_elements(By.CSS_SELECTOR, "[aria-label='Shopping cart'] span")
        if badges:
            return int(badges[0].text.strip() or "0")
    except (ValueError, StaleElementReferenceException):
        pass
    return 0
