"""
Text extraction from uploaded files (PDF, DOCX, images).

Used by the extract endpoint to convert file uploads into plain text
before running the shared email extractor.
"""

import io

from django.core.files.uploadedfile import UploadedFile


# Allowed MIME types → handler name mapping.
_MIME_HANDLERS = {
    "application/pdf": "_extract_pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "_extract_docx",
    # Common image types — routed to OCR.
    "image/png": "_extract_image",
    "image/jpeg": "_extract_image",
    "image/jpg": "_extract_image",
    "image/webp": "_extract_image",
    "image/tiff": "_extract_image",
    "image/bmp": "_extract_image",
}

ALLOWED_CONTENT_TYPES = set(_MIME_HANDLERS.keys())

# 5 MB max file size.
MAX_FILE_SIZE = 5 * 1024 * 1024

# Extension to MIME type fallback
_EXT_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".bmp": "image/bmp",
}


def extract_text_from_file(file: UploadedFile) -> str:
    """Extract plain text from an uploaded file.

    Parameters
    ----------
    file : UploadedFile
        Django/DRF uploaded file object.

    Returns
    -------
    str
        Extracted text (may be empty if the file has no readable text).

    Raises
    ------
    ValueError
        If the MIME type is unsupported or the file is too large.
    """
    import os

    content_type = file.content_type or ""

    # Fallback to extension if content_type is generic/missing
    if content_type not in _MIME_HANDLERS and file.name:
        ext = os.path.splitext(file.name)[1].lower()
        if ext in _EXT_MIME:
            content_type = _EXT_MIME[ext]

    if content_type not in _MIME_HANDLERS:
        raise ValueError(
            f"Unsupported file type: {content_type or 'unknown'}. "
            f"Accepted types: PDF, DOCX, PNG, JPEG, WEBP."
        )

    if file.size and file.size > MAX_FILE_SIZE:
        raise ValueError(
            f"File too large ({file.size / 1024 / 1024:.1f} MB). "
            f"Maximum allowed size is {MAX_FILE_SIZE / 1024 / 1024:.0f} MB."
        )

    handler_name = _MIME_HANDLERS[content_type]
    handler = globals()[handler_name]
    return handler(file)


# ── Individual parsers ────────────────────────────────────────


def _extract_pdf(file: UploadedFile) -> str:
    """Extract text from a PDF file using PyPDF2."""
    from PyPDF2 import PdfReader

    file.seek(0)
    reader = PdfReader(io.BytesIO(file.read()))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def _extract_docx(file: UploadedFile) -> str:
    """Extract text from a DOCX file using python-docx."""
    import docx

    file.seek(0)
    document = docx.Document(io.BytesIO(file.read()))
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _extract_image(file: UploadedFile) -> str:
    """Extract text from an image using Tesseract OCR."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise ValueError(
            "Image OCR requires pytesseract and Pillow. "
            "Please install them and ensure Tesseract is available on the system PATH."
        ) from exc

    file.seek(0)
    image = Image.open(io.BytesIO(file.read()))
    text = pytesseract.image_to_string(image)
    return text.strip()
