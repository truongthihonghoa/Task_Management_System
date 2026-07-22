"""
Email service for TaskFlow.

Responsibilities:
- Send verification OTP emails.
- Send notification emails.
- Support plain-text and HTML content.
- Support SMTP authentication and STARTTLS.
- Support embedded logo or external logo URL.
"""

import html
import logging
import os
import smtplib
import ssl

from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path


logger = logging.getLogger(__name__)


class EmailService:
    """Reusable email service for sending emails through SMTP."""

    def __init__(self) -> None:
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))

        # Hỗ trợ cả SMTP_USERNAME và SMTP_USER
        self.smtp_username = (
            os.getenv("SMTP_USERNAME")
            or os.getenv("SMTP_USER")
        )
        self.smtp_password = os.getenv("SMTP_PASSWORD")

        # Hỗ trợ cả EMAIL_FROM và SMTP_FROM
        self.email_from = (
            os.getenv("EMAIL_FROM")
            or os.getenv("SMTP_FROM")
            or self.smtp_username
            or "no-reply@taskflow.local"
        )

        self.email_from_name = os.getenv(
            "EMAIL_FROM_NAME",
            "TaskFlow",
        )
        self.smtp_use_tls = (
            os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        )
        self.smtp_use_ssl = (
            os.getenv("SMTP_USE_SSL", "false").lower() == "true"
            or self.smtp_port == 465
        )

        self.otp_expire_minutes = int(
            os.getenv("OTP_EXPIRE_MINUTES", "15")
        )
        self.app_name = os.getenv("APP_NAME", "TaskFlow")

    def _validate_config(self) -> None:
        """Validate required SMTP configuration."""

        if not self.smtp_host:
            raise ValueError(
                "SMTP_HOST environment variable is not configured."
            )

        if not self.smtp_username:
            raise ValueError(
                "SMTP_USERNAME environment variable is not configured."
            )

        if not self.smtp_password:
            raise ValueError(
                "SMTP_PASSWORD environment variable is not configured."
            )

        if not self.email_from:
            raise ValueError(
                "EMAIL_FROM environment variable is not configured."
            )

    def _logo_path(self) -> Path | None:
        """Find a local TaskFlow logo file."""

        if os.getenv("EMAIL_EMBED_LOGO", "false").lower() != "true":
            return None

        configured_path = os.getenv("EMAIL_LOGO_PATH")
        candidates: list[Path] = []

        if configured_path:
            candidates.append(Path(configured_path))

        current_file = Path(__file__).resolve()

        candidates.extend(
            [
                (
                    current_file.parents[3]
                    / "frontend"
                    / "src"
                    / "assets"
                    / "taskflow-logo.png"
                ),
                (
                    current_file.parents[2]
                    / "assets"
                    / "taskflow-logo.png"
                ),
            ]
        )

        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return candidate

        return None

    def _verification_email_body(
        self,
        otp_code: str,
    ) -> str:
        """Create plain-text verification email content."""

        return (
            f"{self.app_name}\n\n"
            f"Your email verification code is: {otp_code}\n\n"
            f"This code expires in "
            f"{self.otp_expire_minutes} minutes.\n\n"
            "Security warning: If you did not request this code, "
            "ignore this email and do not share the code with anyone."
        )

    def _verification_email_html(
        self,
        otp_code: str,
    ) -> str:
        """Create HTML verification email content."""

        safe_app_name = html.escape(self.app_name)
        safe_otp_code = html.escape(otp_code)

        logo_url = os.getenv("EMAIL_LOGO_URL")
        logo_path = self._logo_path()

        if logo_url or logo_path is not None:
            logo_src = (
                html.escape(logo_url)
                if logo_url
                else "cid:taskflow-logo"
            )

            logo_markup = (
                f'<img src="{logo_src}" '
                f'alt="{safe_app_name}" '
                'width="48" height="48" '
                'style="display:block;'
                'border-radius:10px;'
                'object-fit:contain;'
                'background:#ffffff;">'
            )
        else:
            logo_markup = (
                '<div style="'
                'width:48px;'
                'height:48px;'
                'border-radius:10px;'
                'background:#2563eb;'
                'color:#ffffff;'
                'font-size:24px;'
                'line-height:48px;'
                'text-align:center;'
                'font-weight:800;'
                '">T</div>'
            )

        return f"""<!doctype html>
<html>
  <body style="
      margin:0;
      padding:0;
      background:#f3f6fb;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
  ">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#f3f6fb;padding:28px 14px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              max-width:560px;
              background:#ffffff;
              border:1px solid #dbe3ef;
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 16px 36px rgba(15,23,42,0.08);
            "
          >
            <tr>
              <td style="
                  padding:24px 34px 18px;
                  border-bottom:1px solid #eef2f7;
              ">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                >
                  <tr>
                    <td style="
                        vertical-align:middle;
                        width:48px;
                    ">
                      {logo_markup}
                    </td>

                    <td style="
                        vertical-align:middle;
                        padding-left:14px;
                    ">
                      <div style="
                          font-size:20px;
                          font-weight:800;
                          color:#111827;
                      ">
                        {safe_app_name}
                      </div>

                      <div style="
                          font-size:13px;
                          color:#64748b;
                          margin-top:3px;
                      ">
                        Email Verification
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="
                  padding:30px 34px 10px;
                  text-align:center;
              ">
                <h1 style="
                    margin:0 0 12px;
                    font-size:24px;
                    color:#0f172a;
                    font-weight:800;
                ">
                  Verify your email
                </h1>

                <p style="
                    margin:0;
                    font-size:15px;
                    line-height:1.65;
                    color:#475569;
                ">
                  Your email verification code is:
                </p>

                <div style="
                    display:inline-block;
                    margin:24px 0;
                    padding:15px 30px;
                    background:#2563eb;
                    color:#ffffff;
                    border-radius:8px;
                    font-size:32px;
                    font-weight:800;
                    letter-spacing:6px;
                ">
                  {safe_otp_code}
                </div>

                <p style="
                    margin:0;
                    color:#64748b;
                    font-size:14px;
                ">
                  This code expires in
                  {self.otp_expire_minutes} minutes.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 34px 30px;">
                <div style="
                    padding:14px 16px;
                    border-radius:8px;
                    background:#fff1f2;
                    color:#be123c;
                    font-size:13px;
                    line-height:1.6;
                ">
                  <strong>Security warning:</strong>
                  If you did not request this code,
                  ignore this email and do not share the code
                  with anyone.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 34px 30px;">
                <div style="
                    height:1px;
                    background:#e5e7eb;
                    margin-bottom:14px;
                "></div>

                <p style="
                    margin:0;
                    font-size:12px;
                    line-height:1.6;
                    color:#64748b;
                ">
                  This is an automated message from
                  {safe_app_name}. Please do not reply.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    def _notification_email_html(
        self,
        title: str,
        message: str,
        action_url: str | None = None,
    ) -> str:
        """Create HTML content for a notification email."""

        safe_app_name = html.escape(self.app_name)
        safe_title = html.escape(title)

        safe_action_url = html.escape(
            action_url
            or os.getenv("FRONTEND_URL", "")
        )

        message_lines = [
            line.strip()
            for line in message.splitlines()
            if line.strip()
        ]

        primary_message = (
            html.escape(message_lines[0])
            if message_lines
            else ""
        )

        detail_lines = message_lines[1:]

        logo_url = os.getenv("EMAIL_LOGO_URL")

        if logo_url:
            logo_src = html.escape(logo_url)
            logo_markup = (
                f'<img src="{logo_src}" '
                f'alt="{safe_app_name}" '
                'width="44" height="44" '
                'style="display:block;'
                'border-radius:10px;'
                'object-fit:contain;'
                'background:#ffffff;">'
            )
        else:
            logo_markup = (
                '<div style="'
                'font-size:22px;'
                'line-height:1;'
                'font-weight:900;'
                'letter-spacing:0;'
                'color:#4C2B74;'
                '">TaskFlow</div>'
            )

        details_markup = ""

        if detail_lines:
            details_markup = (
                '<table role="presentation" '
                'width="100%" '
                'cellspacing="0" '
                'cellpadding="0" '
                'style="'
                'margin-top:18px;'
                'border:1px solid #E0D7F0;'
                'border-radius:10px;'
                'background:#FAF8FF;'
                '">'
            )

            for detail in detail_lines:
                if ":" in detail:
                    label, value = detail.split(":", 1)

                    safe_label = html.escape(label.strip())
                    safe_value = html.escape(value.strip())

                    details_markup += f"""
