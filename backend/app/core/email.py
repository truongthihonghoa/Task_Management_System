import logging
import html
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path


logger = logging.getLogger(__name__)


def _verification_email_body(app_name: str, otp_code: str) -> str:
    return (
        f"{app_name}\n\n"
        f"Your email verification code is: {otp_code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "Security warning: If you did not request this code, ignore this email "
        "and do not share the code with anyone."
    )


def _logo_path() -> Path | None:
    configured_path = os.getenv("EMAIL_LOGO_PATH")
    candidates = []
    if configured_path:
        candidates.append(Path(configured_path))

    current_file = Path(__file__).resolve()
    candidates.extend(
        [
            current_file.parents[3] / "frontend" / "src" / "assets" / "taskflow-logo.png",
            current_file.parents[2] / "assets" / "taskflow-logo.png",
        ]
    )
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _notification_email_html(app_name: str, title: str, message: str, action_url: str | None = None) -> str:
    safe_app_name = html.escape(app_name)
    safe_title = html.escape(title)
    safe_action_url = html.escape(action_url or os.getenv("FRONTEND_URL", ""))
    message_lines = [line.strip() for line in message.splitlines() if line.strip()]
    primary_message = html.escape(message_lines[0]) if message_lines else ""
    detail_lines = message_lines[1:]
    logo_url = os.getenv("EMAIL_LOGO_URL")
    logo_path = _logo_path()
    if logo_url or logo_path is not None:
        logo_src = html.escape(logo_url) if logo_url else "cid:taskflow-logo"
        logo_markup = (
            f'<img src="{logo_src}" alt="{safe_app_name}" width="42" height="42" '
            'style="display:block;border-radius:10px;object-fit:contain;background:#ffffff;">'
        )
    else:
        logo_markup = (
            '<div style="width:42px;height:42px;border-radius:10px;background:#2563eb;'
            'color:#ffffff;font-size:21px;line-height:42px;text-align:center;font-weight:800;">T</div>'
        )

    details_markup = ""
    if detail_lines:
        details_markup = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">'
        for detail in detail_lines:
            if ":" in detail:
                label, value = detail.split(":", 1)
                safe_label = html.escape(label.strip())
                safe_value = html.escape(value.strip())
                details_markup += f"""
                  <tr>
                    <td style="padding:13px 16px;width:110px;color:#64748b;font-size:13px;font-weight:700;border-bottom:1px solid #eef2f7;">{safe_label}</td>
                    <td style="padding:13px 16px;color:#1f2937;font-size:14px;border-bottom:1px solid #eef2f7;">{safe_value}</td>
                  </tr>
                """
            else:
                safe_detail = html.escape(detail)
                details_markup += f"""
                  <tr>
                    <td colspan="2" style="padding:13px 16px;color:#1f2937;font-size:14px;border-bottom:1px solid #eef2f7;">{safe_detail}</td>
                  </tr>
                """
        details_markup += "</table>"

    action_button = ""
    if safe_action_url:
        action_button = f"""
        <tr>
          <td style="padding: 6px 34px 28px;">
            <a href="{safe_action_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:8px;">
              Open TaskFlow
            </a>
          </td>
        </tr>
        """

    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px;overflow:hidden;box-shadow:0 16px 36px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#ffffff;padding:24px 34px 18px;border-bottom:1px solid #eef2f7;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;width:42px;">
                      {logo_markup}
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <div style="font-size:20px;font-weight:800;color:#111827;">{safe_app_name}</div>
                      <div style="font-size:13px;color:#64748b;margin-top:3px;">Notification</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 34px 10px;">
                <div style="display:inline-block;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;margin-bottom:15px;">
                  New update
                </div>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;font-weight:800;">{safe_title}</h1>
                <div style="margin:0;font-size:15px;line-height:1.65;color:#334155;">{primary_message}</div>
                {details_markup}
              </td>
            </tr>
            {action_button}
            <tr>
              <td style="padding:0 34px 30px;">
                <div style="height:1px;background:#e5e7eb;margin-bottom:14px;"></div>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  You received this email because your {safe_app_name} notification preferences allow email delivery for this type of notification.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _send_email(email: str, subject: str, body: str, html_body: str | None = None) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("EMAIL_FROM") or os.getenv("SMTP_FROM") or smtp_user or "no-reply@taskflow.local"
    from_name = os.getenv("EMAIL_FROM_NAME")
    smtp_from = formataddr((from_name, from_email)) if from_name else from_email
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not smtp_host:
        logger.warning("SMTP_HOST is not configured. Email for %s:\n%s", email, body)
        return

    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = email
    message["Subject"] = subject
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
        logo_path = _logo_path()
        if logo_path is not None and not os.getenv("EMAIL_LOGO_URL"):
            html_part = message.get_payload()[-1]
            html_part.add_related(
                logo_path.read_bytes(),
                maintype="image",
                subtype=logo_path.suffix.lstrip(".").lower() or "png",
                cid="<taskflow-logo>",
            )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
        if smtp_use_tls:
            smtp.starttls()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)


def send_verification_email(email: str, otp_code: str) -> None:
    app_name = os.getenv("APP_NAME", "TaskFlow")
    subject = f"{app_name} email verification code"
    body = _verification_email_body(app_name, otp_code)
    _send_email(email, subject, body)


def send_notification_email(email: str, *, title: str, message: str, action_url: str | None = None) -> None:
    app_name = os.getenv("APP_NAME", "TaskFlow")
    subject = f"{app_name}: {title}"
    body = f"{app_name}\n\n{title}\n\n{message}"
    html_body = _notification_email_html(app_name, title, message, action_url=action_url)
    _send_email(email, subject, body, html_body=html_body)
