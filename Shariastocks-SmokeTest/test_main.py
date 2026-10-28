import os
import sys
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
import traceback


# --- Test Credentials ---
TEST_EMAIL = os.environ.get("TEST_USER_EMAIL", "umarmohamed444481@gmail.com")
TEST_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "321654")
BASE_URL = "https://shariastocks.in/"

# --- Predefined Stock Symbols ---
STOCK_SYMBOLS = [
    {"symbol": "TCS", "company": "Tata Consultancy Services"},
    {"symbol": "RELIANCE", "company": "Reliance Industries"},
    {"symbol": "HDFCBANK", "company": "HDFC Bank"},
    {"symbol": "INFY", "company": "Infosys"},
    {"symbol": "WIPRO", "company": "Wipro"},
    {"symbol": "SBIN", "company": "State Bank of India"},
    {"symbol": "MARUTI", "company": "Maruti Suzuki"},
    {"symbol": "LT", "company": "Larsen & Toubro"},
    {"symbol": "BAJAJFINSV", "company": "Bajaj Finserv"},
    {"symbol": "ICICIBANK", "company": "ICICI Bank"}
]


def generate_html_report(test_results, start_time, end_time, status, error_details=None):
    """
    Generate a comprehensive HTML report for email notification.
    """
    duration = (end_time - start_time).total_seconds()
    
    # Determine status color and icon
    status_color = "#28a745" if status == "PASSED" else "#dc3545"
    status_icon = "✓" if status == "PASSED" else "✗"
    
    # Build test steps HTML
    steps_html = ""
    for step in test_results:
        step_status = step['status']
        step_color = "#28a745" if step_status == "PASS" else "#dc3545"
        step_icon = "✓" if step_status == "PASS" else "✗"
        
        steps_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
                <span style="color: {step_color}; font-weight: bold; margin-right: 8px;">{step_icon}</span>
                {step['step_number']}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">{step['description']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
                <span style="color: {step_color}; font-weight: bold;">{step_status}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">{step['timestamp']}</td>
        </tr>
        """
    
    # Error section (only if failed)
    error_section = ""
    if error_details:
        error_section = f"""
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #721c24; margin-top: 0;">Error Details</h3>
            <p><strong>Failed At:</strong> {error_details.get('step', 'N/A')}</p>
            <p><strong>URL:</strong> {error_details.get('url', 'N/A')}</p>
            <p><strong>Error Type:</strong> {error_details.get('type', 'N/A')}</p>
            <p><strong>Error Message:</strong></p>
            <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">{error_details.get('message', 'N/A')}</pre>
            <p><strong>Screenshot:</strong> {error_details.get('screenshot', 'Not captured')}</p>
        </div>
        """
    
    html_template = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smoke Test Report</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 30px;">
            
            <!-- Header -->
            <div style="text-align: center; border-bottom: 3px solid {status_color}; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #2c3e50; margin: 0 0 10px 0;">ShariaStocks Smoke Test Report</h1>
                <p style="color: #7f8c8d; margin: 0; font-size: 14px;">Automated Test Execution Report</p>
            </div>
            
            <!-- Summary Section -->
            <div style="background-color: {status_color}; color: white; border-radius: 5px; padding: 20px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; display: flex; align-items: center;">
                    <span style="font-size: 32px; margin-right: 10px;">{status_icon}</span>
                    Test Status: {status}
                </h2>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div>
                        <p style="margin: 5px 0;"><strong>Start Time:</strong> {start_time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                        <p style="margin: 5px 0;"><strong>End Time:</strong> {end_time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                    </div>
                    <div>
                        <p style="margin: 5px 0;"><strong>Duration:</strong> {duration:.2f} seconds</p>
                        <p style="margin: 5px 0;"><strong>Application:</strong> {BASE_URL}</p>
                    </div>
                </div>
            </div>
            
            <!-- Test Steps Table -->
            <div style="margin-bottom: 30px;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Test Execution Steps</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background-color: #3498db; color: white;">
                            <th style="padding: 12px; text-align: left; width: 15%;">Step</th>
                            <th style="padding: 12px; text-align: left; width: 45%;">Description</th>
                            <th style="padding: 12px; text-align: left; width: 15%;">Status</th>
                            <th style="padding: 12px; text-align: left; width: 25%;">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {steps_html}
                    </tbody>
                </table>
            </div>
            
            {error_section}
            
            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #7f8c8d; font-size: 12px;">
                <p>This is an automated test report generated by Jenkins CI/CD Pipeline</p>
                <p>Build: ${{BUILD_NUMBER}} | Job: ${{JOB_NAME}}</p>
                <p>Jenkins URL: ${{BUILD_URL}}</p>
            </div>
            
        </div>
    </body>
    </html>
    """
    
    return html_template


