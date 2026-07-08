"""
API URL configuration.
Phase 1: Added user auth routes.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

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
]
