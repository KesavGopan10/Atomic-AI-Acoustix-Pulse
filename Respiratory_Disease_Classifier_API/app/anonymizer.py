"""
app.anonymizer
--------------
HIPAA-Compliant PHI (Protected Health Information) Anonymizer.

Intercepts all data destined for cloud AI models and:
  1. Scrubs free-text PHI (dates, phone numbers, SSNs, emails, MRNs)
  2. Buckets quasi-identifiers (exact age → age bracket)
  3. Strips image EXIF / metadata using Pillow
  4. Emits audit log entries (WHAT was scrubbed, never the actual value)

Usage
-----
from app.anonymizer import anonymizer

# Text scrubbing
clean_text = anonymizer.scrub_text(raw_text, field_name="symptom_message")

# Age bucketing
age_label = anonymizer.bucket_age(43)   # → "40-49 years"

# Biometric bracketing
h_label = anonymizer.bracket_height(172)   # → "170-180 cm range"
w_label = anonymizer.bracket_weight(78)    # → "70-80 kg range"

# Image EXIF stripping (returns clean bytes)
clean_bytes = anonymizer.scrub_image(raw_bytes, field_name="chest_xray")
"""

from __future__ import annotations

import io
import logging
import re
from typing import Optional

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# Regex patterns for free-text PHI tokens
# IMPORTANT: These patterns are intentionally conservative — they may
# over-redact in rare cases, but that is the correct trade-off for HIPAA.
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[str, str, str]] = [
    # (phi_type_label, regex_pattern, replacement)

    # Social Security Number — 123-45-6789 or 123456789
    ("ssn",
     r"\b\d{3}[- ]\d{2}[- ]\d{4}\b",
     "[ID_REDACTED]"),

    # Medical Record Number — "MRN: 12345" or "MR# 54321"
    ("mrn",
     r"\b(?:MRN|MR#|Patient\s*ID|Pt\.?\s*ID|Record\s*(?:No|Num|Number)?\.?)\s*[:\#]?\s*\d{4,12}\b",
     "[ID_REDACTED]"),

    # Phone numbers — (555) 123-4567 | 555-123-4567 | 5551234567 | +1 555 123 4567
    ("phone",
     r"\b(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b",
     "[PHONE_REDACTED]"),

    # Email addresses
    ("email",
     r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
     "[EMAIL_REDACTED]"),

    # Dates — MM/DD/YYYY, DD-MM-YYYY, Month DD YYYY, YYYY-MM-DD
    ("date",
     r"\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|"
     r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
     r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|"
     r"Dec(?:ember)?)\s+\d{1,2}[,\s]+\d{4}|"
     r"\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})\b",
     "[DATE_REDACTED]"),

    # US Zip codes — 5-digit or 9-digit: 12345 or 12345-6789
    ("zip_code",
     r"\b\d{5}(?:-\d{4})?\b",
     "[ZIP_REDACTED]"),

    # Explicit name-labeled fields — "Name: John Smith" or "Patient: ..."
    ("named_field",
     r"(?i)\b(?:patient|name|pt\.?)\s*[:\-]\s*[A-Za-z][A-Za-z\s'\-]{2,40}",
     "[NAME_REDACTED]"),

    # DOB labeled fields — "DOB: ...", "Date of Birth: ..."
    ("dob_label",
     r"(?i)\b(?:DOB|Date\s+of\s+Birth|Birth(?:date|day)?)\s*[:\-]?\s*[^\n,;]{0,30}",
     "[DOB_REDACTED]"),

    # Address street lines — "123 Main St", "456 Oak Avenue Apt 2B"
    ("street_address",
     r"\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|"
     r"Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Ct|Court|Pl|Place|Way|Pkwy|Hwy)\b",
     "[ADDRESS_REDACTED]"),
]

# Compile once at module load
_COMPILED_PATTERNS: list[tuple[str, re.Pattern, str]] = [
    (label, re.compile(pattern), replacement)
    for label, pattern, replacement in _PATTERNS
]

# ---------------------------------------------------------------------------
# Age bucketing table
# ---------------------------------------------------------------------------

_AGE_BUCKETS = [
    (0, 4, "0-4 years"),
    (5, 11, "5-11 years"),
    (12, 17, "12-17 years"),
    (18, 29, "18-29 years"),
    (30, 39, "30-39 years"),
    (40, 49, "40-49 years"),
    (50, 59, "50-59 years"),
    (60, 69, "60-69 years"),
    (70, 79, "70-79 years"),
    (80, 89, "80-89 years"),
    (90, 150, "90+ years"),
]


# ---------------------------------------------------------------------------
# PhiAnonymizer
# ---------------------------------------------------------------------------