# def run_smoke_test():
def test_smoke_test():
    """
    Execute the smoke test and return results.
    """
    start_time = datetime.now()
    test_results = []
    current_step = ""
    driver = None
    final_status = "PASSED"
    error_details = None
    
    # Select a random stock symbol
    selected_stock = random.choice(STOCK_SYMBOLS)
    stock_symbol = selected_stock["symbol"]
    stock_company = selected_stock["company"]
    
    try:
        # Set up Chrome options
        chrome_options = webdriver.ChromeOptions()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        driver = webdriver.Chrome(
            service=ChromeService(ChromeDriverManager().install()), 
            options=chrome_options
        )
        wait = WebDriverWait(driver, 20)
        
        # Step 1: Load Landing Page
        current_step = "Step 1: Load Landing Page"
        driver.get(BASE_URL)
        wait.until(EC.title_contains("ShariaStocks | Halal Stock Screening"))
        test_results.append({
            'step_number': 'Step 1',
            'description': 'Load Landing Page',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 2: Navigate to Login
        current_step = "Step 2: Navigate to Login Page"
        login_button_header = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//header//button[normalize-space()='Log In']"))
        )
        login_button_header.click()
        wait.until(EC.url_contains("/login"))
        test_results.append({
            'step_number': 'Step 2',
            'description': 'Navigate to Login Page',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 3: Submit Credentials
        current_step = "Step 3: Submit Login Credentials"
        email_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='email-input']"))
        )
        password_input = driver.find_element(By.CSS_SELECTOR, "[data-testid='password-input']")
        submit_button = driver.find_element(By.CSS_SELECTOR, "[data-testid='login-button']")
        email_input.send_keys(TEST_EMAIL)
        password_input.send_keys(TEST_PASSWORD)
        submit_button.click()
        test_results.append({
            'step_number': 'Step 3',
            'description': 'Submit Login Credentials',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 4: Verify Login & Dashboard
        current_step = "Step 4: Verify Successful Login"
        wait.until(lambda d: d.execute_script("return localStorage.getItem('userId');"))
        wait.until(EC.url_contains("/dashboard"))
        wait.until(EC.visibility_of_element_located(
            (By.XPATH, "//h1[contains(text(), 'Invest with Purpose')]"))
        )
        test_results.append({
            'step_number': 'Step 4',
            'description': 'Verify Successful Login and Dashboard Load',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 5: Perform Search
        current_step = f"Step 5: Perform Stock Search for '{stock_symbol}'"
        search_input = wait.until(EC.visibility_of_element_located(
            (By.XPATH, "//input[@placeholder='Search for stocks (e.g., RELIANCE, HDFCBANK)']"))
        )
        search_button = driver.find_element(By.CSS_SELECTOR, "button[aria-label='Search']")
        search_input.send_keys(stock_symbol)
        search_button.click()
        test_results.append({
            'step_number': 'Step 5',
            'description': f"Perform Stock Search for '{stock_symbol}'",
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 6: Verify Search Results
        current_step = f"Step 6: Verify Search Results Page for '{stock_symbol}'"
        # wait.until(EC.url_contains(f"/stockresults/{stock_symbol}"))
        wait.until(EC.url_contains("/stockresults/"))
        stock_name_heading = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='company-name']"))
        )
        assert stock_company in stock_name_heading.text
        test_results.append({
            'step_number': 'Step 6',
            'description': f"Verify Search Results for '{stock_symbol}'",
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 7: Navigate to Profile
        current_step = "Step 7: Navigate to Profile Page"
        profile_button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='desktop-profile-icon']"))
        )
        profile_button.click()
        wait.until(EC.url_contains("/profile"))
        test_results.append({
            'step_number': 'Step 7',
            'description': 'Navigate to Profile Page',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 8: Perform Logout
        current_step = "Step 8: Perform Logout"
        logout_button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='logout-button']"))
        )
        logout_button.click()
        test_results.append({
            'step_number': 'Step 8',
            'description': 'Click Logout Button',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        # Step 9: Verify Logout
        current_step = "Step 9: Verify Successful Logout"
        wait.until(EC.url_contains("/login"))
        email_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='email-input']"))
        )
        assert email_input.is_displayed()
        test_results.append({
            'step_number': 'Step 9',
            'description': 'Verify Successful Logout',
            'status': 'PASS',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
    except (TimeoutException, NoSuchElementException, AssertionError) as e:
        final_status = "FAILED"
        
        # Capture screenshot
        screenshot_path = "SCREENSHOT NOT CAPTURED"
        try:
            screenshot_path = os.path.join(os.getcwd(), "test_failure_screenshot.png")
            driver.save_screenshot(screenshot_path)
            screenshot_path = f"Screenshot saved: {screenshot_path}"
        except:
            pass
        
        # Record failed step
        test_results.append({
            'step_number': current_step.split(':')[0],
            'description': current_step.split(':', 1)[1].strip() if ':' in current_step else current_step,
            'status': 'FAIL',
            'timestamp': datetime.now().strftime('%H:%M:%S')
        })
        
        error_details = {
            'step': current_step,
            'url': driver.current_url if driver else 'N/A',
            'type': type(e).__name__,
            'message': str(e),
            'screenshot': screenshot_path,
            'traceback': traceback.format_exc()
        }
        
    except Exception as e:
        final_status = "FAILED"
        error_details = {
            'step': current_step or 'Unknown',
            'url': driver.current_url if driver else 'N/A',
            'type': type(e).__name__,
            'message': str(e),
            'screenshot': 'Not captured',
            'traceback': traceback.format_exc()
        }
        
    finally:
        if driver:
            driver.quit()
    
    end_time = datetime.now()
    
    # Generate HTML report
    html_report = generate_html_report(test_results, start_time, end_time, final_status, error_details)
    
    # Save HTML report to file
    report_path = os.path.join(os.getcwd(), "smoke_test_report.html")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html_report)
    
    # print(f"\n{'='*60}")
    # print(f"SMOKE TEST {final_status}")
    # print(f"{'='*60}")
    # print(f"HTML Report saved to: {report_path}")
    # print(f"Total Steps: {len(test_results)}")
    # print(f"Duration: {(end_time - start_time).total_seconds():.2f} seconds")
    # print(f"{'='*60}\n")
    print(f"\n{'='*60}")
    print(f"SMOKE TEST {final_status}")
    print(f"{'='*60}")
    print(f"HTML Report saved to: {report_path}")
    print(f"Total Steps: {len(test_results)}")
    print(f"Duration: {(end_time - start_time).total_seconds():.2f} seconds")
    print(f"{'='*60}\n")
    
    # Return exit code (0 for success, 1 for failure)
    # return 0 if final_status == "PASSED" else 1
    assert final_status == "PASSED", f"Smoke test failed: {error_details}"


# if __name__ == "__main__":
#     exit_code = run_smoke_test()
#     sys.exit(exit_code)