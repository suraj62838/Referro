"""
Celery tasks for the API app.
Phase 0 — empty module. Celery auto-discovers this file.
Phase 6 — poll_replies: periodic task checking Gmail threads for HR replies.
"""

import logging
from collections import defaultdict

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def poll_replies():
    """Check sent email threads for new replies.

    Iterates EmailLog rows whose JobApplication.status is still "sent",
    checks the corresponding Gmail thread for new messages, and for each
    new reply: creates a ReplyLog row and updates JobApplication.status
    to "replied".

    Runs on a Celery Beat schedule (see settings.CELERY_BEAT_SCHEDULE).
    """
    from api.models import EmailAccount, EmailLog, ReplyLog

    # Find all email logs for applications that are still in "sent" status
    # and have a valid Gmail thread ID
    email_logs = (
        EmailLog.objects.filter(
            job_application__status="sent",
            gmail_thread_id__gt="",
        )
        .select_related("job_application", "job_application__user")
    )

    if not email_logs.exists():
        logger.debug("poll_replies: no sent applications with thread IDs to check.")
        return "No threads to check."

    # Group email logs by user for credential reuse
    by_user = defaultdict(list)
    for el in email_logs:
        by_user[el.job_application.user_id].append(el)

    total_replies = 0

    for user_id, logs in by_user.items():
        # Get the user's email account
        email_account = (
            EmailAccount.objects.filter(user_id=user_id)
            .order_by("-connected_at")
            .first()
        )

        if not email_account:
            logger.warning(
                "poll_replies: user %s has sent emails but no connected email account. Skipping.",
                user_id,
            )
            continue

        for el in logs:
            try:
                replies_found = _check_thread_for_replies(email_account, el)
                total_replies += replies_found
            except Exception as exc:
                logger.error(
                    "poll_replies: error checking thread %s for application %s: %s",
                    el.gmail_thread_id,
                    el.job_application_id,
                    exc,
                )
                # Continue checking other threads — don't let one failure stop all
                continue

    return f"Checked {email_logs.count()} threads, found {total_replies} new replies."


def _check_thread_for_replies(email_account, email_log):
    """Check a single Gmail thread for new replies.

    Args:
        email_account: The user's EmailAccount instance.
        email_log: The EmailLog instance to check.

    Returns:
        The number of new replies found.
    """
    from services.gmail_service import get_thread_messages
    from api.models import ReplyLog

    messages = get_thread_messages(email_account, email_log.gmail_thread_id)

    if len(messages) <= 1:
        # Only the original sent message — no replies yet
        return 0

    # Get existing reply message IDs to avoid duplicates
    existing_reply_ids = set(
        ReplyLog.objects.filter(
            job_application=email_log.job_application,
        ).values_list("gmail_message_id", flat=True)
    )

    # The first message is typically the one we sent.
    # Replies are all subsequent messages not sent by us.
    sender_email = email_account.email_address.lower()
    new_replies = 0

    for msg in messages[1:]:  # Skip the first (our sent message)
        msg_id = msg.get("id", "")

        # Skip if we've already recorded this reply
        if msg_id in existing_reply_ids:
            continue

        # Skip messages sent by the user themselves (e.g., follow-ups)
        from_addr = msg.get("from", "").lower()
        if sender_email and sender_email in from_addr:
            continue

        # Create a ReplyLog for this new reply
        ReplyLog.objects.create(
            job_application=email_log.job_application,
            snippet=msg.get("snippet", "")[:500],
            body=msg.get("body", ""),
            gmail_message_id=msg_id,
        )
        new_replies += 1

        logger.info(
            "poll_replies: new reply detected for application %s (thread %s, msg %s)",
            email_log.job_application_id,
            email_log.gmail_thread_id,
            msg_id,
        )

    # Update application status if any new replies were found
    if new_replies > 0:
        app = email_log.job_application
        app.status = "replied"
        app.save(update_fields=["status"])

    return new_replies
