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


def send_email(email_account, to: str, subject: str, body: str) -> str:
    """Send an email via the Gmail API using the user's connected account.

    Args:
        email_account: An api.models.EmailAccount instance.
        to: Recipient email address.
        subject: Email subject line.
        body: Email body (plain text).

    Returns:
        The Gmail thread ID of the sent message.

    Raises:
        ValueError: If sending fails.
    """
    creds = get_credentials(email_account)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

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
