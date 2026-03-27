const fs = require('fs');

const HTML_TEMPLATE = `
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: {color}; color: white; padding: 10px; }
        .content { padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Playwright E2E Test Report: {status}</h2>
        <p>Date: {date}</p>
    </div>
    <div class="content">
        <h3>Execution Log</h3>
        <table>
            <tr><th>Timestamp</th><th>Test Name</th><th>Status</th></tr>
            {rows}
        </table>
        {error_section}
    </div>
</body>
</html>
`;

class CustomHtmlReporter {
  constructor() {
    this.logs = [];
    this.hasFailure = false;
    this.errorMsg = '';
  }

  onTestEnd(test, result) {
    const timestamp = new Date().toLocaleTimeString();
    const status = result.status === 'passed' ? 'SUCCESS' : (result.status === 'failed' || result.status === 'timedOut' ? 'ERROR' : 'INFO');
    
    // Only log failures and info, do not clutter with successful tests
    if (status !== 'SUCCESS') {
      this.logs.push({
        time: timestamp,
        step: test.title,
        status: status
      });
    } else {
      // Keep track of total passed
      this.passedCount = (this.passedCount || 0) + 1;
    }
    
    if (status === 'ERROR') {
      this.hasFailure = true;
      if (result.error) {
        this.errorMsg += `Test: ${test.title}\nError: ${result.error.message}\n\n`;
      }
    }
  }

  onEnd() {
    let rows = "";
    
    if (!this.hasFailure && this.logs.length === 0) {
      // All tests passed, no errors or info logs
      rows = `<tr><td colspan="3" style="text-align: center; font-weight: bold; color: green;">All ${this.passedCount || 0} tests passed successfully!</td></tr>`;
    } else {
      for (const log of this.logs) {
        const colorClass = log.status === 'SUCCESS' ? 'pass' : (log.status === 'ERROR' ? 'fail' : 'info');
        rows += `<tr><td>${log.time}</td><td>${log.step}</td><td class='${colorClass}'>${log.status}</td></tr>`;
      }
    }

    const success = !this.hasFailure;
    const status_text = success ? "PASSED" : "FAILED";
    const header_color = success ? "#4CAF50" : "#f44336";
    let error_section = "";

    if (!success) {
      const escapedError = this.errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      error_section = `<h3>Error Details</h3><pre>${escapedError || 'Tests failed.'}</pre><p><b>Check Jenkins artifacts for detailed Playwright report and trace.</b></p>`;
    }

    const htmlContent = HTML_TEMPLATE
      .replace('{color}', header_color)
      .replace('{status}', status_text)
      .replace('{date}', new Date().toLocaleString())
      .replace('{rows}', rows)
      .replace('{error_section}', error_section);

    fs.writeFileSync('test_report.html', htmlContent, 'utf-8');
    console.log("Custom HTML Report generated: test_report.html");
  }
}

module.exports = CustomHtmlReporter;
