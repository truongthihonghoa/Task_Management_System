import logging
import html
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional


logger = logging.getLogger(__name__)


class EmailService:
    """Reusable email service for sending emails via Gmail SMTP."""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.email_from = os.getenv("EMAIL_FROM")
        self.email_from_name = os.getenv("EMAIL_FROM_NAME", "TaskFlow")
        self.otp_expire_minutes = int(os.getenv("OTP_EXPIRE_MINUTES", "15"))
        self.app_name = os.getenv("APP_NAME", "TaskFlow")

    def _validate_config(self) -> None:
        """Validate that required SMTP configuration is present."""
        if not self.smtp_host:
            raise ValueError("SMTP_HOST environment variable is not configured")
        if not self.smtp_username:
            raise ValueError("SMTP_USERNAME environment variable is not configured")
        if not self.smtp_password:
            raise ValueError("SMTP_PASSWORD environment variable is not configured")
        if not self.email_from:
            raise ValueError("EMAIL_FROM environment variable is not configured")

    def _create_html_email(self, to_email: str, subject: str, html_content: str) -> MIMEMultipart:
        """Create an HTML email message."""
        message = MIMEMultipart("alternative")
        message["From"] = f"{self.email_from_name} <{self.email_from}>"
        message["To"] = to_email
        message["Subject"] = subject

        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        return message

    def _create_verification_html(self, otp_code: str) -> str:
        """Create HTML content for verification email."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    padding: 30px;
                    text-align: center;
                }}
                .header {{
                    color: #4a90e2;
                    font-size: 24px;
                    margin-bottom: 20px;
                }}
                .otp-code {{
                    background-color: #4a90e2;
                    color: white;
                    font-size: 32px;
                    font-weight: bold;
                    padding: 15px 30px;
                    border-radius: 5px;
                    display: inline-block;
                    margin: 20px 0;
                    letter-spacing: 5px;
                }}
                .info {{
                    color: #666;
                    font-size: 14px;
                    margin: 20px 0;
                }}
                .warning {{
                    color: #e74c3c;
                    font-size: 12px;
                    margin-top: 30px;
                    padding: 15px;
                    background-color: #fee;
                    border-radius: 5px;
                }}
                .footer {{
                    color: #999;
                    font-size: 12px;
                    margin-top: 30px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">{self.app_name}</div>
                <h2>Email Verification</h2>
                <p>Your email verification code is:</p>
                <div class="otp-code">{otp_code}</div>
                <p class="info">This code expires in {self.otp_expire_minutes} minutes.</p>
                <div class="warning">
                    <strong>Security warning:</strong> If you did not request this code, ignore this email and do not share the code with anyone.
                </div>
                <div class="footer">
                    <p>This is an automated message from {self.app_name}. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send an HTML email via Gmail SMTP with STARTTLS.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            self._validate_config()
            
            message = self._create_html_email(to_email, subject, html_content)
            
            logger.info(f"Attempting to send email to {to_email}")
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as smtp:
                smtp.starttls()
                smtp.login(self.smtp_username, self.smtp_password)
                smtp.send_message(message)
                
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except ValueError as e:
            logger.error(f"SMTP configuration error: {e}")
            return False
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed for {to_email}: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending email to {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email to {to_email}: {e}")
            return False

    def send_verification_email(self, to_email: str, otp_code: str) -> bool:
        """Send a verification email with OTP code.
        
        Args:
            to_email: Recipient email address
            otp_code: 6-digit OTP code
            
        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"{self.app_name} - Email Verification Code"
        html_content = self._create_verification_html(otp_code)
        return self.send_email(to_email, subject, html_content)


# Global email service instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


def send_verification_email(email: str, otp_code: str) -> bool:
    """Send a verification email using the EmailService.
    
    This function maintains backward compatibility with the existing code.
    
    Args:
        email: Recipient email address
        otp_code: 6-digit OTP code
        
    Returns:
        True if email sent successfully, False otherwise
    """
    email_service = get_email_service()
    success = email_service.send_verification_email(email, otp_code)
    
    if not success:
        logger.warning(f"Failed to send verification email to {email}")
    
    return success


def send_notification_email(
    email: str,
    *,
    title: str,
    message: str,
    action_url: str | None = None,
) -> bool:
    app_name = os.getenv("APP_NAME", "TaskFlow")
    safe_title = html.escape(title)
    safe_message = html.escape(message).replace("\n", "<br>")
    safe_action_url = html.escape(action_url or os.getenv("FRONTEND_URL", ""))
    action_markup = ""
    if safe_action_url:
        action_markup = (
            f'<p><a href="{safe_action_url}" '
            'style="display:inline-block;background:#2563eb;color:#ffffff;'
            'text-decoration:none;padding:10px 14px;border-radius:6px;">'
            "Open TaskFlow</a></p>"
        )

    html_content = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family:Arial,sans-serif;color:#111827;">
        <h2>{html.escape(app_name)}</h2>
        <h3>{safe_title}</h3>
        <p>{safe_message}</p>
        {action_markup}
      </body>
    </html>
    """
    return get_email_service().send_email(email, f"{app_name}: {title}", html_content)
