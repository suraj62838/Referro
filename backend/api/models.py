"""
Data models per README.md §3.
Phase 2: JobPosting, JobApplication with full CRUD.
         EmailLog, ReplyLog — schema only, no logic yet.
Phase 5: EmailAccount with encrypted OAuth token storage.
Phase 8: UserProfile (is_verified), EmailVerificationCode.
Phase 9: Resume (one active per user, upload/replace/delete).
"""

from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from cryptography.fernet import Fernet


# ── Phase 8: User profile & email verification ───────────────


class UserProfile(models.Model):
    """One-to-one extension of Django's User for app-specific fields.
    Auto-created via post_save signal on User creation."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile({self.user.username}, verified={self.is_verified})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create a UserProfile whenever a new User is created."""
    if created:
        UserProfile.objects.get_or_create(user=instance)


class EmailVerificationCode(models.Model):
    """A 6-digit code sent to the user's email for account verification."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="verification_codes",
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Code({self.user.username}, used={self.is_used})"


# ── Phase 9: Resume ───────────────────────────────────────────


def resume_upload_path(instance, filename):
    """Upload resumes to media/resumes/<user_id>/<filename>."""
    return f"resumes/{instance.user_id}/{filename}"


class Resume(models.Model):
    """One active resume per user. Uploading a new one replaces the old.
    The physical file is deleted when the record is deleted."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resumes",
    )
    file = models.FileField(upload_to=resume_upload_path)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Resume({self.user.username}, {self.original_filename})"

    def delete(self, *args, **kwargs):
        """Delete the physical file from storage before removing the DB row."""
        if self.file:
            storage = self.file.storage
            if storage.exists(self.file.name):
                storage.delete(self.file.name)
        super().delete(*args, **kwargs)


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
    Phase 5: sending initial outreach logic added.
    Phase 9: resume_attached tracks which resume was attached at send time.
    Phase 10: direction, type, in_reply_to fields added for replying."""

    DIRECTION_CHOICES = [
        ("outbound", "Outbound"),
        ("inbound", "Inbound"),
    ]
    TYPE_CHOICES = [
        ("initial", "Initial"),
        ("reply", "Reply"),
    ]

    job_application = models.ForeignKey(
        JobApplication,
        on_delete=models.CASCADE,
        related_name="email_logs",
    )
    direction = models.CharField(
        max_length=10, choices=DIRECTION_CHOICES, default="outbound"
    )
    type = models.CharField(
        max_length=10, choices=TYPE_CHOICES, default="initial"
    )
    in_reply_to = models.ForeignKey(
        "ReplyLog",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies_sent",
        help_text="Which HR reply message this outbound email responds to.",
    )
    subject = models.CharField(max_length=500)
    body = models.TextField()
    resume_attached = models.ForeignKey(
        "Resume",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_logs",
        help_text="Which resume was attached at send time (null = none).",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    gmail_thread_id = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"Email ({self.direction}/{self.type}) for {self.job_application} — {self.subject[:40]}"


class ReplyLog(models.Model):
    """Record of a reply detected on a sent email thread.
    Phase 6: polling logic added.
    Phase 10: responded field tracks if user has replied."""

    job_application = models.ForeignKey(
        JobApplication,
        on_delete=models.CASCADE,
        related_name="reply_logs",
    )
    snippet = models.CharField(max_length=500, blank=True, default="")
    body = models.TextField(blank=True, default="")
    gmail_message_id = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Gmail message ID for deduplication during polling.",
    )
    received_at = models.DateTimeField(auto_now_add=True)
    responded = models.BooleanField(
        default=False,
        help_text="Set True once the user sends a reply to this message.",
    )

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
