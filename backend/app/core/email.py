import logging
import os
import smtplib
from email.message import EmailMessage


logger = logging.getLogger(__name__)


def _verification_email_body(app_name: str, otp_code: str) -> str:
    return (
        f"{app_name}\n\n"
        f"Your email verification code is: {otp_code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "Security warning: If you did not request this code, ignore this email "
        "and do not share the code with anyone."
    )


def send_verification_email(email: str, otp_code: str) -> None:
    app_name = os.getenv("APP_NAME", "TaskFlow")
    subject = f"{app_name} email verification code"
    body = _verification_email_body(app_name, otp_code)

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "no-reply@taskflow.local")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not smtp_host:
        logger.warning("SMTP_HOST is not configured. Verification email for %s:\n%s", email, body)
        return

    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
        if smtp_use_tls:
            smtp.starttls()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)
