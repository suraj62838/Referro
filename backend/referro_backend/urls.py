"""
Root URL configuration for referro_backend.
All API routes are namespaced under /api/.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]