<tr>
  <td style="
      padding:13px 16px;
      width:110px;
      color:#6E5A8A;
      font-size:13px;
      font-weight:700;
      border-bottom:1px solid #E0D7F0;
  ">
    {safe_label}
  </td>

  <td style="
      padding:13px 16px;
      color:#1f2937;
      font-size:14px;
      border-bottom:1px solid #E0D7F0;
  ">
    {safe_value}
  </td>
</tr>
"""
                else:
                    safe_detail = html.escape(detail)

                    details_markup += f"""
<tr>
  <td
    colspan="2"
    style="
      padding:13px 16px;
      color:#1f2937;
      font-size:14px;
      border-bottom:1px solid #E0D7F0;
    "
  >
    {safe_detail}
  </td>
</tr>
"""

            details_markup += "</table>"

        action_button = ""

        if safe_action_url:
            action_button = f"""
<tr>
  <td style="padding:6px 34px 28px;">
    <a
      href="{safe_action_url}"
      style="
        display:inline-block;
        background:#6B4A91;
        color:#ffffff;
        text-decoration:none;
        font-weight:700;
        font-size:14px;
        padding:12px 18px;
        border-radius:8px;
      "
    >
      Open TaskFlow
    </a>
  </td>
</tr>
"""

        return f"""<!doctype html>
