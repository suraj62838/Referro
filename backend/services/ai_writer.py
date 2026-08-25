"""
Shared AI writer service utilizing the Groq Chat Completions API.
"""

import json
import logging
import os
import sys

from django.conf import settings
from groq import Groq

logger = logging.getLogger(__name__)


def generate(prompt: str, context: dict | None = None) -> str:
    """
    Call the Groq Chat Completions API to generate text.
    """
    is_testing = "test" in sys.argv or os.getenv("DJANGO_TESTING") == "true"
    api_key = os.getenv("GROQ_API_KEY")

    # Mock mode for unit tests or offline dev environment without API key
    if is_testing or (settings.DEBUG and not api_key):
        if (
            "email" in prompt.lower()
            or "outreach" in prompt.lower()
            or "subject" in prompt.lower()
        ):
            company = context.get("company_name", "Company") if context else "Company"
            role = context.get("role_title", "Role") if context else "Role"
            user_name = context.get("user_name", "Applicant") if context else "Applicant"

            return json.dumps(
                {
                    "subject": f"Application for {role} role at {company}",
                    "body": (
                        f"Hi there,\n\n"
                        f"I came across the opening for {role} at {company} and wanted to reach out directly. "
                        f"The scope of the role lines up closely with my background, and I'd welcome the chance to discuss further.\n\n"
                        f"Best regards,\n{user_name}"
                    ),
                }
            )

        role = context.get("role_title", "Software Engineer") if context else "Software Engineer"
        seniority = context.get("seniority", "Senior") if context else "Senior"
        skills = context.get("key_skills", "Python, React") if context else "Python, React"
        notes = context.get("notes", "") if context else ""

        return (
            f"We're hiring a {seniority} {role} to join our team. "
            f"You'll work primarily with {skills}, owning features end-to-end. "
            f"{notes}"
        )

    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set.")

    try:
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            temperature=0.7,
            max_tokens=1024,
        )

        generated_text = response.choices[0].message.content.strip()

        # Remove markdown code fences if present (e.g. ```json ... ```)
        if generated_text.startswith("```json"):
            generated_text = generated_text[7:]
        elif generated_text.startswith("```"):
            generated_text = generated_text[3:]
        if generated_text.endswith("```"):
            generated_text = generated_text[:-3]
        generated_text = generated_text.strip()
        if generated_text.startswith("json\n") or generated_text.startswith("json\r\n"):
            generated_text = generated_text.split("\n", 1)[1].strip()

        # Strip remaining markdown formatting symbols
        generated_text = (
            generated_text
            .replace("**", "")
            .replace("###", "")
            .replace("##", "")
            .replace("#", "")
            .replace("{", "")
            .replace("}", "")
            .replace("(", "")
            .replace(")", "")
        )

        return generated_text

    except Exception as e:
        logger.error("Groq API call failed: %s: %s", type(e).__name__, str(e))
        raise RuntimeError(f"Groq API call failed: {str(e)}")