"""
API views.
Phase 1: Added user auth views (signup, custom token view).
Phase 2: Added JobPostingViewSet and JobApplicationViewSet (full CRUD).
Phase 3: Added extract_jd endpoint for JD text/file extraction + email detection.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from services.email_extractor import extract_email
from services.text_extractor import (
    ALLOWED_CONTENT_TYPES,
    extract_text_from_file,
)

from .models import JobApplication, JobPosting
from .serializers import (
    JobApplicationSerializer,
    JobPostingSerializer,
    MyTokenObtainPairSerializer,
    SignupSerializer,
)


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
    """Register a new user and return JWT access/refresh tokens."""
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyTokenObtainPairView(TokenObtainPairView):
    """Custom TokenObtainPairView returning user details in response."""

    serializer_class = MyTokenObtainPairSerializer


@api_view(["GET"])
def test_protected(request):
    """Simple protected endpoint for testing authentication."""
    return Response({"message": "authenticated"})


# ── JD extraction (Phase 3) ───────────────────────────────────


@api_view(["POST"])
@parser_classes([MultiPartParser, JSONParser])
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
    """

    serializer_class = JobApplicationSerializer

    def get_queryset(self):
        return JobApplication.objects.filter(
            user=self.request.user
        ).select_related("job_posting")

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
            import json
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

