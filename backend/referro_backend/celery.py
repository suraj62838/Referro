"""
Celery application for referro_backend.
Configured against REDIS_URL (see settings.py).
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "referro_backend.settings")

app = Celery("referro_backend")
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps (looks for tasks.py in each app).
app.autodiscover_tasks()