<html>
  <body style="
      margin:0;
      padding:0;
      background:#ffffff;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
  ">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#ffffff;padding:18px 12px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              max-width:640px;
              background:#ffffff;
              border:1px solid #E0D7F0;
              border-radius:14px;
              overflow:hidden;
              box-shadow:0 16px 42px rgba(76,43,116,0.12);
            "
          >
            <tr>
              <td style="
                  background:#FAF8FF;
                  padding:18px 28px;
                  border-bottom:1px solid #E0D7F0;
              ">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                >
                  <tr>
                    <td style="vertical-align:middle;">
                      {logo_markup}
                    </td>

                    <td style="
                        vertical-align:middle;
                        text-align:right;
                    ">
                      <div style="
                          display:inline-block;
                          background:#F0EDFF;
                          color:#4C2B74;
                          font-size:11px;
                          font-weight:800;
                          padding:6px 10px;
                          border-radius:999px;
                      ">
                        Notification
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px 10px;">
                <h1 style="
                    margin:0 0 10px;
                    font-size:22px;
                    line-height:1.3;
                    color:#0f172a;
                    font-weight:800;
                ">
                  {safe_title}
                </h1>

                <div style="
                    margin:0;
                    font-size:14px;
                    line-height:1.55;
                    color:#334155;
                ">
                  {primary_message}
                </div>

                {details_markup}
              </td>
            </tr>

            {action_button}

            <tr>
              <td style="padding:0 28px 24px;">
                <div style="
                    height:1px;
                    background:#E0D7F0;
                    margin-bottom:12px;
                "></div>

                <p style="
                    margin:0;
                    font-size:12px;
                    line-height:1.6;
                    color:#6E5A8A;
                ">
                  You received this email because your
                  {safe_app_name} notification preferences
                  allow email delivery for this notification.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    def _create_message(
        self,
        *,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str | None = None,
    ) -> EmailMessage:
        """Create an email message."""

        message = EmailMessage()

        message["From"] = formataddr(
            (
                self.email_from_name,
                self.email_from,
            )
        )
        message["To"] = to_email
        message["Subject"] = subject

        message.set_content(text_content)

        if html_content:
            message.add_alternative(
                html_content,
                subtype="html",
            )

            logo_path = self._logo_path()

            if (
                logo_path is not None
                and not os.getenv("EMAIL_LOGO_URL")
                and html_content is not None
                and "cid:taskflow-logo" in html_content
            ):
                try:
                    html_part = message.get_payload()[-1]

                    image_subtype = (
                        logo_path.suffix
                        .lstrip(".")
                        .lower()
                        or "png"
                    )

                    if image_subtype == "jpg":
                        image_subtype = "jpeg"

                    html_part.add_related(
                        logo_path.read_bytes(),
                        maintype="image",
                        subtype=image_subtype,
                        cid="<taskflow-logo>",
                    )
                except OSError as error:
                    logger.warning(
                        "Could not attach email logo %s: %s",
                        logo_path,
                        error,
                    )

        return message

    def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str | None = None,
    ) -> bool:
        """Send an email through SMTP."""

        try:
            self._validate_config()

            message = self._create_message(
                to_email=to_email,
                subject=subject,
                text_content=text_content,
                html_content=html_content,
            )

        except ValueError as error:
            logger.error(
                "SMTP configuration error: %s",
                error,
            )
            return False

        for attempt in range(1, 4):
            try:
                logger.info(
                    "Attempting to send email to %s (attempt %s)",
                    to_email,
                    attempt,
                )

                context = ssl.create_default_context()
                if self.smtp_use_ssl:
                    smtp = smtplib.SMTP_SSL(
                        self.smtp_host,
                        self.smtp_port,
                        timeout=30,
                        context=context,
                    )
                else:
                    smtp = smtplib.SMTP(
                        self.smtp_host,
                        self.smtp_port,
                        timeout=30,
                    )

                with smtp:
                    smtp.ehlo()

                    if self.smtp_use_tls and not self.smtp_use_ssl:
                        smtp.starttls(context=context)
                        smtp.ehlo()

                    smtp.login(
                        self.smtp_username,
                        self.smtp_password,
                    )

                    smtp.send_message(message)

                logger.info(
                    "Email sent successfully to %s",
                    to_email,
                )

                return True

            except smtplib.SMTPAuthenticationError as error:
                logger.error(
                    "SMTP authentication failed for %s: %s",
                    to_email,
                    error,
                )
                return False

            except smtplib.SMTPException as error:
                logger.warning(
                    "SMTP error sending email to %s on attempt %s: %s",
                    to_email,
                    attempt,
                    error,
                )

            except OSError as error:
                logger.warning(
                    "Network error sending email to %s on attempt %s: %s",
                    to_email,
                    attempt,
                    error,
                )

            except Exception:
                logger.exception(
                    "Unexpected error sending email to %s",
                    to_email,
                )
                return False

        return False

    def send_verification_email(self, to_email: str, otp_code: str) -> bool:
        """Send an email verification OTP."""
        subject = f"{self.app_name} - Email Verification"
        return self.send_email(
            to_email=to_email,
            subject=subject,
            text_content=self._verification_email_body(otp_code),
            html_content=self._verification_email_html(otp_code),
        )

    def send_password_reset_email(self, to_email: str, token_code: str) -> bool:
        """Send a password reset email containing a reset link and token."""
        import urllib.parse
        subject = f"{self.app_name} - Password Reset"
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        query = urllib.parse.urlencode({"email": to_email, "token": token_code})
        reset_path = f"/reset-password?{query}"
        reset_url = frontend_url.rstrip("/") + reset_path
        text_content = (
            f"Use the following link to reset your password: {reset_url}\n\n"
            f"Your password reset code is: {token_code}\n\n"
            f"This link and code expire in {self.otp_expire_minutes} minutes."
        )
        html_content = self._password_reset_email_html(reset_url)
        return self.send_email(
            to_email=to_email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
        )

    def _password_reset_email_html(self, reset_url: str) -> str:
        """Create HTML content for password reset email with a button link."""
        safe_app_name = html.escape(self.app_name)
        safe_reset_url = html.escape(reset_url)

        logo_url = os.getenv("EMAIL_LOGO_URL")
        if logo_url:
            logo_src = html.escape(logo_url)
            logo_markup = (
                f'<img src="{logo_src}" '
                f'alt="{safe_app_name}" '
                'width="44" height="44" '
                'style="display:block;'
                'border-radius:10px;'
                'object-fit:contain;'
                'background:#ffffff;">'
            )
        else:
            logo_markup = (
                '<div style="'
                'font-size:22px;'
                'line-height:1;'
                'font-weight:900;'
                'letter-spacing:0;'
                'color:#4C2B74;'
                '">TaskFlow</div>'
            )

        return f"""<!doctype html>
<html>
  <body style="
      margin:0;
      padding:0;
      background:#ffffff;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
  ">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#ffffff;padding:18px 12px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              max-width:640px;
              background:#ffffff;
              border:1px solid #E0D7F0;
              border-radius:14px;
              overflow:hidden;
              box-shadow:0 16px 42px rgba(76,43,116,0.12);
            "
          >
            <tr>
              <td style="
                  background:#FAF8FF;
                  padding:18px 28px;
                  border-bottom:1px solid #E0D7F0;
              ">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                >
                  <tr>
                    <td style="vertical-align:middle;">
                      {logo_markup}
                    </td>

                    <td style="
                        vertical-align:middle;
                        text-align:right;
                    ">
                      <div style="
                          display:inline-block;
                          background:#F0EDFF;
                          color:#4C2B74;
                          font-size:11px;
                          font-weight:800;
                          padding:6px 10px;
                          border-radius:999px;
                      ">
                        Password Reset
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px 10px;">
                <h1 style="
                    margin:0 0 10px;
                    font-size:22px;
                    line-height:1.3;
                    color:#0f172a;
                    font-weight:800;
                ">
                  Reset Your Password
                </h1>

                <div style="
                    margin:0;
                    font-size:14px;
                    line-height:1.55;
                    color:#334155;
                ">
                  We received a request to reset the password for your {safe_app_name} account. Use the button below to set a new password. This link will expire in {self.otp_expire_minutes} minutes.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 28px 20px;">
                <a
                  href="{safe_reset_url}"
                  style="
                    display:inline-block;
                    background:#6B4A91;
                    color:#ffffff;
                    text-decoration:none;
                    font-weight:700;
                    font-size:14px;
                    padding:12px 18px;
                    border-radius:8px;
                  "
                >
                  Reset Password
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 10px;">
                <div style="
                    margin:0;
                    font-size:12px;
                    line-height:1.5;
                    color:#6E5A8A;
                ">
                  Or copy & paste the following URL into your browser:<br>
                  <a href="{safe_reset_url}" style="color:#6B4A91; word-break:break-all;">{safe_reset_url}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px 24px;">
                <div style="
                    height:1px;
                    background:#E0D7F0;
                    margin-bottom:12px;
                "></div>

                <p style="
                    margin:0;
                    font-size:12px;
                    line-height:1.6;
                    color:#6E5A8A;
                ">
                  If you did not request a password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


    def send_notification_email(
        self,
        to_email: str,
        *,
        title: str,
        message: str,
        action_url: str | None = None,
    ) -> bool:
        """Send a TaskFlow notification email."""

        subject = f"{self.app_name}: {title}"

        text_content = (
            f"{self.app_name}\n\n"
            f"{title}\n\n"
            f"{message}"
        )

        html_content = self._notification_email_html(
            title=title,
            message=message,
            action_url=action_url,
        )

        return self.send_email(
            to_email=to_email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
        )


_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get the shared EmailService instance."""

    global _email_service

    if _email_service is None:
        _email_service = EmailService()

    return _email_service


def send_verification_email(
    email: str,
    otp_code: str,
) -> bool:
    """
    Send an OTP verification email.

    This wrapper maintains compatibility with existing imports:
    from app.core.email import send_verification_email
    """

    success = get_email_service().send_verification_email(
        email,
        otp_code,
    )

    if not success:
        logger.warning(
            "Failed to send verification email to %s",
            email,
        )

    return success


def send_notification_email(
    email: str,
    *,
    title: str,
    message: str,
    action_url: str | None = None,
) -> bool:
    """
    Send a notification email.

    This wrapper maintains compatibility with existing imports:
    from app.core.email import send_notification_email
    """

    success = get_email_service().send_notification_email(
        email,
        title=title,
        message=message,
        action_url=action_url,
    )

    if not success:
        logger.warning(
            "Failed to send notification email to %s",
            email,
        )

    return success
