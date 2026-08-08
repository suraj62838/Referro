"""
Gmail OAuth and sending service — Phase 5.

Handles:
- OAuth2 URL generation + code exchange
- Credential refresh
- Sending emails via the Gmail API

Gmail-only for this phase. Outlook deferred.
"""

import base64
import json
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Gmail scopes required by the app
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

# Google OAuth2 endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def build_auth_url(state: str) -> str:
    """Build the Google OAuth2 authorization URL.

    Args:
        state: An opaque string (JWT-signed user id) to tie the callback
               back to the authenticated user.

    Returns:
        The full authorization URL the frontend should redirect to.
    """
    from urllib.parse import urlencode

    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for access + refresh tokens.

    Args:
        code: The authorization code returned by Google.

    Returns:
        Dict with keys: access_token, refresh_token, email.

    Raises:
        ValueError: If the token exchange fails.
    """
    import requests as http_requests

    resp = http_requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )

    if resp.status_code != 200:
        logger.error("Google token exchange failed: %s %s", resp.status_code, resp.text)
        raise ValueError(f"Token exchange failed: {resp.text}")

    token_data = resp.json()
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")

    # Fetch the user's email address from the userinfo endpoint
    userinfo_resp = http_requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )

    email = ""
    if userinfo_resp.status_code == 200:
        email = userinfo_resp.json().get("email", "")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "email": email,
    }


def get_credentials(email_account) -> Credentials:
    """Build a google-auth Credentials object from an EmailAccount.

    Automatically refreshes the access token if it has expired, and
    persists the new tokens back to the database.

    Args:
        email_account: An api.models.EmailAccount instance.

    Returns:
        A valid google.oauth2.credentials.Credentials object.

    Raises:
        ValueError: If credentials cannot be refreshed.
    """
    creds = Credentials(
        token=email_account.access_token,
        refresh_token=email_account.refresh_token,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Persist the refreshed tokens back to the DB
            email_account.access_token = creds.token
            if creds.refresh_token:
                email_account.refresh_token = creds.refresh_token
            email_account.save(update_fields=["_access_token", "_refresh_token"])
            logger.info("Refreshed Gmail token for user %s", email_account.user_id)
        except Exception as exc:
            logger.error("Failed to refresh Gmail token: %s", exc)
            raise ValueError("Gmail token refresh failed. Please reconnect your inbox.") from exc

    return creds


def send_email(
    email_account,
    to: str,
    subject: str,
    body: str,
    attachment_data: bytes | None = None,
    attachment_filename: str | None = None,
) -> str:
    """Send an email via the Gmail API using the user's connected account.

    Args:
        email_account: An api.models.EmailAccount instance.
        to: Recipient email address.
        subject: Email subject line.
        body: Email body (plain text).
        attachment_data: Raw bytes of the file to attach (or None).
        attachment_filename: The filename for the attachment header (or None).

    Returns:
        The Gmail thread ID of the sent message.

    Raises:
        ValueError: If sending fails.
    """
    creds = get_credentials(email_account)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    if attachment_data and attachment_filename:
        # Build multipart message with attachment
        message = MIMEMultipart()
        message["to"] = to
        message["from"] = email_account.email_address
        message["subject"] = subject

        message.attach(MIMEText(body))

        attachment = MIMEApplication(attachment_data)
        attachment.add_header(
            "Content-Disposition", "attachment", filename=attachment_filename
        )
        message.attach(attachment)
    else:
        # Plain text message (no attachment)
        message = MIMEText(body)
        message["to"] = to
        message["from"] = email_account.email_address
        message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    try:
        sent = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw})
            .execute()
        )
        thread_id = sent.get("threadId", "")
        logger.info(
            "Sent email to %s (thread %s) for user %s",
            to, thread_id, email_account.user_id,
        )
        return thread_id
    except Exception as exc:
        logger.error("Gmail send failed: %s", exc)
        raise ValueError(f"Failed to send email via Gmail: {exc}") from exc


def get_thread_messages(email_account, thread_id: str) -> list[dict]:
    """Fetch all messages in a Gmail thread.

    Args:
        email_account: An api.models.EmailAccount instance.
        thread_id: The Gmail thread ID to fetch.

    Returns:
        A list of dicts, each with keys: id, snippet, body, date.
        Ordered by date ascending (oldest first).

    Raises:
        ValueError: If fetching fails.
    """
    creds = get_credentials(email_account)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    try:
        thread = (
            service.users()
            .threads()
            .get(userId="me", id=thread_id, format="full")
            .execute()
        )
    except Exception as exc:
        logger.error("Gmail thread fetch failed for thread %s: %s", thread_id, exc)
        raise ValueError(f"Failed to fetch Gmail thread: {exc}") from exc

    messages = []
    for msg in thread.get("messages", []):
        msg_id = msg.get("id", "")
        snippet = msg.get("snippet", "")

        # Extract date from headers
        headers = msg.get("payload", {}).get("headers", [])
        date_str = ""
        from_addr = ""
        for h in headers:
            if h["name"].lower() == "date":
                date_str = h["value"]
            if h["name"].lower() == "from":
                from_addr = h["value"]

        # Extract body — try plain text first, then html
        body = _extract_body(msg.get("payload", {}))

        messages.append({
            "id": msg_id,
            "snippet": snippet,
            "body": body,
            "date": date_str,
            "from": from_addr,
        })

    return messages


def _extract_body(payload: dict) -> str:
    """Recursively extract the plain-text body from a Gmail message payload.

    Falls back to the snippet if no decodable body is found.
    """
    mime_type = payload.get("mimeType", "")

    # Direct body on this part
    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    # Multipart — recurse into parts
    parts = payload.get("parts", [])
    for part in parts:
        result = _extract_body(part)
        if result:
            return result

    # Fallback: try top-level body data regardless of MIME type
    data = payload.get("body", {}).get("data", "")
    if data:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    return ""
