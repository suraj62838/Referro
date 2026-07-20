"""
DRF serializers.
Phase 1: Auth serializers (SignupSerializer, MyTokenObtainPairSerializer).
Phase 2: Added JobPostingSerializer, JobApplicationSerializer.
"""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import JobApplication, JobPosting


# ── Auth serializers ──────────────────────────────────────────


class SignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="A user with this email already exists.",
            )
        ],
    )
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ("email", "password")

    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email,  # Use email as the username
            email=email,
            password=validated_data["password"],
        )
        return user


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make the username field optional so we can accept email instead
        self.fields[self.username_field].required = False

    def validate(self, attrs):
        # Fallback to email if username is not provided
        username = attrs.get("username") or attrs.get("email")
        if not username:
            raise serializers.ValidationError(
                "Either username or email is required."
            )

        attrs["username"] = username
        data = super().validate(attrs)
        data["user"] = {
            "email": self.user.email,
        }
        return data


# ── CRUD serializers ──────────────────────────────────────────


class JobPostingSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for job postings.
    `posted_by` is set automatically from request.user in the viewset."""

    posted_by_email = serializers.EmailField(
        source="posted_by.email", read_only=True
    )

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "posted_by",
            "posted_by_email",
            "company_name",
            "role_title",
            "jd_text",
            "recruiter_email",
            "location",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "posted_by", "posted_by_email", "created_at"]


class JobApplicationSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for job applications.
    `user` is set automatically from request.user in the viewset."""

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "user",
            "job_posting",
            "company_name",
            "role_title",
            "jd_text",
            "recruiter_email",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at"]
