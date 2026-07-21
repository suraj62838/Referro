"""
Admin registrations for the API app.
Phase 2: Register JobPosting, JobApplication, EmailLog, ReplyLog.
Phase 5: Register EmailAccount.
"""

from django.contrib import admin

from .models import EmailAccount, EmailLog, JobApplication, JobPosting, ReplyLog


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ("role_title", "company_name", "posted_by", "location", "is_active", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("role_title", "company_name")


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("role_title", "company_name", "user", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("role_title", "company_name")


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ("job_application", "subject", "sent_at")
    list_filter = ("sent_at",)


@admin.register(ReplyLog)
class ReplyLogAdmin(admin.ModelAdmin):
    list_display = ("job_application", "snippet", "received_at")
    list_filter = ("received_at",)


@admin.register(EmailAccount)
class EmailAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "email_address", "connected_at")
    list_filter = ("provider", "connected_at")
    search_fields = ("email_address",)
    # Tokens are encrypted — don't display them in admin
    exclude = ("_access_token", "_refresh_token")

