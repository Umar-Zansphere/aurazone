"""
db.py
Direct database helpers for test cleanup.
Primary strategy: Admin API deletion (safe, no raw SQL required).
Fallback: psycopg2 direct DELETE when DATABASE_URL is configured and psycopg2 is installed.
"""

import os
import logging

log = logging.getLogger(__name__)

try:
    import psycopg2  # noqa: F401
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False
    log.debug("psycopg2 not installed — raw DB cleanup disabled (Admin API cleanup is used instead).")

def get_db_connection():
    """Return a raw psycopg2 connection if DATABASE_URL is available, else None."""
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        return None
    try:
        import psycopg2  # noqa: PLC0415
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        return conn
    except Exception as exc:  # noqa: BLE001
        log.warning("DB connection unavailable (non-fatal): %s", exc)
        return None


def delete_orders_by_ids(order_ids: list[str]) -> None:
    """
    Delete test orders directly from the DB via psycopg2.
    Only used as a last-resort fallback when the Admin API delete endpoint fails.
    """
    if not order_ids:
        return
    conn = get_db_connection()
    if conn is None:
        log.info("Skipping raw DB cleanup — DATABASE_URL not configured.")
        return

    try:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(order_ids))
            cur.execute(f'DELETE FROM "Order" WHERE id IN ({placeholders})', order_ids)
        conn.commit()
        log.info("Deleted %d test orders from DB.", len(order_ids))
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        log.warning("Raw DB cleanup failed (non-fatal): %s", exc)
    finally:
        conn.close()
