# backend/app/utils/email_utils.py
import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Ensure environment variables are loaded (if not done globally)
# load_dotenv() # Typically loaded once in main.py

logger = logging.getLogger(__name__)

# Fetch email credentials and server info from environment variables
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD") # Use App Password if using Gmail
EMAIL_SMTP_SERVER = os.getenv("EMAIL_SMTP_SERVER") # e.g., smtp.gmail.com
EMAIL_SMTP_PORT = os.getenv("EMAIL_SMTP_PORT") # e.g., 587 or 465

def send_email(recipient_email: str, subject: str, html_content: str) -> bool:
    """Sends an email using configured SMTP settings."""
    if not all([EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT]):
        logger.error("Email SMTP settings not fully configured in .env. Cannot send email.")
        return False

    message = MIMEMultipart("alternative")
    # Consider setting a friendly sender name
    message["Subject"] = subject
    message["From"] = f"Aika from UGM AI-Care  <{EMAIL_USERNAME}>" # Example friendly name
    message["To"] = recipient_email

    # Attach HTML content
    message.attach(MIMEText(html_content, "html"))

    try:
        port = int(EMAIL_SMTP_PORT)
        if port not in [465, 587]:
            logger.error(f"Invalid SMTP port: {port}. Expected 465 (SSL) or 587 (TLS).")
            return False
        logger.debug(f"Attempting to send email via {EMAIL_SMTP_SERVER}:{port} from {EMAIL_USERNAME} to {recipient_email}")
        # Use with statement for automatic connection closing
        if port == 465: # SMTP_SSL
             with smtplib.SMTP_SSL(EMAIL_SMTP_SERVER, port) as server:
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.sendmail(EMAIL_USERNAME, recipient_email, message.as_string())
        else: # Assume port 587 (TLS) or other standard port
            with smtplib.SMTP(EMAIL_SMTP_SERVER, port) as server:
                server.ehlo() # Identify server
                server.starttls() # Secure the connection
                server.ehlo() # Re-identify after TLS
                server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                server.sendmail(EMAIL_USERNAME, recipient_email, message.as_string())

        logger.info(f"Email sent successfully to {recipient_email} (Subject: {subject})")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}", exc_info=True)
        return False