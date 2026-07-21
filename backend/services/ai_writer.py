"""
Shared AI writer service utilizing the Groq Chat Completions API.
"""

import json
import os
import sys

from django.conf import settings
from groq import Groq


def generate(prompt: str, context: dict | None = None) -> str:
    """
    Call the Groq Chat Completions API to generate text.
    """

    print("Inside generate()")

    is_testing = "test" in sys.argv or os.getenv("DJANGO_TESTING") == "true"
    api_key = os.getenv("GROQ_API_KEY")

    # -----------------------------
    # Debug Information
    # -----------------------------
    print("\n" + "=" * 60)
    print("Groq AI Writer Debug")
    print("=" * 60)
    print("Testing Mode :", is_testing)
    print("DEBUG        :", settings.DEBUG)
    print("API Key Found:", bool(api_key))

    if api_key:
        print("API Key      :", api_key[:10] + "...")
    else:
        print("API Key      : None")

    print("=" * 60)

    # -----------------------------
    # Mock Mode
    # -----------------------------
    if is_testing or not api_key:
        if is_testing or settings.DEBUG:

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

        raise ValueError("GROQ_API_KEY environment variable is not set.")

    # -----------------------------
    # Groq API
    # -----------------------------
    print("\nSending request to Groq...")

    try:
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
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

        print("\nGroq Response (Success)")
        print("-" * 60)
        print(generated_text)
        print("-" * 60)

        return generated_text

    except Exception as e:
        print("\n" + "=" * 60)
        print("GROQ ERROR")
        print("=" * 60)
        print(type(e).__name__)
        print(str(e))
        print("=" * 60)

        raise RuntimeError(f"Groq API call failed: {str(e)}")