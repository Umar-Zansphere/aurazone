"""
mock_data.py
Faker-based mock data builders for the AuraZone Selenium E2E suite.
All builders accept overrides so tests can pin specific fields.
"""

import time
from typing import Any, Optional

from faker import Faker

from .constants import TEST_DATA

_fake = Faker("en_IN")

_counter = 0


def _seq() -> int:
    global _counter
    _counter += 1
    return _counter


def mock_address(tag: str = "mock", **overrides: Any) -> dict:
    """Build a realistic shipping address."""
    ts = int(time.time() * 1000)
    base = {
        "name": f"E2E {tag} User",
        "email": f"e2e.{tag}.{ts}@example.com",
        "phone": "9876543210",
        "addressLine1": "42 QA Street",
        "addressLine2": "Suite 7",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postalCode": "560001",
        "country": "India",
        "isDefault": True,
    }
    base.update(overrides)
    return base


def mock_guest_address(tag: str = "guest", **overrides: Any) -> dict:
    """Build a guest-checkout shipping address with unique email."""
    ts = int(time.time() * 1000)
    base = {
        "name": f"E2E Guest {tag}",
        "email": f"e2e.guest.{tag}.{ts}@example.com",
        "phone": "9876543210",
        "addressLine1": "221B Baker Street",
        "addressLine2": "Near Central Park",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postalCode": "400001",
        "country": "India",
    }
    base.update(overrides)
    return base


def mock_variant(overrides: Optional[dict] = None) -> dict:
    overrides = overrides or {}
    vid = overrides.get("id", f"var_mock_{_seq()}")
    return {
        "id": vid,
        "sku": overrides.get("sku", f"SKU-{vid}"),
        "price": overrides.get("price", 120),
        "compareAtPrice": overrides.get("compareAtPrice"),
        "color": overrides.get("color", TEST_DATA["variant_color"]),
        "size": overrides.get("size", TEST_DATA["variant_size"]),
        "stock": overrides.get("stock", 50),
        "images": overrides.get("images", []),
        **{k: v for k, v in overrides.items() if k not in ("id", "sku", "price", "compareAtPrice", "color", "size", "stock", "images")},
    }


def mock_product(overrides: Optional[dict] = None) -> dict:
    overrides = overrides or {}
    pid = overrides.get("id", f"prod_mock_{_seq()}")
    variants = overrides.get("variants", [mock_variant()])
    return {
        "id": pid,
        "name": overrides.get("name", TEST_DATA["exact_product_name"]),
        "slug": overrides.get("slug", "urban-street"),
        "description": overrides.get("description", "Mock product for E2E testing."),
        "category": overrides.get("category", TEST_DATA["category"]),
        "isActive": overrides.get("isActive", True),
        "variants": variants,
        "images": overrides.get("images", [{"url": "/mock-image.jpg", "alt": "Mock"}]),
    }


def mock_order(overrides: Optional[dict] = None) -> dict:
    overrides = overrides or {}
    ts = int(time.time() * 1000)
    order_id = overrides.get("orderId", f"order_mock_{_seq()}")
    return {
        "success": True,
        "data": {
            "orderId": order_id,
            "orderNumber": overrides.get("orderNumber", f"ORD-MOCK-{ts}"),
            "totalAmount": overrides.get("totalAmount", 160),
            "subtotal": overrides.get("subtotal", 120),
            "shippingCost": overrides.get("shippingCost", 40),
            "tax": overrides.get("tax", 0),
            "paymentMethod": overrides.get("paymentMethod", "RAZORPAY"),
            "status": overrides.get("status", "PENDING"),
            "razorpayOrderId": overrides.get("razorpayOrderId", f"order_rzp_{ts}"),
            "createdAt": overrides.get("createdAt", "2024-01-01T00:00:00.000Z"),
        },
    }


def make_race_address(tag: str = "race") -> dict:
    ts = int(time.time() * 1000)
    return {
        "name": f"E2E Race {tag}",
        "email": f"race.{tag}.{ts}@example.com",
        "phone": "9876543210",
        "addressLine1": f"{_seq()} Race Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postalCode": "400001",
        "country": "India",
    }
