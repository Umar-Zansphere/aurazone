"""
constants.py
Central configuration for the AuraZone Selenium E2E test suite.
All values can be overridden via environment variables (loaded from .env).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the selenium/ root
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

# ─── URLs ───────────────────────────────────────────────────────────────────
CUSTOMER_BASE_URL: str = os.getenv("CUSTOMER_BASE_URL", "https://test.aurazone.shop").rstrip("/")
ADMIN_BASE_URL: str = os.getenv("ADMIN_BASE_URL", "https://test.admin.aurazone.shop").rstrip("/")

# ─── Auth Credentials ────────────────────────────────────────────────────────
ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")
CUSTOMER_EMAIL: str = os.getenv("CUSTOMER_EMAIL", "")
CUSTOMER_PASSWORD: str = os.getenv("CUSTOMER_PASSWORD", "")

# ─── Test Product Data ────────────────────────────────────────────────────────
TEST_DATA = {
    "exact_product_name": os.getenv("E2E_PRODUCT_EXACT", "Urban Street"),
    "secondary_product_name": os.getenv("E2E_PRODUCT_SECONDARY", "Forest Trek"),
    "tertiary_product_name": os.getenv("E2E_PRODUCT_TERTIARY", "Retro Colorblock"),
    "category": os.getenv("E2E_CATEGORY", "RUNNING"),
    "min_price": int(os.getenv("E2E_MIN_PRICE", "100")),
    "max_price": int(os.getenv("E2E_MAX_PRICE", "125")),
    "variant_color": os.getenv("E2E_VARIANT_COLOR", "Midnight Black"),
    "variant_size": os.getenv("E2E_VARIANT_SIZE", "US 9"),
}

# ─── Webhook ──────────────────────────────────────────────────────────────────
WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "")

# ─── Browser ──────────────────────────────────────────────────────────────────
HEADLESS: bool = os.getenv("HEADLESS", "true").lower() in ("true", "1", "yes")
BROWSER_TIMEOUT: int = int(os.getenv("BROWSER_TIMEOUT", "30"))
IMPLICIT_WAIT: int = 5
PAGE_LOAD_TIMEOUT: int = 60

# ─── Helpers ──────────────────────────────────────────────────────────────────
def has_customer_creds() -> bool:
    return bool(CUSTOMER_EMAIL and CUSTOMER_PASSWORD)

def has_admin_creds() -> bool:
    return bool(ADMIN_EMAIL and ADMIN_PASSWORD)

def has_webhook_secret() -> bool:
    return bool(WEBHOOK_SECRET)

def customer_url(path: str = "/") -> str:
    return CUSTOMER_BASE_URL + ("" if path.startswith("/") else "/") + path

def admin_url(path: str = "/") -> str:
    return ADMIN_BASE_URL + ("" if path.startswith("/") else "/") + path
