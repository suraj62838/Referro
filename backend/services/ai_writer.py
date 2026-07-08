"""
Shared AI writer service.
Phase 0 — placeholder. Phase 4 will implement the generate() function
that backs both JD generation and email drafting endpoints.
See README.md section 1: "one shared backend service (services/ai_writer.py)"
"""


def generate(prompt: str, context: dict | None = None) -> str:
    """
    Call the LLM API to generate text.

    Args:
        prompt: The generation prompt.
        context: Optional dict of additional context (jd_text, user profile, etc.)

    Returns:
        Generated text string.

    Raises:
        NotImplementedError: Until Phase 4 implementation.
    """
    raise NotImplementedError("AI writer not implemented yet — see Phase 4.")
