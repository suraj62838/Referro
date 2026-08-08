"""
DRF permission class that blocks unverified users.
Phase 8: Applied globally alongside IsAuthenticated.
"""

from rest_framework.permissions import BasePermission


class IsVerifiedUser(BasePermission):
    """Blocks authenticated-but-unverified users from protected endpoints.

    Views that should be accessible pre-verification (verify-email,
    resend-code, login, signup) must override permission_classes to exclude
    this class (usually via AllowAny or IsAuthenticated-only).

    Returns a clear 403 error message rather than a generic denial.
    """

    message = "Email not verified. Please check your inbox for the 6-digit code."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            # Let IsAuthenticated handle unauthenticated requests first
            return True

        # Access the UserProfile; if it doesn't exist yet, deny
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return False

        return profile.is_verified
