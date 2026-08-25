"""
Django settings for referro_backend project.
Configured per README.md: PostgreSQL via DATABASE_URL, JWT auth,
Celery + Celery Beat via REDIS_URL, CORS for frontend dev server.
"""

import base64
import hashlib
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


# ============================================================
# Base configuration
# ============================================================

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "django-insecure-change-me-in-production",
)

DEBUG = os.getenv("DEBUG", "False").lower() in (
    "true",
    "1",
    "yes",
)


# ============================================================
# Allowed Hosts
# ============================================================

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
]

render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME")

if render_hostname:
    ALLOWED_HOSTS.append(render_hostname)

# Optional: allow explicit production hostname
if "referro-rfga.onrender.com" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("referro-rfga.onrender.com")


# ============================================================
# Apps
# ============================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",

    # Local
    "api",
]


# ============================================================
# Middleware
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "referro_backend.urls"


# ============================================================
# Templates
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "referro_backend.wsgi.application"


# ============================================================
# Database
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL"
) or "sqlite:///" + str(BASE_DIR / "db.sqlite3")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
    )
}


# ============================================================
# Password validation
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME":
        "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.MinimumLengthValidator"
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.CommonPasswordValidator"
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.NumericPasswordValidator"
    },
]


# ============================================================
# Django REST Framework
# ============================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),

    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
        "api.permissions.IsVerifiedUser",
    ),

    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),

    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",
        "user": "100/minute",
        "extract": "15/minute",
        "generate_jd": "10/minute",
        "draft_email": "15/minute",
        "create_posting": "20/hour",
        "resend_code": "1/minute",
    },
}


# ============================================================
# JWT Authentication
# ============================================================

SIMPLE_JWT = {
    # Access token is short-lived
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),

    # Keep users logged in for 30 days
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),

    # Issue a new refresh token when refreshing
    "ROTATE_REFRESH_TOKENS": True,

    # Do not blacklist the old refresh token
    "BLACKLIST_AFTER_ROTATION": False,

    "SIGNING_KEY": os.getenv(
        "JWT_SIGNING_KEY",
        SECRET_KEY,
    ),

    "AUTH_HEADER_TYPES": ("Bearer",),
}


# ============================================================
# CORS
# ============================================================

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        (
            "http://localhost:5173,"
            "http://localhost:5174,"
            "http://127.0.0.1:5173,"
            "http://127.0.0.1:5174,"
            "https://referro-eosin.vercel.app"
        ),
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True


# ============================================================
# CSRF
# ============================================================

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CSRF_TRUSTED_ORIGINS",
        (
            "http://localhost:5173,"
            "http://localhost:5174,"
            "http://127.0.0.1:5173,"
            "http://127.0.0.1:5174,"
            "https://referro-eosin.vercel.app"
        ),
    ).split(",")
    if origin.strip()
]


# ============================================================
# Celery
# ============================================================

CELERY_BROKER_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0",
)

CELERY_RESULT_BACKEND = CELERY_BROKER_URL

CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"


CELERY_BEAT_SCHEDULE = {
    "poll-replies-every-5-min": {
        "task": "api.tasks.poll_replies",
        "schedule": 300.0,
    },
}


# ============================================================
# Internationalization
# ============================================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True
USE_TZ = True


# ============================================================
# Static files
# ============================================================

STATIC_URL = "static/"


# ============================================================
# Media files
# ============================================================

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ============================================================
# Google OAuth
# ============================================================

GOOGLE_OAUTH_CLIENT_ID = os.getenv(
    "GOOGLE_OAUTH_CLIENT_ID",
    "",
)

GOOGLE_OAUTH_CLIENT_SECRET = os.getenv(
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "",
)

GOOGLE_OAUTH_REDIRECT_URI = os.getenv(
    "GOOGLE_OAUTH_REDIRECT_URI",
    "http://localhost:8000/api/email-accounts/oauth/callback/",
)


# ============================================================
# Frontend URL
# ============================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
)


# ============================================================
# Field-level encryption
# ============================================================

_raw_key = os.getenv(
    "FIELD_ENCRYPTION_KEY",
    "",
)

if _raw_key:
    FIELD_ENCRYPTION_KEY = _raw_key.encode()
else:
    _digest = hashlib.sha256(
        SECRET_KEY.encode()
    ).digest()

    FIELD_ENCRYPTION_KEY = base64.urlsafe_b64encode(
        _digest
    )


# ============================================================
# Brevo
# ============================================================

BREVO_API_KEY = os.getenv(
    "BREVO_API_KEY",
    "",
)

BREVO_SENDER_EMAIL = os.getenv(
    "BREVO_SENDER_EMAIL",
    os.getenv(
        "DEFAULT_FROM_EMAIL",
        "noreply@referro.app",
    ),
)


# ============================================================
# Email
# ============================================================

EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
)

EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True

EMAIL_HOST_USER = os.getenv(
    "EMAIL_HOST_USER",
    "",
)

EMAIL_HOST_PASSWORD = os.getenv(
    "EMAIL_HOST_PASSWORD",
    "",
)

DEFAULT_FROM_EMAIL = EMAIL_HOST_USER