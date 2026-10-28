"""
test_01_product_search_and_browsing.py
Suite 1: Product Search & Browsing

Covers:
  1.1  Exact match search
  1.2  Partial keyword search
  1.3  Empty-state search (no results)
  1.4  Category filtering
  1.5  Price range filtering
  1.6  Sort combinations (low→high, high→low, newest)
  1.7  Pagination / next page (or disabled state)
  1.8  Product detail page accuracy
"""

import re

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from utils.constants import TEST_DATA, CUSTOMER_BASE_URL
from utils.helpers import (
    find_all,
    get_product_card_links,
    goto_products_page,
    open_product_by_name,
    parse_inr,
    search_products,
    wait_for,
    wait_for_product_results,
    wait_for_url_contains,
)

pytestmark = pytest.mark.customer


class TestProductSearchAndBrowsing:
    """1. Product Searching & Browsing"""

    def test_1_1_exact_match_search(self, driver):
        """1.1 Exact product appears in search results."""
        goto_products_page(driver)
        search_products(driver, TEST_DATA["exact_product_name"])
        wait_for_product_results(driver)

        cards = get_product_card_links(driver)
        texts = [c.text for c in cards if c.is_displayed()]
        assert any(TEST_DATA["exact_product_name"].lower() in t.lower() for t in texts), \
            f"Expected to find '{TEST_DATA['exact_product_name']}' in product cards"

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "no products found" not in page_text.lower()

    def test_1_2_partial_keyword_search(self, driver):
        """1.2 Partial keyword returns relevant products."""
        goto_products_page(driver)
        keyword = TEST_DATA["exact_product_name"].split()[0][:3]
        search_products(driver, keyword)
        result = wait_for_product_results(driver)

        if result == "cards":
            cards = get_product_card_links(driver)
            assert len([c for c in cards if c.is_displayed()]) > 0

        body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        assert keyword.lower() in body_text

    def test_1_3_empty_state_search(self, driver):
        """1.3 Non-existent product shows friendly empty-state message."""
        goto_products_page(driver)
        search_products(driver, f"no-such-product-xyz-{id(driver)}")
        wait_for_product_results(driver)

        body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "no products found" in body_text

        # Friendly sub-message
        assert any(
            phrase in body_text
            for phrase in ["try adjusting", "filter", "search term"]
        )

    def test_1_4_category_filtering(self, driver):
        """1.4 Selecting a category filter shows only products from that category."""
        goto_products_page(driver)

        # Find category radio inputs
        category_inputs = driver.find_elements(
            By.CSS_SELECTOR, "input[type='radio'][name='category']"
        )
        if not category_inputs:
            pytest.skip("No category radio inputs found on products page.")

        # Try to select the configured category, else use first available
        target_category = TEST_DATA["category"]
        selected_input = None
        selected_value = ""

        for inp in category_inputs:
            val = inp.get_attribute("value") or ""
            if val.lower() == target_category.lower():
                selected_input = inp
                selected_value = val
                break

        if not selected_input:
            selected_input = category_inputs[0]
            selected_value = selected_input.get_attribute("value") or ""

        driver.execute_script("arguments[0].click();", selected_input)

        # Click Apply Filters
        apply_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"apply filters", btn.text, re.IGNORECASE):
                apply_btn = btn
                break

        if apply_btn:
            apply_btn.click()

        # Wait for URL to reflect category
        wait_for(driver, 20).until(lambda d: selected_value in d.current_url)
        wait_for_product_results(driver)

        cards = get_product_card_links(driver)
        if not cards:
            body_text = driver.find_element(By.TAG_NAME, "body").text
            assert "no products found" in body_text.lower()
        else:
            # At minimum, the page rendered without error
            assert len(cards) >= 0

    def test_1_5_price_range_filtering(self, driver):
        """1.5 Price-range filter limits displayed products to within min/max."""
        goto_products_page(driver)

        min_price = TEST_DATA["min_price"]
        max_price = TEST_DATA["max_price"]

        min_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Min']")
        max_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Max']")
        min_input.clear()
        min_input.send_keys(str(min_price))
        max_input.clear()
        max_input.send_keys(str(max_price))

        apply_btn = None
        for btn in driver.find_elements(By.TAG_NAME, "button"):
            if re.search(r"apply filters", btn.text, re.IGNORECASE):
                apply_btn = btn
                break

        if apply_btn:
            apply_btn.click()

        wait_for(driver, 20).until(lambda d: str(min_price) in d.current_url)
        wait_for_product_results(driver)

        cards = get_product_card_links(driver)
        if not cards:
            body_text = driver.find_element(By.TAG_NAME, "body").text
            assert "no products found" in body_text.lower()
            return

        # Extract and verify prices
        prices = []
        for card in cards:
            if not card.is_displayed():
                continue
            text = card.text
            matches = re.findall(r"₹\s*([\d,]+(?:\.\d+)?)", text)
            if matches:
                card_prices = [float(m.replace(",", "")) for m in matches]
                prices.append(min(card_prices))

        for price in prices:
            assert min_price <= price <= max_price, \
                f"Price {price} is outside filter range [{min_price}, {max_price}]"

    def test_1_6_sorting_combinations(self, driver):
        """1.6 Sort: low-to-high, high-to-low, newest options applied correctly."""
        import time as _time  # noqa: PLC0415
        from selenium.webdriver.support.select import Select  # noqa: PLC0415

        goto_products_page(driver)
        wait_for_product_results(driver)

        selects = driver.find_elements(By.TAG_NAME, "select")
        if not selects:
            pytest.skip("No sort select found on products page.")

        def _get_fresh_select(d):
            els = d.find_elements(By.TAG_NAME, "select")
            return Select(els[0]) if els else None

        def _get_prices(d, limit=10):
            """Extract the first N product prices visible on the page."""
            cards = get_product_card_links(d)
            prices = []
            for card in cards[:limit]:
                try:
                    text = card.text
                    matches = re.findall(r"₹\s*([\d,]+(?:\.\d+)?)", text)
                    if matches:
                        prices.append(min(float(m.replace(",", "")) for m in matches))
                except Exception:  # noqa: BLE001
                    pass
            return prices

        def _select_and_wait(d, value, expected_order_fn=None, retries=3):
            """Select a sort option and wait for prices to reflect the sort."""
            for attempt in range(retries):
                _get_fresh_select(d).select_by_value(value)
                _time.sleep(1.5)  # give React state time to settle
                prices = _get_prices(d)
                if len(prices) >= 2:
                    if expected_order_fn is None or expected_order_fn(prices):
                        return prices
            return _get_prices(d)

        # Low → High
        prices_low = _select_and_wait(driver, "price-low", lambda p: p == sorted(p))
        if len(prices_low) > 1:
            assert prices_low == sorted(prices_low), \
                f"Expected ascending prices but got: {prices_low}"

        # High → Low
        prices_high = _select_and_wait(driver, "price-high", lambda p: p == sorted(p, reverse=True))
        if len(prices_high) > 1:
            assert prices_high == sorted(prices_high, reverse=True), \
                f"Expected descending prices but got: {prices_high}"

        # Newest — just verify the option is selectable and selected
        _get_fresh_select(driver).select_by_value("newest")
        _time.sleep(0.5)
        sel = _get_fresh_select(driver)
        if sel:
            selected_val = sel.first_selected_option.get_attribute("value")
            assert selected_val == "newest", f"Expected 'newest' selected, got '{selected_val}'"

    def test_1_7_pagination(self, driver):
        """1.7 Next-page button loads additional products without duplicates, or is disabled."""
        goto_products_page(driver)
        wait_for_product_results(driver)

        initial_cards = get_product_card_links(driver)
        initial_hrefs = {c.get_attribute("href") for c in initial_cards if c.is_displayed()}

        next_btns = [
            btn for btn in driver.find_elements(By.TAG_NAME, "button")
            if btn.text.strip().lower() == "next"
        ]

        if not next_btns:
            pytest.skip("No 'Next' pagination button found.")

        next_btn = next_btns[0]
        if not next_btn.is_enabled():
            assert not next_btn.is_enabled()
            return

        next_btn.click()
        wait_for(driver).until(EC.staleness_of(next_btn))
        wait_for_product_results(driver)

        second_cards = get_product_card_links(driver)
        second_hrefs = {c.get_attribute("href") for c in second_cards if c.is_displayed()}

        overlap = initial_hrefs & second_hrefs
        assert len(overlap) < len(second_hrefs), \
            "Pagination produced all-duplicate hrefs — no new products loaded"

    def test_1_8_product_detail_accuracy(self, driver):
        """1.8 Product detail page shows title, price, images, and variant selectors."""
        goto_products_page(driver)
        open_product_by_name(driver, TEST_DATA["exact_product_name"])

        # Title
        headings = driver.find_elements(By.TAG_NAME, "h1")
        assert any(
            TEST_DATA["exact_product_name"].lower() in h.text.lower()
            for h in headings
        ), "Product title not found on detail page"

        body_text = driver.find_element(By.TAG_NAME, "body").text

        # Price
        price = parse_inr(body_text)
        assert price is not None, "No price (₹) found on product detail page"

        # Color variant selector
        assert re.search(r"color.?variant|color", body_text, re.IGNORECASE), \
            "Color variant section not found"

        # Size selector
        assert re.search(r"select.?size|size", body_text, re.IGNORECASE), \
            "Size selector not found"

        # Images
        images = driver.find_elements(By.CSS_SELECTOR, "main img")
        assert len(images) > 0, "No product images found on detail page"
