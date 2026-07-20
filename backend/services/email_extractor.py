"""
Shared email extractor — regex-based, used by the extract endpoint.

README.md §2: "Email detection is regex-based, not AI-based. Cheap,
synchronous, runs client-side on paste and server-side after file
extraction. If no email is found, the field stays empty and required —
never guess/hallucinate one."
"""

import re

# Same pattern used on the frontend (Apply.jsx / App.jsx prototype).
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def extract_email(text: str) -> str:
    """Return the first email address found in *text*, or "" if none."""
    match = _EMAIL_RE.search(text)
    return match.group(0) if match else ""
