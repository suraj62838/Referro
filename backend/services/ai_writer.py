"""
Shared AI writer service utilizing the Groq Chat Completions API.
"""

import json
import urllib.request
import urllib.error
import os
import sys
from django.conf import settings


def generate(prompt: str, context: dict | None = None) -> str:
    """
    Call the Groq Chat Completions API to generate text.

    Args:
        prompt: The generation prompt.
        context: Optional dict of additional context (jd_text, user profile, etc.)

    Returns:
        Generated text string.

    Raises:
        ValueError: If GROQ_API_KEY is not set and fallback is not available.
        RuntimeError: If Groq API request fails.
    """
    is_testing = "test" in sys.argv or os.getenv("DJANGO_TESTING") == "true"
    api_key = os.getenv("GROQ_API_KEY")

    if is_testing or not api_key:
        if is_testing or settings.DEBUG:
            # Fallback to mock generation for local development and unit tests
            if "email" in prompt.lower() or "outreach" in prompt.lower() or "subject" in prompt.lower():
                company = context.get("company_name", "Company") if context else "Company"
                role = context.get("role_title", "Role") if context else "Role"
                user_name = context.get("user_name", "Applicant") if context else "Applicant"
                return json.dumps({
                    "subject": f"Application for {role} role at {company}",
                    "body": (
                        f"Hi there,\n\n"
                        f"I came across the opening for {role} at {company} and wanted to reach out directly. "
                        f"The scope of the role lines up closely with my background, and I'd welcome the chance to talk.\n\n"
                        f"Best,\n{user_name}"
                    )
                })
            else:
                role = context.get("role_title", "Software Engineer") if context else "Software Engineer"
                seniority = context.get("seniority", "Senior") if context else "Senior"
                skills = context.get("key_skills", "Python, React") if context else "Python, React"
                notes = context.get("notes", "") if context else ""
                return (
                    f"We're hiring a {seniority} {role} to join our team. "
                    f"You'll work primarily with {skills}, owning features end-to-end. "
                    f"{notes}"
                )
        raise ValueError("GROQ_API_KEY environment variable is not set.")


    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7,
        "max_tokens": 1024
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            choices = res_data.get("choices", [])
            if choices and isinstance(choices, list):
                message = choices[0].get("message", {})
                content = message.get("content", "")
                return content
            return ""
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"Groq API call failed: {e.code} - {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Groq API call failed: {str(e)}")