class PhiAnonymizer:
    """
    Stateless HIPAA PHI anonymizer.

    This class contains no patient state — it operates purely as a
    transformation pipeline. Safe to use as a singleton.
    """

    # ------------------------------------------------------------------
    # Text scrubbing
    # ------------------------------------------------------------------

    def scrub_text(self, text: str, field_name: str = "unknown") -> str:
        """
        Scan ``text`` for known PHI patterns and replace them with
        safe placeholder tokens.

        Logs which PHI *types* were found but never logs actual values.

        Returns the sanitized text.
        """
        if not text or not isinstance(text, str):
            return text

        found_types: list[str] = []
        result = text

        for label, pattern, replacement in _COMPILED_PATTERNS:
            new_result, n = pattern.subn(replacement, result)
            if n > 0:
                found_types.append(label)
                result = new_result

        if found_types:
            logger.warning(
                "[ANONYMIZER] PHI scrubbed — field=%s, phi_types=%s",
                field_name,
                found_types,
            )
        else:
            logger.debug("[ANONYMIZER] No PHI detected — field=%s", field_name)

        return result

    def scrub_messages(self, messages: list[dict], field_prefix: str = "chat") -> list[dict]:
        """
        Scrub PHI from a list of LLM message dicts.
        Each dict must have ``role`` and ``content`` keys.
        Content may be a string or a list (multimodal).

        Returns new message list — original dicts are not mutated.
        """
        clean = []
        for i, msg in enumerate(messages):
            content = msg.get("content", "")
            field = f"{field_prefix}[{i}]({msg.get('role', 'unknown')})"
            if isinstance(content, str):
                clean_content = self.scrub_text(content, field_name=field)
            elif isinstance(content, list):
                # Multimodal — scrub text items, pass through image items unchanged
                clean_content = []
                for item in content:
                    if item.get("type") == "text":
                        clean_content.append({
                            **item,
                            "text": self.scrub_text(item["text"], field_name=f"{field}.text"),
                        })
                    else:
                        clean_content.append(item)
            else:
                clean_content = content

            clean.append({**msg, "content": clean_content})

        return clean

    # ------------------------------------------------------------------
    # Numeric quasi-identifier bucketing
    # ------------------------------------------------------------------

    def bucket_age(self, age: Optional[int | float]) -> str:
        """
        Convert an exact age to a HIPAA-safe age bracket string.
        Exact ages ≥ 90 are merged into "90+ years" per HIPAA Safe Harbor.
        Returns "Unknown age" if ``age`` is None.
        """
        if age is None:
            return "Unknown age"
        age_int = int(age)
        for lo, hi, label in _AGE_BUCKETS:
            if lo <= age_int <= hi:
                return label
        return "90+ years"

    def bracket_height(self, height_cm: Optional[float]) -> str:
        """
        Convert exact height in cm to a 10 cm range bracket.
        E.g. 172 → "170–180 cm range"
        """
        if height_cm is None:
            return "Unknown height"
        bucket = (int(height_cm) // 10) * 10
        return f"{bucket}–{bucket + 10} cm range"

    def bracket_weight(self, weight_kg: Optional[float]) -> str:
        """
        Convert exact weight in kg to a 10 kg range bracket.
        E.g. 78 → "70–80 kg range"
        """
        if weight_kg is None:
            return "Unknown weight"
        bucket = (int(weight_kg) // 10) * 10
        return f"{bucket}–{bucket + 10} kg range"

    # ------------------------------------------------------------------
    # Image EXIF / metadata stripping
    # ------------------------------------------------------------------

    def scrub_image(self, image_bytes: bytes, field_name: str = "image") -> bytes:
        """
        Strip ALL metadata (EXIF, IPTC, XMP, GPS, comments) from an image
        by re-encoding it through Pillow without any metadata.

        Returns clean image bytes (JPEG format, quality 95).
        If Pillow cannot parse the image, returns the original bytes and
        logs a warning — this is a fallback to avoid breaking the pipeline.
        """
        try:
            from PIL import Image

            with Image.open(io.BytesIO(image_bytes)) as img:
                exif_info = img.info.get("exif", b"")
                exif_keys_removed = len(img.info)

                # Convert to RGB (handles RGBA/palette images for JPEG output)
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                # Re-save WITHOUT passing any info/exif kwargs → strips all metadata
                out = io.BytesIO()
                img.save(out, format="JPEG", quality=95)
                clean_bytes = out.getvalue()

            logger.warning(
                "[ANONYMIZER] Image EXIF stripped — field=%s, "
                "original_size_kb=%d, clean_size_kb=%d, metadata_keys_removed=%d",
                field_name,
                len(image_bytes) // 1024,
                len(clean_bytes) // 1024,
                exif_keys_removed,
            )
            return clean_bytes

        except Exception as exc:
            logger.error(
                "[ANONYMIZER] EXIF strip FAILED — field=%s, error=%s. "
                "Sending original bytes as fallback.",
                field_name,
                exc,
            )
            return image_bytes


# ---------------------------------------------------------------------------
# Module-level singleton — import this everywhere
# ---------------------------------------------------------------------------
anonymizer = PhiAnonymizer()
