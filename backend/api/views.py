"""
API views.
Phase 1: Added user auth views (signup, custom token view).
Phase 2: Added JobPostingViewSet and JobApplicationViewSet (full CRUD).
Phase 3: Added extract_jd endpoint for JD text/file extraction + email detection.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
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
