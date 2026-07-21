"""
API URL configuration.
Phase 1: Added user auth routes.
Phase 2: Added DRF router for JobPosting and JobApplication CRUD.
Phase 3: Added extract endpoint for JD text/file extraction.
Phase 5: Added Gmail OAuth connect/callback and email-accounts/me.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register(r"job-postings", views.JobPostingViewSet, basename="jobposting")
router.register(
    r"job-applications", views.JobApplicationViewSet, basename="jobapplication"
)

urlpatterns = [
    path("health/", views.health_check, name="health-check"),
    # Auth endpoints
    path("auth/signup/", views.signup, name="auth-signup"),
    path(
        "auth/login/",
        views.MyTokenObtainPairView.as_view(),
        name="auth-token-obtain",
    ),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/test-protected/", views.test_protected, name="auth-test-protected"),
    # JD extraction (Phase 3) — must be before router include
    path(
        "job-applications/extract/",
        views.extract_jd,
        name="job-application-extract",
    ),
    # Gmail OAuth (Phase 5)
    path(
        "email-accounts/oauth/connect/",
        views.oauth_connect,
        name="email-oauth-connect",
    ),
    path(
        "email-accounts/oauth/callback/",
        views.oauth_callback,
        name="email-oauth-callback",
    ),
    path(
        "email-accounts/me/",
        views.email_account_me,
        name="email-account-me",
    ),
    # CRUD endpoints (DRF Router)
    path("", include(router.urls)),
]
