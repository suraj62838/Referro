"""
API views.
Phase 1: Added user auth views (signup, custom token view).
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import MyTokenObtainPairSerializer, SignupSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Simple liveness probe — returns 200 with status ok."""
    return Response({"status": "ok"})


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

