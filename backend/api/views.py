"""
API views.
Phase 1: Added user auth views (signup, custom token view).
Phase 2: Added JobPostingViewSet and JobApplicationViewSet (full CRUD).
Phase 3: Added extract_jd endpoint for JD text/file extraction + email detection.
Phase 5: Added Gmail OAuth connect/callback, email-accounts/me, send-email action.
Phase 8: Added verify_email, resend_code; signup now sends 6-digit code.
Phase 9: Added resume_view (GET/POST/DELETE); send_email attaches active resume.
"""

import json
import logging
import random
from datetime import timedelta

from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    parser_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from services.email_extractor import extract_email
from services.text_extractor import (
    ALLOWED_CONTENT_TYPES,
    extract_text_from_file,
)

from .models import EmailAccount, EmailLog, EmailVerificationCode, JobApplication, JobPosting, ReplyLog, Resume
from .serializers import (
    JobApplicationDetailSerializer,
    JobApplicationSerializer,
    JobPostingSerializer,
    MyTokenObtainPairSerializer,
    ResumeSerializer,
    SignupSerializer,
)

logger = logging.getLogger(__name__)


# ── Health check ──────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Simple liveness probe — returns 200 with status ok."""
    return Response({"status": "ok"})


# ── Auth views ────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    """Register a new user with is_verified=False, send 6-digit code."""
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Generate and send verification code
        code = _generate_verification_code(user)
        from services.email_sender import send_verification_code
        send_verification_code(user.email, code)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "email": user.email,
                    "is_verified": False,
                },
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyTokenObtainPairView(TokenObtainPairView):
    """Custom TokenObtainPairView returning user details in response."""

    serializer_class = MyTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def test_protected(request):
    """Simple protected endpoint for testing authentication."""
    return Response({"message": "authenticated"})


