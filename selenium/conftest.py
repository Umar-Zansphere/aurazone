"""
conftest.py
Global pytest fixtures for the AuraZone Selenium E2E test suite.

Fixture hierarchy:
  session-scoped : admin_session, customer_session
  function-scoped: driver, guest_session, created_order_ids, db_cleanup
"""

import logging
import os
from pathlib import Path
from typing import Generator

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

from utils.api import (
    admin_delete_order,
    create_admin_session,
    create_customer_session,
    create_guest_session,
    find_product_by_name,
    update_admin_inventory,
)
from utils.constants import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    BROWSER_TIMEOUT,
    CUSTOMER_EMAIL,
    CUSTOMER_PASSWORD,
    HEADLESS,
    IMPLICIT_WAIT,
    PAGE_LOAD_TIMEOUT,
)

log = logging.getLogger(__name__)

# ─── Directory Setup ──────────────────────────────────────────────────────────

def pytest_configure(config: pytest.Config) -> None:
    """Ensure the reports directory exists before tests run."""
    reports_dir = Path(__file__).parent / "reports"
    reports_dir.mkdir(exist_ok=True)


# ─── Pre-run Restock ───────────────────────────────────────────────────────────────

_RESTOCK_LEVEL = 50  # units — more than enough for any test run

@pytest.fixture(scope="session", autouse=True)
def restock_test_products() -> None:
    """
    Before any test in the session, restore stock for all test products to
    _RESTOCK_LEVEL units via the Admin API.  This prevents '500 out of stock'
    errors caused by earlier runs depleting inventory.
    Runs once per session, before any test is executed.
    """
    from utils.constants import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_DATA  # noqa: PLC0415

    if not (ADMIN_EMAIL and ADMIN_PASSWORD):
        log.warning("Skipping pre-run restock: admin credentials not configured.")
        return

    try:
        admin = create_admin_session()
        guest = create_guest_session()
        product_names = [
            TEST_DATA["exact_product_name"],
            TEST_DATA["secondary_product_name"],
            TEST_DATA.get("tertiary_product_name", ""),
        ]
        for name in filter(None, product_names):
            try:
                product = find_product_by_name(guest, name)
                if not product:
                    log.warning("Restock: product '%s' not found", name)
                    continue
                for variant in product.get("variants", []):
                    try:
                        update_admin_inventory(admin, variant["id"], _RESTOCK_LEVEL, "E2E pre-run restock")
                        log.info("Restocked %s / %s to %d", name, variant.get("sku", variant["id"]), _RESTOCK_LEVEL)
                    except Exception as exc:  # noqa: BLE001
                        log.warning("Could not restock variant %s: %s", variant["id"], exc)
            except Exception as exc:  # noqa: BLE001
                log.warning("Restock error for product '%s': %s", name, exc)
        guest.close()
        admin.close()
    except Exception as exc:  # noqa: BLE001
        log.warning("Pre-run restock failed (non-fatal): %s", exc)

# ─── Browser Driver Fixture ───────────────────────────────────────────────────

@pytest.fixture(scope="function")
def driver() -> Generator[webdriver.Chrome, None, None]:
    """
    Provide a configured Chrome WebDriver instance per test function.
    Automatically quits after each test.
    """
    chrome_options = Options()

    if HEADLESS:
        chrome_options.add_argument("--headless=new")

    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    # Use webdriver_manager to auto-download the correct chromedriver
    service = Service(ChromeDriverManager().install())
    _driver = webdriver.Chrome(service=service, options=chrome_options)

    _driver.implicitly_wait(IMPLICIT_WAIT)
    _driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
    _driver.set_script_timeout(30)

    yield _driver

    try:
        _driver.quit()
    except Exception:  # noqa: BLE001
        pass


# ─── API Session Fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_session() -> Generator[requests.Session, None, None]:
    """
    Session-scoped authenticated admin API session.
    Created once and reused across all tests in the session.
    """
    session = create_admin_session()
    yield session
    session.close()


@pytest.fixture(scope="session")
def customer_session() -> Generator[requests.Session, None, None]:
    """
    Session-scoped authenticated customer API session.
    """
    session = create_customer_session(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    yield session
    session.close()


@pytest.fixture(scope="function")
def guest_session() -> Generator[requests.Session, None, None]:
    """
    Function-scoped fresh guest API session.
    Each test that needs a guest gets a completely new session (new cookie jar).
    """
    session = create_guest_session()
    yield session
    session.close()


# ─── DB Cleanup Fixture ───────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def created_order_ids() -> Generator[list, None, None]:
    """
    Collects order IDs created during a test.
    On teardown, deletes all collected orders via the Admin API.
    Usage: `created_order_ids.append(order_id)` inside a test.
    """
    ids: list[str] = []
    yield ids
    # Teardown: delete all test orders
    if not ids:
        return
    try:
        admin = create_admin_session()
        for oid in ids:
            success = admin_delete_order(admin, oid)
            if not success:
                log.warning("Could not delete test order %s via API (best effort)", oid)
        admin.close()
    except Exception as exc:  # noqa: BLE001
        log.warning("Order cleanup encountered an error (non-fatal): %s", exc)


# ─── Inventory Snapshot Fixture ───────────────────────────────────────────────

@pytest.fixture(scope="function")
def inventory_snapshots(admin_session: requests.Session) -> Generator[dict, None, None]:
    """
    Records {variant_id: quantity} snapshots before a test.
    Restores inventory to the recorded quantities on teardown.
    Usage:
        inventory_snapshots[variant_id] = quantity_before
    """
    from utils.api import update_admin_inventory  # noqa: PLC0415

    snapshots: dict[str, int] = {}
    yield snapshots

    # Teardown: restore all recorded inventories
    for variant_id, quantity in snapshots.items():
        try:
            update_admin_inventory(admin_session, variant_id, quantity, "E2E inventory restoration")
            log.info("Restored inventory for variant %s to %d", variant_id, quantity)
        except Exception as exc:  # noqa: BLE001
            log.warning("Could not restore inventory for %s: %s (non-fatal)", variant_id, exc)


# ─── Skip Markers ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def skip_without_admin_creds(request: pytest.FixtureRequest) -> None:
    """Auto-skip tests marked with @pytest.mark.requires_admin if admin creds missing."""
    if request.node.get_closest_marker("requires_admin"):
        if not (ADMIN_EMAIL and ADMIN_PASSWORD):
            pytest.skip("Admin credentials (ADMIN_EMAIL / ADMIN_PASSWORD) are required.")


@pytest.fixture(autouse=True)
def skip_without_customer_creds(request: pytest.FixtureRequest) -> None:
    """Auto-skip tests marked with @pytest.mark.requires_customer if customer creds missing."""
    if request.node.get_closest_marker("requires_customer"):
        if not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD):
            pytest.skip("Customer credentials (CUSTOMER_EMAIL / CUSTOMER_PASSWORD) are required.")
