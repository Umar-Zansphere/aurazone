# tests/test_login.py

from selenium import webdriver

def test_login():
    driver = webdriver.Chrome()

    driver.get("https://google.com")

    assert "Google" in driver.title

    driver.quit()