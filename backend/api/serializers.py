"""
DRF serializers.
Phase 1: Auth serializers (SignupSerializer, MyTokenObtainPairSerializer).
Phase 2: Added JobPostingSerializer, JobApplicationSerializer.
Phase 6: Added EmailLogSerializer, ReplyLogSerializer, JobApplicationDetailSerializer.
Phase 8: Auth serializers now include is_verified.
Phase 9: Added ResumeSerializer; updated EmailLogSerializer with resume_attached.
"""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import EmailLog, JobApplication, JobPosting, ReplyLog, Resume


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
        # Include is_verified from UserProfile
        is_verified = False
        profile = getattr(self.user, "profile", None)
        if profile:
            is_verified = profile.is_verified
        data["user"] = {
            "email": self.user.email,
            "is_verified": is_verified,
        }
        return data


# ── CRUD serializers ──────────────────────────────────────────


class JobPostingSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for job postings.
    `posted_by` is set automatically from request.user in the viewset."""

    posted_by_email = serializers.EmailField(
        source="posted_by.email", read_only=True
    )
    recruiter_email = serializers.EmailField(
        required=False, allow_blank=True, default=""
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

    recruiter_email = serializers.EmailField(
        required=False, allow_blank=True, default=""
    )
    is_self_application = serializers.SerializerMethodField()
    warning = serializers.SerializerMethodField()

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
            "is_self_application",
            "warning",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at", "is_self_application", "warning"]

    def get_is_self_application(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if obj.job_posting and obj.job_posting.posted_by_id == request.user.id:
            return True
        if obj.recruiter_email and request.user.email and obj.recruiter_email.lower() == request.user.email.lower():
            return True
        return False

    def get_warning(self, obj):
        if self.get_is_self_application(obj):
            return "Warning: You are applying to your own job posting."
        return None


# ── Phase 6: Timeline / detail serializers ────────────────────


class EmailLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for sent email records."""

    class Meta:
        model = EmailLog
        fields = [
            "id",
            "direction",
            "type",
            "in_reply_to",
            "subject",
            "body",
            "resume_attached",
            "sent_at",
            "gmail_thread_id",
        ]
        read_only_fields = fields


class ResumeSerializer(serializers.ModelSerializer):
    """Read-only serializer for resume metadata."""

    class Meta:
        model = Resume
        fields = ["id", "original_filename", "uploaded_at"]
        read_only_fields = fields


class ReplyLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for detected reply records."""

    class Meta:
        model = ReplyLog
        fields = [
            "id",
            "snippet",
            "body",
            "gmail_message_id",
            "received_at",
            "responded",
        ]
        read_only_fields = fields


class JobApplicationDetailSerializer(JobApplicationSerializer):
    """Extended serializer for the application detail/retrieve view.
    Includes nested email_logs and reply_logs for the timeline display."""

    email_logs = EmailLogSerializer(many=True, read_only=True)
    reply_logs = ReplyLogSerializer(many=True, read_only=True)

    class Meta(JobApplicationSerializer.Meta):
        fields = JobApplicationSerializer.Meta.fields + [
            "email_logs",
            "reply_logs",
        ]
