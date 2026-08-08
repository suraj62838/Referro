"""
Transactional email sender for system emails (verification codes, etc.).
Phase 8: Uses Brevo when BREVO_API_KEY is configured, otherwise
falls back to Django console logging for local development.

This is NOT for outreach emails — those go through the user's connected
Gmail/Outlook via services/gmail_service.py.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def send_verification_code(to_email: str, code: str) -> bool:
    """Send a 6-digit verification code via transactional email using Brevo API.

    Returns True if the email was sent (or logged in dev mode).
    Raises no exceptions — failures are logged and return False.
    """
    brevo_key = getattr(settings, "BREVO_API_KEY", "")
    from_email = getattr(
        settings,
        "BREVO_SENDER_EMAIL",
        getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@referro.app"),
    )

    # In DEBUG / dev mode, always output the code to backend terminal console for immediate access
    if getattr(settings, "DEBUG", False):
        logger.info(
            "===================================================\n"
            "  VERIFICATION CODE for %s: %s\n"
            "===================================================",
            to_email,
            code,
        )
        try:
            print(
                f"\n===================================================\n"
                f"  [VERIFICATION CODE] for {to_email}: {code}\n"
                f"===================================================\n",
                flush=True,
            )
        except Exception:
            pass

    if not brevo_key:
        return True

    sent_successfully = False

    try:
        html_content = (
            '<div style="font-family: Karla, Arial, sans-serif; max-width: 480px; '
            'margin: 0 auto; padding: 40px 24px; color: #23241F;">'
            '<div style="text-align: center; margin-bottom: 32px;">'
            '<h1 style="font-family: Fraunces, Georgia, serif; font-size: 24px; '
            'font-weight: 500; margin: 0;">Referro</h1>'
            '</div>'
            '<p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">'
            'Welcome! Use this code to verify your email address:</p>'
            '<div style="background: #F6F1E6; border: 2px solid #DCD4C0; '
            'border-radius: 12px; padding: 24px; text-align: center; '
            'margin-bottom: 24px;">'
            f'<span style="font-family: Fraunces, Georgia, serif; font-size: 36px; '
            f'font-weight: 600; letter-spacing: 0.15em; color: #B84B2A;">'
            f'{code}</span>'
            '</div>'
            '<p style="font-size: 14px; color: #5B5B52; line-height: 1.5;">'
            'This code expires in 10 minutes. If you didn\'t create a Referro '
            'account, you can safely ignore this email.</p>'
            '</div>'
        )

        payload = {
            "sender": {"name": "Referro", "email": from_email},
            "to": [{"email": to_email}],
            "subject": f"Referro — Your verification code is {code}",
            "htmlContent": html_content,
        }

        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "accept": "application/json",
                "api-key": brevo_key,
                "content-type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201, 202):
                logger.info("Verification email sent to %s via Brevo (status %d)", to_email, resp.status)
                sent_successfully = True
            else:
                logger.error(
                    "Brevo returned unexpected status %d for %s",
                    resp.status,
                    to_email,
                )
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.error("Brevo HTTP error %d for %s: %s", exc.code, to_email, error_body)
    except Exception:
        logger.exception("Failed to send verification email to %s via Brevo", to_email)

    if sent_successfully:
        return True

    # Fallback attempt using Django's standard send_mail if configured
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=f"Referro — Your verification code is {code}",
            message=f"Welcome to Referro! Your verification code is: {code}\nThis code expires in 10 minutes.",
            from_email=from_email,
            recipient_list=[to_email],
            fail_silently=True,
        )
    except Exception:
        pass

    return True if getattr(settings, "DEBUG", False) else sent_successfully

