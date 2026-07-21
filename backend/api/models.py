"""
Data models per README.md §3.
Phase 2: JobPosting, JobApplication with full CRUD.
         EmailLog, ReplyLog — schema only, no logic yet.
Phase 5: EmailAccount with encrypted OAuth token storage.
"""

from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet


def _fernet():
    """Return a Fernet instance using the configured encryption key."""
    return Fernet(settings.FIELD_ENCRYPTION_KEY)


def encrypt_token(plain: str) -> str:
    """Encrypt a plaintext token string → URL-safe base64 ciphertext string."""
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    """Decrypt a ciphertext token string → plaintext string."""
    if not cipher:
        return ""
    return _fernet().decrypt(cipher.encode()).decode()


class JobPosting(models.Model):
    """A referral job listing posted by any authenticated user."""

    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_postings",
    )
    company_name = models.CharField(max_length=255)
    role_title = models.CharField(max_length=255)
    jd_text = models.TextField(blank=True, default="")
    recruiter_email = models.EmailField(blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.role_title} at {self.company_name}"


class JobApplication(models.Model):
    """A user's application to a job — may or may not link to a JobPosting."""

    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("replied", "Replied"),
        ("interview", "Interview"),
        ("rejected", "Rejected"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    job_posting = models.ForeignKey(
        JobPosting,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    company_name = models.CharField(max_length=255)
    role_title = models.CharField(max_length=255)
    jd_text = models.TextField(blank=True, default="")
    recruiter_email = models.EmailField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="sent"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.role_title} @ {self.company_name} ({self.status})"


class EmailLog(models.Model):
    """Record of an outreach email sent through the user's connected mailbox.
    Schema only for Phase 2 — sending logic added in Phase 5."""

    job_application = models.ForeignKey(
        JobApplication,
        on_delete=models.CASCADE,
        related_name="email_logs",
    )
    subject = models.CharField(max_length=500)
    body = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    gmail_thread_id = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"Email for {self.job_application} — {self.subject[:40]}"


class ReplyLog(models.Model):
    """Record of a reply detected on a sent email thread.
    Schema only for Phase 2 — polling logic added in Phase 6."""

    job_application = models.ForeignKey(
        JobApplication,
        on_delete=models.CASCADE,
        related_name="reply_logs",
    )
    snippet = models.CharField(max_length=500, blank=True, default="")
    body = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self):
        return f"Reply for {self.job_application} — {self.snippet[:40]}"


class EmailAccount(models.Model):
    """A user's connected email account for sending outreach.
    Phase 5: Gmail only. One active account per user for MVP.
    Tokens are stored Fernet-encrypted at rest."""

    PROVIDER_CHOICES = [
        ("gmail", "Gmail"),
        ("outlook", "Outlook"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_accounts",
    )
    provider = models.CharField(
        max_length=20, choices=PROVIDER_CHOICES, default="gmail"
    )
    email_address = models.EmailField(blank=True, default="")
    # Encrypted tokens — never store plaintext OAuth tokens
    _access_token = models.TextField(
        db_column="access_token", blank=True, default=""
    )
    _refresh_token = models.TextField(
        db_column="refresh_token", blank=True, default=""
    )
    connected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-connected_at"]

    def __str__(self):
        return f"{self.provider} — {self.email_address} ({self.user})"

    # -- Encrypted property accessors --

    @property
    def access_token(self):
        return decrypt_token(self._access_token)

    @access_token.setter
    def access_token(self, value):
        self._access_token = encrypt_token(value)

    @property
    def refresh_token(self):
        return decrypt_token(self._refresh_token)

    @refresh_token.setter
    def refresh_token(self, value):
        self._refresh_token = encrypt_token(value)
