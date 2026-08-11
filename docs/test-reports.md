# Test Reports

Run the backend test suite and generate reports with:

```powershell
backend\.venv\Scripts\python.exe scripts\run_pytest_reports.py
```

The command writes:

- `reports\dashboard.html` - summary dashboard with totals, failures, per-file results, and slow tests.
- `reports\junit.xml` - JUnit XML output from pytest.
- `reports\pytest-output.txt` - full pytest console output.

You can pass normal pytest arguments after the script name:

```powershell
backend\.venv\Scripts\python.exe scripts\run_pytest_reports.py backend\tests\test_auth_login_reset.py -k reset
```

The script exits with pytest's exit code, so it can be used in CI.
