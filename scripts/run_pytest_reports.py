from __future__ import annotations

import argparse
import html
import platform
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT_DIR = REPO_ROOT / "reports"
DEFAULT_TEST_TARGET = "backend"


@dataclass(frozen=True)
class TestCase:
    classname: str
    name: str
    status: str
    duration: float
    message: str

    @property
    def nodeid(self) -> str:
        class_path = self.classname.replace(".", "/")
        return f"{class_path}::{self.name}" if class_path else self.name


def parse_args() -> tuple[argparse.Namespace, list[str]]:
    parser = argparse.ArgumentParser(
        description="Run pytest and generate JUnit XML plus an HTML dashboard."
    )
    parser.add_argument(
        "--report-dir",
        default=str(DEFAULT_REPORT_DIR),
        help="Directory where reports are written.",
    )
    args, pytest_args = parser.parse_known_args()
    return args, pytest_args


def run_pytest(pytest_args: list[str], report_dir: Path) -> int:
    report_dir.mkdir(parents=True, exist_ok=True)
    junit_path = report_dir / "junit.xml"
    output_path = report_dir / "pytest-output.txt"

    command = [
        sys.executable,
        "-m",
        "pytest",
        *(pytest_args or [DEFAULT_TEST_TARGET]),
        f"--junitxml={junit_path}",
    ]

    process = subprocess.run(
        command,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    output_path.write_text(process.stdout, encoding="utf-8")
    return process.returncode


def collect_cases(junit_path: Path) -> list[TestCase]:
    if not junit_path.exists():
        return []

    root = ElementTree.parse(junit_path).getroot()
    cases: list[TestCase] = []

    for testcase in root.iter("testcase"):
        status = "passed"
        message = ""
        for candidate in ("failure", "error", "skipped"):
            element = testcase.find(candidate)
            if element is not None:
                status = candidate
                message = element.attrib.get("message") or (element.text or "")
                break

        cases.append(
            TestCase(
                classname=testcase.attrib.get("classname", ""),
                name=testcase.attrib.get("name", ""),
                status=status,
                duration=float(testcase.attrib.get("time", "0") or 0),
                message=message.strip(),
            )
        )

    return cases


def summarize_by_file(cases: Iterable[TestCase]) -> list[dict[str, object]]:
    grouped: dict[str, list[TestCase]] = defaultdict(list)
    for case in cases:
        file_name = case.classname.replace(".", "/") or "unknown"
        grouped[file_name].append(case)

    summaries = []
    for file_name, file_cases in grouped.items():
        counts = Counter(case.status for case in file_cases)
        duration = sum(case.duration for case in file_cases)
        summaries.append(
            {
                "file_name": file_name,
                "total": len(file_cases),
                "passed": counts["passed"],
                "failure": counts["failure"],
                "error": counts["error"],
                "skipped": counts["skipped"],
                "duration": duration,
            }
        )

    return sorted(
        summaries,
        key=lambda item: (
            int(item["failure"]) + int(item["error"]),
            float(item["duration"]),
        ),
        reverse=True,
    )


def status_label(status: str) -> str:
    return {
        "passed": "Passed",
        "failure": "Failed",
        "error": "Error",
        "skipped": "Skipped",
    }.get(status, status.title())


def percent(part: int, total: int) -> str:
    if total == 0:
        return "0.0%"
    return f"{part / total * 100:.1f}%"


def render_dashboard(cases: list[TestCase], report_dir: Path, exit_code: int) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    dashboard_path = report_dir / "dashboard.html"
    counts = Counter(case.status for case in cases)
    total = len(cases)
    passed = counts["passed"]
    failed = counts["failure"]
    errors = counts["error"]
    skipped = counts["skipped"]
    duration = sum(case.duration for case in cases)
    pass_rate = passed / total * 100 if total else 0
    passed_stop = percent(passed, total)
    failed_stop = percent(passed + failed, total)
    error_stop = percent(passed + failed + errors, total)
    skipped_stop = percent(passed + failed + errors + skipped, total)
    max_count = max(passed, failed, errors, skipped, 1)
    passed_height = max(8, passed / max_count * 150)
    failed_height = max(8, failed / max_count * 150) if failed else 8
    error_height = max(8, errors / max_count * 150) if errors else 8
    skipped_height = max(8, skipped / max_count * 150) if skipped else 8
    generated_at = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    failing_cases = [case for case in cases if case.status in {"failure", "error"}]
    slow_cases = sorted(cases, key=lambda case: case.duration, reverse=True)[:10]
    file_summaries = summarize_by_file(cases)

    file_rows = "\n".join(
        f"""
        <tr>
          <td>{html.escape(str(item["file_name"]))}</td>
          <td>{item["total"]}</td>
          <td class="pass">{item["passed"]}</td>
          <td class="fail">{item["failure"]}</td>
          <td class="error">{item["error"]}</td>
          <td class="skip">{item["skipped"]}</td>
          <td>{float(item["duration"]):.2f}s</td>
        </tr>
        """
        for item in file_summaries
    )

    failure_cards = "\n".join(
        f"""
        <article class="failure-card">
          <div class="failure-head">
            <span class="pill {case.status}">{status_label(case.status)}</span>
            <span class="failure-duration">{case.duration:.2f}s</span>
          </div>
          <h3>{html.escape(case.nodeid)}</h3>
          <pre>{html.escape(case.message[:1200])}</pre>
        </article>
        """
        for case in failing_cases
    ) or '<div class="empty empty-card">No failing tests.</div>'

    slow_rows = "\n".join(
        f"""
        <tr>
          <td>{html.escape(case.nodeid)}</td>
          <td><span class="pill {case.status}">{status_label(case.status)}</span></td>
          <td>{case.duration:.2f}s</td>
        </tr>
        """
        for case in slow_cases
    ) or '<tr><td colspan="3" class="empty">No test cases found.</td></tr>'

    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pytest Dashboard</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --ink: #172033;
      --muted: #657084;
      --line: #dfe4ec;
      --pass: #12805c;
      --fail: #d92d20;
      --error: #a54800;
      --skip: #6b5e00;
      --accent: #315fce;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }}
    main {{
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 44px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }}
    h1, h2 {{ margin: 0; }}
    h1 {{ font-size: 30px; }}
    h2 {{ font-size: 18px; margin-bottom: 14px; }}
    .meta {{ color: var(--muted); margin-top: 6px; }}
    .status {{
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      padding: 12px 14px;
      min-width: 190px;
      text-align: right;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }}
    .metric, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .metric {{ padding: 16px; }}
    .metric span {{
      display: block;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
    }}
    .metric strong {{
      display: block;
      font-size: 28px;
      margin-top: 4px;
    }}
    .pass {{ color: var(--pass); }}
    .fail {{ color: var(--fail); }}
    .error {{ color: var(--error); }}
    .skip {{ color: var(--skip); }}
    .bar {{
      display: flex;
      height: 12px;
      overflow: hidden;
      border-radius: 999px;
      background: #e9edf5;
      margin: 4px 0 22px;
    }}
    .bar > div {{ min-width: 0; }}
    .bar .pass-bg {{ background: var(--pass); }}
    .bar .fail-bg {{ background: var(--fail); }}
    .bar .error-bg {{ background: var(--error); }}
    .bar .skip-bg {{ background: #b29d00; }}
    .visuals {{
      display: grid;
      grid-template-columns: 1.1fr 0.9fr 1.2fr;
      gap: 16px;
      margin: 18px 0 22px;
    }}
    .visual-card {{
      min-height: 260px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
    }}
    .chart-center {{
      display: grid;
      place-items: center;
      min-height: 190px;
    }}
    .donut {{
      width: 184px;
      aspect-ratio: 1;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at center, var(--panel) 0 53%, transparent 54%),
        conic-gradient(
          var(--pass) 0 {passed_stop},
          var(--fail) {passed_stop} {failed_stop},
          var(--error) {failed_stop} {error_stop},
          #b29d00 {error_stop} {skipped_stop},
          #e9edf5 {skipped_stop} 100%
        );
      box-shadow: inset 0 8px 18px rgba(255, 255, 255, 0.75), 0 18px 30px rgba(23, 32, 51, 0.12);
    }}
    .donut strong {{
      display: block;
      font-size: 28px;
      text-align: center;
    }}
    .donut span {{
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }}
    .legend {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }}
    .legend span::before {{
      content: "";
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 7px;
      vertical-align: -1px;
      background: currentColor;
    }}
    .sphere {{
      position: relative;
      width: 176px;
      aspect-ratio: 1;
      border-radius: 50%;
      display: grid;
      place-items: center;
      overflow: hidden;
      background:
        radial-gradient(circle at 68% 74%, rgba(0, 0, 0, 0.22) 0 18%, transparent 42%),
        conic-gradient(var(--pass) 0 {passed_stop}, var(--fail) {passed_stop} 100%);
      box-shadow: inset -22px -24px 34px rgba(0, 0, 0, 0.22), inset 18px 18px 28px rgba(255, 255, 255, 0.38), 0 22px 34px rgba(23, 32, 51, 0.16);
    }}
    .sphere::after {{
      content: "";
      position: absolute;
      inset: 14%;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.38);
    }}
    .sphere strong {{
      position: relative;
      z-index: 1;
      color: #fff;
      font-size: 30px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }}
    .cylinders {{
      height: 190px;
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      gap: 18px;
      padding: 18px 6px 2px;
    }}
    .cylinder-wrap {{
      width: 64px;
      text-align: center;
    }}
    .cylinder {{
      position: relative;
      width: 48px;
      height: var(--height);
      min-height: 8px;
      margin: 0 auto;
      border-radius: 999px / 18px;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.45), transparent 28%, rgba(0,0,0,0.12) 72%, rgba(255,255,255,0.22)),
        var(--color);
      box-shadow: inset -10px 0 18px rgba(0, 0, 0, 0.12), 0 12px 20px rgba(23, 32, 51, 0.14);
    }}
    .cylinder::before {{
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: -8px;
      height: 16px;
      border-radius: 50%;
      background:
        radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.8), rgba(255,255,255,0.18) 38%, rgba(0,0,0,0.12) 72%),
        var(--color);
    }}
    .cylinder::after {{
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -8px;
      height: 16px;
      border-radius: 50%;
      background: var(--color);
      filter: brightness(0.82);
    }}
    .cylinder-wrap strong {{
      display: block;
      margin-top: 14px;
      color: var(--ink);
    }}
    .cylinder-wrap span {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }}
    section {{ padding: 18px; margin-top: 16px; overflow-x: auto; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{
      padding: 10px 8px;
      border-top: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }}
    pre {{
      margin: 0;
      max-width: 520px;
      white-space: pre-wrap;
      color: #384255;
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
    }}
    a {{ color: var(--accent); }}
    .links {{ display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }}
    .pill {{
      display: inline-block;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 700;
      background: #eef2f8;
    }}
    .pill.passed {{ color: var(--pass); }}
    .pill.failure {{ color: var(--fail); }}
    .pill.error {{ color: var(--error); }}
    .pill.skipped {{ color: var(--skip); }}
    .empty {{ color: var(--muted); text-align: center; }}
    .empty-card {{
      padding: 28px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      background: #fbfcfe;
    }}
    .failure-list {{
      display: grid;
      gap: 12px;
    }}
    .failure-card {{
      border: 1px solid var(--line);
      border-left: 5px solid var(--fail);
      border-radius: 8px;
      background: #ffffff;
      padding: 14px 16px 16px;
    }}
    .failure-head {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }}
    .failure-duration {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }}
    .failure-card h3 {{
      margin: 0 0 10px;
      color: var(--ink);
      font-size: 15px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }}
    .failure-card pre {{
      max-width: none;
      padding: 12px;
      border-radius: 8px;
      background: #f7f8fb;
      border: 1px solid #e6ebf2;
    }}
    @media (max-width: 820px) {{
      header {{ display: block; }}
      .status {{ text-align: left; margin-top: 14px; }}
      .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
      .visuals {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Pytest Dashboard</h1>
        <div class="meta">Generated {html.escape(generated_at)} on Python {platform.python_version()} ({html.escape(platform.system())})</div>
      </div>
      <div class="status">
        <strong>{"Passed" if exit_code == 0 else "Needs attention"}</strong>
        <div class="meta">pytest exit code: {exit_code}</div>
        <div class="links">
          <a href="junit.xml">JUnit XML</a>
          <a href="pytest-output.txt">Console output</a>
        </div>
      </div>
    </header>

    <div class="grid" aria-label="Test result summary">
      <div class="metric"><span>Total</span><strong>{total}</strong></div>
      <div class="metric"><span>Passed</span><strong class="pass">{passed}</strong></div>
      <div class="metric"><span>Failed</span><strong class="fail">{failed}</strong></div>
      <div class="metric"><span>Errors</span><strong class="error">{errors}</strong></div>
      <div class="metric"><span>Skipped</span><strong class="skip">{skipped}</strong></div>
    </div>

    <div class="bar" title="Passed {percent(passed, total)}, failed {percent(failed, total)}, errors {percent(errors, total)}, skipped {percent(skipped, total)}">
      <div class="pass-bg" style="width: {percent(passed, total)}"></div>
      <div class="fail-bg" style="width: {percent(failed, total)}"></div>
      <div class="error-bg" style="width: {percent(errors, total)}"></div>
      <div class="skip-bg" style="width: {percent(skipped, total)}"></div>
    </div>

    <div class="visuals" aria-label="Visual test result charts">
      <div class="visual-card">
        <h2>Result Donut</h2>
        <div class="chart-center">
          <div class="donut">
            <div>
              <strong>{total}</strong>
              <span>Tests</span>
            </div>
          </div>
        </div>
        <div class="legend">
          <span class="pass">Passed {percent(passed, total)}</span>
          <span class="fail">Failed {percent(failed, total)}</span>
          <span class="error">Errors {percent(errors, total)}</span>
          <span class="skip">Skipped {percent(skipped, total)}</span>
        </div>
      </div>

      <div class="visual-card">
        <h2>Pass Sphere</h2>
        <div class="chart-center">
          <div class="sphere"><strong>{pass_rate:.1f}%</strong></div>
        </div>
        <div class="meta">Green shows passed tests; red shows failed tests.</div>
      </div>

      <div class="visual-card">
        <h2>3D Result Cylinders</h2>
        <div class="cylinders">
          <div class="cylinder-wrap">
            <div class="cylinder" style="--height: {passed_height:.1f}px; --color: var(--pass);"></div>
            <strong>{passed}</strong>
            <span>Passed</span>
          </div>
          <div class="cylinder-wrap">
            <div class="cylinder" style="--height: {failed_height:.1f}px; --color: var(--fail);"></div>
            <strong>{failed}</strong>
            <span>Failed</span>
          </div>
          <div class="cylinder-wrap">
            <div class="cylinder" style="--height: {error_height:.1f}px; --color: var(--error);"></div>
            <strong>{errors}</strong>
            <span>Errors</span>
          </div>
          <div class="cylinder-wrap">
            <div class="cylinder" style="--height: {skipped_height:.1f}px; --color: #b29d00;"></div>
            <strong>{skipped}</strong>
            <span>Skipped</span>
          </div>
        </div>
      </div>
    </div>

    <section>
      <h2>Failures And Errors</h2>
      <div class="failure-list">{failure_cards}</div>
    </section>

    <section>
      <h2>Results By File</h2>
      <table>
        <thead><tr><th>File</th><th>Total</th><th>Passed</th><th>Failed</th><th>Errors</th><th>Skipped</th><th>Duration</th></tr></thead>
        <tbody>{file_rows or '<tr><td colspan="7" class="empty">No test cases found.</td></tr>'}</tbody>
      </table>
    </section>

    <section>
      <h2>Slowest Tests</h2>
      <table>
        <thead><tr><th>Test</th><th>Status</th><th>Duration</th></tr></thead>
        <tbody>{slow_rows}</tbody>
      </table>
    </section>

    <p class="meta">Total runtime reported by JUnit: {duration:.2f}s.</p>
  </main>
</body>
</html>
"""
    dashboard_path.write_text(html_doc, encoding="utf-8")
    return dashboard_path


def main() -> int:
    args, pytest_args = parse_args()
    report_dir = Path(args.report_dir).resolve()
    exit_code = run_pytest(pytest_args, report_dir)
    cases = collect_cases(report_dir / "junit.xml")
    dashboard_path = render_dashboard(cases, report_dir, exit_code)
    print(f"Pytest reports written to {report_dir}")
    print(f"Dashboard: {dashboard_path}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
