"""
api.py
requests-based HTTP helpers that mirror the Playwright helper functions.
Used for setup/teardown without launching a browser.
"""

import hashlib
import hmac
import json
import time
from typing import Any, Optional

import requests

from .constants import (
    ADMIN_BASE_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    CUSTOMER_BASE_URL,
    WEBHOOK_SECRET,
)

# Common headers to bypass ngrok warning pages in tunnel mode
_COMMON_HEADERS = {"ngrok-skip-browser-warning": "true"}


# ─── Session Factories ────────────────────────────────────────────────────────

def create_admin_session() -> requests.Session:
    """Create and authenticate a requests.Session as admin."""
    session = requests.Session()
    session.headers.update(_COMMON_HEADERS)
    if ADMIN_EMAIL and ADMIN_PASSWORD:
        resp = session.post(
            f"{ADMIN_BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30,
        )
        if not resp.ok:
            raise RuntimeError(
                f"Admin login failed {resp.status_code}: {resp.text[:200]}"
            )
    return session


def create_customer_session(email: str = "", password: str = "") -> requests.Session:
    """Create and optionally authenticate a requests.Session as customer."""
    session = requests.Session()
    session.headers.update(_COMMON_HEADERS)
    if email and password:
        resp = session.post(
            f"{CUSTOMER_BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        if not resp.ok:
            raise RuntimeError(
                f"Customer login failed {resp.status_code}: {resp.text[:200]}"
            )
    return session


def create_guest_session() -> requests.Session:
    """Create an unauthenticated guest requests.Session (initialises guestSessionId cookie)."""
    session = requests.Session()
    session.headers.update(_COMMON_HEADERS)
    # Hitting /api/cart causes the server to set a guestSessionId cookie
    session.get(f"{CUSTOMER_BASE_URL}/api/cart", timeout=30)
    return session


# ─── Product Helpers ──────────────────────────────────────────────────────────

def find_product_by_name(session: requests.Session, name: str) -> Optional[dict]:
    """Search for a product by name and return the best match."""
    resp = session.get(
        f"{CUSTOMER_BASE_URL}/api/products/search",
        params={"search": name, "take": 20},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    products: list = data.get("data", {}).get("products", [])
    exact = next(
        (p for p in products if p.get("name", "").lower() == name.lower()), None
    )
    return exact or (products[0] if products else None)


# ─── Cart Helpers ─────────────────────────────────────────────────────────────

def clear_cart(session: requests.Session) -> None:
    """Clear the current session's cart (best-effort)."""
    session.delete(f"{CUSTOMER_BASE_URL}/api/cart", timeout=15)


def add_to_cart(
    session: requests.Session, variant_id: str, quantity: int = 1
) -> requests.Response:
    return session.post(
        f"{CUSTOMER_BASE_URL}/api/cart",
        json={"variantId": variant_id, "quantity": quantity},
        timeout=30,
    )


def fetch_cart(session: requests.Session) -> dict:
    resp = session.get(f"{CUSTOMER_BASE_URL}/api/cart", timeout=30)
    resp.raise_for_status()
    return resp.json()


def update_cart_item(
    session: requests.Session, cart_item_id: str, quantity: int
) -> requests.Response:
    return session.patch(
        f"{CUSTOMER_BASE_URL}/api/cart/{cart_item_id}",
        json={"quantity": quantity},
        timeout=30,
    )


# ─── Order Helpers ────────────────────────────────────────────────────────────

def place_cod_order(session: requests.Session, address: dict) -> dict:
    """Place a COD order and return the response body."""
    resp = session.post(
        f"{CUSTOMER_BASE_URL}/api/orders",
        json={"address": address, "paymentMethod": "COD"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def place_razorpay_order(session: requests.Session, address: dict) -> dict:
    """Create a Razorpay order (PENDING) and return the response body."""
    resp = session.post(
        f"{CUSTOMER_BASE_URL}/api/orders",
        json={"address": address, "paymentMethod": "RAZORPAY"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def place_real_cod_order(
    guest_session: requests.Session,
    product_name: str,
    variant: Optional[dict] = None,
    quantity: int = 1,
    address: Optional[dict] = None,
) -> dict:
    """Full pipeline: find product → add to cart → place COD order."""
    from .mock_data import mock_guest_address  # avoid circular import

    product = find_product_by_name(guest_session, product_name)
    assert product, f"Product not found: {product_name}"

    chosen_variant = variant or product["variants"][0]

    clear_cart(guest_session)
    add_resp = add_to_cart(guest_session, chosen_variant["id"], quantity)
    add_resp.raise_for_status()

    addr = address or mock_guest_address("cod")
    body = place_cod_order(guest_session, addr)
    return {
        "order": body.get("data", {}),
        "product": product,
        "variant": chosen_variant,
        "address": addr,
    }


def place_real_razorpay_order(
    guest_session: requests.Session,
    product_name: str,
    variant: Optional[dict] = None,
    quantity: int = 1,
    address: Optional[dict] = None,
) -> dict:
    """Full pipeline: find product → add to cart → create Razorpay order."""
    from .mock_data import mock_guest_address  # avoid circular import

    product = find_product_by_name(guest_session, product_name)
    assert product, f"Product not found: {product_name}"

    chosen_variant = variant or product["variants"][0]

    clear_cart(guest_session)
    add_resp = add_to_cart(guest_session, chosen_variant["id"], quantity)
    add_resp.raise_for_status()

    addr = address or mock_guest_address("rzp")
    body = place_razorpay_order(guest_session, addr)
    return {
        "order": body.get("data", {}),
        "product": product,
        "variant": chosen_variant,
        "address": addr,
    }


# ─── Admin Order Helpers ──────────────────────────────────────────────────────

def admin_update_order_status(
    admin_session: requests.Session, order_id: str, status: str
) -> dict:
    resp = admin_session.put(
        f"{ADMIN_BASE_URL}/api/admin/orders/{order_id}/status",
        json={"status": status},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def admin_get_order_detail(admin_session: requests.Session, order_id: str) -> dict:
    resp = admin_session.get(
        f"{ADMIN_BASE_URL}/api/admin/orders/{order_id}", timeout=30
    )
    resp.raise_for_status()
    return resp.json()


def admin_delete_order(admin_session: requests.Session, order_id: str) -> bool:
    """Delete an order (best-effort cleanup). Returns True on success."""
    try:
        resp = admin_session.delete(
            f"{ADMIN_BASE_URL}/api/admin/orders/{order_id}", timeout=30
        )
        return resp.ok
    except Exception:  # noqa: BLE001
        return False


def admin_create_shipment(
    admin_session: requests.Session, order_id: str, shipment_data: Optional[dict] = None
) -> dict:
    ts = int(time.time() * 1000)
    data = {
        "courierName": "DHL E2E",
        "trackingNumber": f"TRK-{ts}",
        "trackingUrl": "",
        "status": "SHIPPED",
        **(shipment_data or {}),
    }
    resp = admin_session.post(
        f"{ADMIN_BASE_URL}/api/admin/orders/{order_id}/shipments",
        json=data,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def admin_create_payment(
    admin_session: requests.Session, order_id: str, payment_data: Optional[dict] = None
) -> requests.Response:
    ts = int(time.time() * 1000)
    data = {
        "gateway": "COD",
        "status": "SUCCESS",
        "externalReference": f"e2e_pay_{ts}",
        "idempotencyKey": f"idem_pay_{ts}",
        **(payment_data or {}),
    }
    return admin_session.post(
        f"{ADMIN_BASE_URL}/api/admin/orders/{order_id}/payments",
        json=data,
        timeout=30,
    )


# ─── Admin Inventory Helpers ──────────────────────────────────────────────────

def fetch_admin_inventory_by_variant(
    admin_session: requests.Session, variant_id: str
) -> dict:
    resp = admin_session.get(
        f"{ADMIN_BASE_URL}/api/admin/inventory/{variant_id}", timeout=30
    )
    resp.raise_for_status()
    return resp.json()


def update_admin_inventory(
    admin_session: requests.Session,
    variant_id: str,
    quantity: int,
    note: str = "E2E stock update",
) -> dict:
    resp = admin_session.put(
        f"{ADMIN_BASE_URL}/api/admin/variants/{variant_id}/inventory",
        json={"quantity": quantity, "note": note},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def update_admin_variant(
    admin_session: requests.Session, variant_id: str, payload: dict
) -> dict:
    resp = admin_session.put(
        f"{ADMIN_BASE_URL}/api/admin/variants/{variant_id}",
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def update_admin_product(
    admin_session: requests.Session, product_id: str, payload: dict
) -> dict:
    resp = admin_session.put(
        f"{ADMIN_BASE_URL}/api/admin/products/{product_id}",
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


# ─── Customer Address Helpers ─────────────────────────────────────────────────

def ensure_customer_address(customer_session: requests.Session) -> dict:
    """Return an existing saved address or create one."""
    resp = customer_session.get(
        f"{CUSTOMER_BASE_URL}/api/users/addresses", timeout=30
    )
    if resp.ok:
        raw = resp.json()
        addresses = raw if isinstance(raw, list) else raw.get("data", [])
        if addresses:
            return addresses[0]

    create_resp = customer_session.post(
        f"{CUSTOMER_BASE_URL}/api/users/addresses",
        json={
            "name": "E2E Home",
            "phone": "9876543210",
            "addressLine1": "42 QA Street",
            "addressLine2": "Suite 7",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postalCode": "560001",
            "country": "India",
            "isDefault": True,
        },
        timeout=30,
    )
    create_resp.raise_for_status()
    body = create_resp.json()
    return body.get("address") or body.get("data", {}).get("address") or body.get("data") or {}


# ─── Webhook Helpers ──────────────────────────────────────────────────────────

def sign_razorpay_webhook(payload: dict, secret: str) -> tuple[str, str]:
    raw = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(
        secret.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()
    return raw, signature


def send_razorpay_webhook(
    session: requests.Session, payload: dict, secret: str
) -> requests.Response:
    raw, signature = sign_razorpay_webhook(payload, secret)
    return session.post(
        f"{CUSTOMER_BASE_URL}/api/orders/webhook/razorpay",
        data=raw,
        headers={
            "x-razorpay-signature": signature,
            "content-type": "application/json",
        },
        timeout=30,
    )