def _generate_verification_code(user):
    """Create a 6-digit verification code with 10-minute expiry.
    Returns the code string."""
    code = f"{random.randint(0, 999999):06d}"
    EmailVerificationCode.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return code


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_email(request):
    """Check the 6-digit code and mark the user as verified.

    Expects ``{"code": "123456"}``.
    Permission is IsAuthenticated only (not IsVerifiedUser) because
    unverified users need to reach this endpoint.
    """
    code = request.data.get("code", "").strip()
    if not code:
        return Response(
            {"detail": "Verification code is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Already verified?
    profile = request.user.profile
    if profile.is_verified:
        return Response(
            {"detail": "Email is already verified."},
            status=status.HTTP_200_OK,
        )

    # Find the latest unused, unexpired code for this user
    verification = (
        EmailVerificationCode.objects.filter(
            user=request.user,
            is_used=False,
            expires_at__gt=timezone.now(),
        )
        .order_by("-created_at")
        .first()
    )

    if verification is None:
        return Response(
            {"detail": "No valid verification code found. Please request a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if verification.code != code:
        return Response(
            {"detail": "Incorrect verification code."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Mark code as used and verify the user
    verification.is_used = True
    verification.save(update_fields=["is_used"])

    profile.is_verified = True
    profile.save(update_fields=["is_verified"])

    return Response(
        {"detail": "Email verified successfully.", "is_verified": True},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def resend_code(request):
    """Invalidate prior unused codes and issue a new one.

    Rate-limited to 1 per 60 seconds. Also enforces a server-side
    cooldown to prevent abuse even if the throttle is bypassed.
    """
    # Check server-side cooldown (60 seconds since last code)
    last_code = (
        EmailVerificationCode.objects.filter(user=request.user)
        .order_by("-created_at")
        .first()
    )
    if last_code and (timezone.now() - last_code.created_at).total_seconds() < 60:
        remaining = 60 - int((timezone.now() - last_code.created_at).total_seconds())
        return Response(
            {"detail": f"Please wait {remaining} seconds before requesting a new code."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # Invalidate all prior unused codes
    EmailVerificationCode.objects.filter(
        user=request.user, is_used=False
    ).update(is_used=True)

    # Generate and send a new code
    code = _generate_verification_code(request.user)
    from services.email_sender import send_verification_code
    send_verification_code(request.user.email, code)

    return Response(
        {"detail": "A new verification code has been sent to your email."},
        status=status.HTTP_200_OK,
    )


resend_code.throttle_scope = "resend_code"


# ── Resume management (Phase 9) ─────────────────────────────────

# Allowed content types for resume uploads
RESUME_ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",                                        # .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
}
RESUME_MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@api_view(["GET", "POST", "DELETE"])
@parser_classes([MultiPartParser, JSONParser])
def resume_view(request):
    """Manage the user's active resume.

    GET    — Return current resume metadata (or 404 if none).
    POST   — Upload / replace the active resume (multipart ``file`` field).
    DELETE — Remove the active resume.
    """
    if request.method == "GET":
        resume = (
            Resume.objects.filter(user=request.user)
            .order_by("-uploaded_at")
            .first()
        )
        if not resume:
            return Response(
                {"detail": "No resume uploaded yet."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ResumeSerializer(resume).data)

    if request.method == "POST":
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response(
                {"detail": "A file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate content type
        if uploaded.content_type not in RESUME_ALLOWED_TYPES:
            return Response(
                {"detail": f"Unsupported file type: {uploaded.content_type}. Allowed: PDF, DOC, DOCX."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate size
        if uploaded.size > RESUME_MAX_SIZE:
            return Response(
                {"detail": f"File too large ({uploaded.size} bytes). Maximum is 5 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete any existing resume(s) for this user (file + DB row)
        for old in Resume.objects.filter(user=request.user):
            old.delete()  # custom delete() purges the physical file

        resume = Resume.objects.create(
            user=request.user,
            file=uploaded,
            original_filename=uploaded.name,
        )
        return Response(ResumeSerializer(resume).data, status=status.HTTP_201_CREATED)

    # DELETE
    deleted_count = 0
    for old in Resume.objects.filter(user=request.user):
        old.delete()
        deleted_count += 1

    if deleted_count == 0:
        return Response(
            {"detail": "No resume to delete."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({"detail": "Resume deleted."}, status=status.HTTP_200_OK)


# ── JD extraction (Phase 3) ───────────────────────────────────


@api_view(["POST"])
@parser_classes([MultiPartParser, JSONParser])
@throttle_classes([ScopedRateThrottle])
def extract_jd(request):
    """Extract JD text from raw text or an uploaded file, plus detect email.

    Accepts *either*:
    - JSON body with ``{"text": "..."}``
    - Multipart form with a ``file`` field (PDF, DOCX, or image)

    Returns ``{"jd_text": "...", "recruiter_email": "..."}``
    (``recruiter_email`` is "" if none found — never fabricated).
    """
    text = request.data.get("text", "").strip()
    file = request.FILES.get("file")

    if not text and not file:
        return Response(
            {"detail": "Provide either a 'text' field or a 'file' upload."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if file:
        try:
            text = extract_text_from_file(file)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    recruiter_email = extract_email(text)

    return Response(
        {
            "jd_text": text,
            "recruiter_email": recruiter_email,
        },
        status=status.HTTP_200_OK,
    )


extract_jd.throttle_scope = "extract"


# ── Gmail OAuth (Phase 5) ────────────────────────────────────


@api_view(["GET"])
def oauth_connect(request):
    """Start the Gmail OAuth flow.

    Returns ``{"auth_url": "..."}`` — the frontend opens this URL in the
    same tab.  A JWT-signed ``state`` param ties the callback back to the
    authenticated user so the callback view (which runs without a Bearer
    header, since it's a Google redirect) can identify the user.
    """
    from services.gmail_service import build_auth_url

    # Encode the user id into a short-lived JWT for the state param
    token = AccessToken()
    token["user_id"] = request.user.id
    token.set_exp(lifetime=__import__("datetime").timedelta(minutes=10))
    state = str(token)

    auth_url = build_auth_url(state)
    return Response({"auth_url": auth_url})


@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_callback(request):
    """Google OAuth callback — exchanges code for tokens, stores them
    encrypted on EmailAccount, then redirects the browser back to the
    frontend.

    This view is AllowAny because the browser arrives here via a Google
    redirect (no Bearer header).  We authenticate the user via the signed
    ``state`` parameter instead.
    """
    from services.gmail_service import exchange_code

    code = request.GET.get("code", "")
    state = request.GET.get("state", "")
    error = request.GET.get("error", "")

    frontend_base = "http://localhost:5173"

    if error:
        logger.warning("OAuth callback received error: %s", error)
        return HttpResponseRedirect(f"{frontend_base}/dashboard?oauth_error={error}")

    if not code or not state:
        return HttpResponseRedirect(f"{frontend_base}/dashboard?oauth_error=missing_params")

    # Verify the state JWT to recover the user id
    try:
        token = AccessToken(state)
        user_id = token["user_id"]
    except Exception as exc:
        logger.warning("OAuth state verification failed: %s", exc)
        return HttpResponseRedirect(f"{frontend_base}/dashboard?oauth_error=invalid_state")

    # Exchange the authorization code for tokens
    try:
        token_data = exchange_code(code)
    except ValueError as exc:
        logger.error("OAuth code exchange failed: %s", exc)
        return HttpResponseRedirect(f"{frontend_base}/dashboard?oauth_error=exchange_failed")

    # Upsert the EmailAccount for this user
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(f"{frontend_base}/dashboard?oauth_error=user_not_found")

    account, _created = EmailAccount.objects.update_or_create(
        user=user,
        provider="gmail",
        defaults={
            "email_address": token_data["email"],
        },
    )
    # Use property setters to encrypt before saving
    account.access_token = token_data["access_token"]
    account.refresh_token = token_data["refresh_token"]
    account.save(update_fields=["_access_token", "_refresh_token", "email_address"])

    logger.info("Gmail connected for user %s (%s)", user_id, token_data["email"])
    return HttpResponseRedirect(f"{frontend_base}/dashboard?connected=1")


@api_view(["GET"])
def email_account_me(request):
    """Return the current user's connected email account status.

    Response: ``{"connected": bool, "email": str|null, "provider": str|null}``
    """
    account = (
        EmailAccount.objects.filter(user=request.user)
        .order_by("-connected_at")
        .first()
    )

    if account:
        return Response({
            "connected": True,
            "email": account.email_address,
            "provider": account.provider,
        })
    return Response({
        "connected": False,
        "email": None,
        "provider": None,
    })


# ── CRUD viewsets ─────────────────────────────────────────────


class JobPostingViewSet(viewsets.ModelViewSet):
    """Full CRUD for job postings.

    - List: returns ALL active postings (the public job board).
    - Create/Update/Delete: scoped to request.user as posted_by.
    - Only the poster can edit/delete their own postings.
    """

    serializer_class = JobPostingSerializer

    def get_queryset(self):
        qs = JobPosting.objects.select_related("posted_by")
        # For list (the public job board), show all active postings.
        # For detail/update/delete, show all (DRF will 404 if not found).
        if self.action == "list":
            return qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(posted_by=self.request.user)

    def perform_update(self, serializer):
        # Ensure only the poster can update
        if serializer.instance.posted_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only edit your own postings.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.posted_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only delete your own postings.")
        instance.delete()

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "create_posting"
            return [ScopedRateThrottle()]
        elif self.action == "generate_jd":
            self.throttle_scope = "generate_jd"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @action(detail=False, methods=["post"], url_path="generate-jd")
    def generate_jd(self, request):
        """AI-generate a job description from structured fields."""
        role_title = request.data.get("role_title") or request.data.get("role", "").strip()
        seniority = request.data.get("seniority", "").strip()
        key_skills = request.data.get("key_skills") or request.data.get("skills", "").strip()
        notes = request.data.get("notes", "").strip()

        if not role_title:
            return Response(
                {"detail": "Role title is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = (
            f"Write a professional job description for a {seniority} {role_title} role. "
            f"The key skills required are: {key_skills}. "
        )
        if notes:
            prompt += f"Additional details: {notes}. "
        prompt += (
            "Provide a detailed job description including the role description, responsibilities, "
            "and requirements. Return ONLY the job description text. Do not wrap it in markdown block formatting "
            "or include conversational introductions."
        )

        from services.ai_writer import generate
        try:
            jd_text = generate(prompt, {
                "role_title": role_title,
                "seniority": seniority,
                "key_skills": key_skills,
                "notes": notes,
            })
            return Response({"jd_text": jd_text}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"AI generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )



class JobApplicationViewSet(viewsets.ModelViewSet):
    """Full CRUD for job applications, scoped to the authenticated user.

    A user can only see, create, edit, and delete their own applications.
    Phase 6: retrieve action returns nested email_logs and reply_logs.
    """

    serializer_class = JobApplicationSerializer

    def get_throttles(self):
        if self.action in ["draft_email", "draft_reply"]:
            self.throttle_scope = "draft_email"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        """Use the detail serializer (with timeline data) for retrieve."""
        if self.action == "retrieve":
            return JobApplicationDetailSerializer
        return JobApplicationSerializer

    def get_queryset(self):
        qs = JobApplication.objects.filter(
            user=self.request.user
        ).select_related("job_posting")
        # Prefetch email/reply logs for the detail view
        if self.action == "retrieve":
            qs = qs.prefetch_related("email_logs", "reply_logs")
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="draft-email")
    def draft_email(self, request, pk=None):
        """AI-draft an outreach email for this application."""
        app = self.get_object()  # Scopes automatically to user since get_queryset is filtered by user
        
        user_email = request.user.email
        user_name = f"{request.user.first_name} {request.user.last_name}".strip() or user_email.split("@")[0]

        prompt = (
            f"Write a personalized, professional cold outreach email to a recruiter for the following job:\n"
            f"Company: {app.company_name}\n"
            f"Role: {app.role_title}\n"
            f"Job Description:\n{app.jd_text}\n\n"
            f"The email is sent from: {user_name} ({user_email}).\n"
            f"Please write a short, compelling subject line and body. "
            f"Return the response in JSON format matching exactly this structure:\n"
            f"{{\n"
            f"  \"subject\": \"...\",\n"
            f"  \"body\": \"...\"\n"
            f"}}\n"
            f"Do not include any other text, markdown formatting like ```json or wrappers around it. Return only the JSON object."
        )

        from services.ai_writer import generate
        try:
            generated_text = generate(prompt, {
                "company_name": app.company_name,
                "role_title": app.role_title,
                "jd_text": app.jd_text,
                "user_name": user_name,
                "user_email": user_email,
            })

            # Robust JSON cleaning and parsing
            text = generated_text.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            try:
                data = json.loads(text)
                subject = data.get("subject", f"Application for {app.role_title} at {app.company_name}")
                body = data.get("body", generated_text)
            except Exception:
                # If parsing fails, fall back to extracting Subject or just using generated text as body
                subject = f"Application for {app.role_title} at {app.company_name}"
                body = generated_text
                
            return Response({"subject": subject, "body": body}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"AI drafting failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        """Send the reviewed outreach email via the user's connected Gmail.

        Expects ``{"subject": "...", "body": "..."}`` in the request body.
        Creates an EmailLog, updates status to sent, returns the thread id.
        Phase 9: auto-attaches the user's active resume if one exists.
        """
        from services.gmail_service import send_email as gmail_send

        app = self.get_object()

        subject = request.data.get("subject", "").strip()
        body = request.data.get("body", "").strip()

        if not subject or not body:
            return Response(
                {"detail": "Both subject and body are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not app.recruiter_email:
            return Response(
                {"detail": "No recruiter email on this application."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the user's connected email account
        email_account = (
            EmailAccount.objects.filter(user=request.user)
            .order_by("-connected_at")
            .first()
        )

        if not email_account:
            return Response(
                {"detail": "No connected email account. Please connect your Gmail first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the user's active resume (if any) for attachment
        active_resume = (
            Resume.objects.filter(user=request.user)
            .order_by("-uploaded_at")
            .first()
        )

        attachment_data = None
        attachment_filename = None
        if active_resume and active_resume.file:
            try:
                active_resume.file.open("rb")
                attachment_data = active_resume.file.read()
                attachment_filename = active_resume.original_filename
                active_resume.file.close()
            except Exception as exc:
                logger.warning("Could not read resume file for attachment: %s", exc)
                active_resume = None  # proceed without attachment

        try:
            thread_id = gmail_send(
                email_account,
                to=app.recruiter_email,
                subject=subject,
                body=body,
                attachment_data=attachment_data,
                attachment_filename=attachment_filename,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create EmailLog
        EmailLog.objects.create(
            job_application=app,
            subject=subject,
            body=body,
            gmail_thread_id=thread_id,
            resume_attached=active_resume,
        )

        # Update application status
        app.status = "sent"
        app.save(update_fields=["status"])

        return Response(
            {
                "success": True,
                "thread_id": thread_id,
                "status": "sent",
                "resume_attached": active_resume.original_filename if active_resume else None,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="draft-reply")
    def draft_reply(self, request, pk=None):
        """AI-draft a reply to a specific HR ReplyLog message.

        Expects ``{"reply_log_id": 123}`` in request body.
        Returns draft ``{"subject": "...", "body": "..."}``. Does not save anything.
        """
        app = self.get_object()
        reply_log_id = request.data.get("reply_log_id")
        if not reply_log_id:
            return Response(
                {"detail": "reply_log_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reply_log = app.reply_logs.get(pk=reply_log_id)
        except ReplyLog.DoesNotExist:
            return Response(
                {"detail": "ReplyLog not found for this application."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_email = request.user.email
        user_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or user_email.split("@")[0]
        )

        prompt = (
            f"Write a professional email reply to a recruiter who sent the following message:\n\n"
            f"Recruiter's Message:\n{reply_log.body or reply_log.snippet}\n\n"
            f"Context:\n"
            f"Company: {app.company_name}\n"
            f"Role: {app.role_title}\n"
            f"Job Description:\n{app.jd_text}\n\n"
            f"The reply is sent from: {user_name} ({user_email}).\n"
            f"Please write a short, compelling subject line (starting with Re:) and body.\n"
            f"Return the response in JSON format matching exactly this structure:\n"
            f"{{\n"
            f'  "subject": "...",\n'
            f'  "body": "..."\n'
            f"}}\n"
            f"Do not include any other text, markdown formatting like ```json or wrappers around it. Return only the JSON object."
        )

        from services.ai_writer import generate

        try:
            generated_text = generate(
                prompt,
                {
                    "company_name": app.company_name,
                    "role_title": app.role_title,
                    "reply_body": reply_log.body or reply_log.snippet,
                    "user_name": user_name,
                    "user_email": user_email,
                },
            )

            text = generated_text.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            default_subject = f"Re: Application for {app.role_title} at {app.company_name}"
            try:
                data = json.loads(text)
                subject = data.get("subject", default_subject)
                body = data.get("body", generated_text)
            except Exception:
                subject = default_subject
                body = generated_text

            return Response(
                {"subject": subject, "body": body}, status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": f"AI drafting failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="send-reply")
    def send_reply(self, request, pk=None):
        """Send a reply to an HR ReplyLog via connected Gmail in the existing thread.

        Expects ``{"reply_log_id": 123, "subject": "...", "body": "..."}``.
        Attaches active resume if available. Creates EmailLog(direction=outbound, type=reply).
        Marks ReplyLog.responded = True.
        """
        from services.gmail_service import send_email as gmail_send

        app = self.get_object()
        reply_log_id = request.data.get("reply_log_id")
        subject = request.data.get("subject", "").strip()
        body = request.data.get("body", "").strip()

        if not reply_log_id or not subject or not body:
            return Response(
                {"detail": "reply_log_id, subject, and body are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reply_log = app.reply_logs.get(pk=reply_log_id)
        except ReplyLog.DoesNotExist:
            return Response(
                {"detail": "ReplyLog not found for this application."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get connected email account
        email_account = (
            EmailAccount.objects.filter(user=request.user)
            .order_by("-connected_at")
            .first()
        )
        if not email_account:
            return Response(
                {"detail": "No connected email account. Please connect your Gmail first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Recipient email — fallback to recruiter_email
        to_email = app.recruiter_email
        if not to_email:
            return Response(
                {"detail": "No recipient email on this application."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find existing gmail_thread_id from EmailLog(s)
        first_email_log = app.email_logs.filter(gmail_thread_id__gt="").first()
        thread_id = first_email_log.gmail_thread_id if first_email_log else ""

        # Get active resume for attachment
        active_resume = (
            Resume.objects.filter(user=request.user)
            .order_by("-uploaded_at")
            .first()
        )
        attachment_data = None
        attachment_filename = None
        if active_resume and active_resume.file:
            try:
                active_resume.file.open("rb")
                attachment_data = active_resume.file.read()
                attachment_filename = active_resume.original_filename
                active_resume.file.close()
            except Exception as exc:
                logger.warning("Could not read resume file for reply attachment: %s", exc)
                active_resume = None

        try:
            returned_thread_id = gmail_send(
                email_account,
                to=to_email,
                subject=subject,
                body=body,
                attachment_data=attachment_data,
                attachment_filename=attachment_filename,
                thread_id=thread_id,
                in_reply_to_msg_id=reply_log.gmail_message_id,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create outbound reply EmailLog
        EmailLog.objects.create(
            job_application=app,
            direction="outbound",
            type="reply",
            in_reply_to=reply_log,
            subject=subject,
            body=body,
            gmail_thread_id=returned_thread_id,
            resume_attached=active_resume,
        )

        # Mark ReplyLog as responded
        reply_log.responded = True
        reply_log.save(update_fields=["responded"])

        return Response(
            {
                "success": True,
                "thread_id": returned_thread_id,
                "reply_log_id": reply_log.id,
                "responded": True,
                "resume_attached": active_resume.original_filename if active_resume else None,
            },
            status=status.HTTP_200_OK,
        )


    @action(detail=True, methods=["post"], url_path="check-replies")
    def check_replies(self, request, pk=None):
        """Check this application's sent Gmail threads for recruiter replies."""
        from api.tasks import _check_thread_for_replies

        app = self.get_object()
        email_account = EmailAccount.objects.filter(user=request.user).order_by("-connected_at").first()
        if not email_account:
            return Response(
                {"detail": "No connected email account. Please connect your Gmail first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            replies_found = sum(
                _check_thread_for_replies(email_account, email_log)
                for email_log in app.email_logs.filter(gmail_thread_id__gt="")
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        app.refresh_from_db(fields=["status"])
        return Response({"new_replies": replies_found, "status": app.status})
