"""
app.text_formatter
------------------
Converts Markdown-formatted AI responses into clean plain text
suitable for mobile app display (no Markdown rendering available).
"""

from __future__ import annotations

import re


def strip_markdown(text: str) -> str:
    """
    Convert Markdown-formatted text to clean, readable plain text.
    
    Strips: headings (#), bold/italic (** / *), tables (|...|),
    horizontal rules (---), code fences (```), and link syntax.
    Preserves: emojis, numbered lists, content, line breaks.
    """
    if not text:
        return text

    lines = text.split("\n")
    result_lines: list[str] = []
    in_code_block = False

    for line in lines:
        stripped = line.strip()

        # Toggle code blocks — remove the fence lines
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue

        # Inside a code block keep content as-is
        if in_code_block:
            result_lines.append(line)
            continue

        # Skip horizontal rules
        if re.match(r"^[-*_]{3,}\s*$", stripped):
            result_lines.append("")
            continue

        # Skip pure table separator rows (|---|---|)
        if re.match(r"^\|[\s\-:|]+\|$", stripped):
            continue

        # Convert table rows:  | A | B | C |  →  A  |  B  |  C
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            line = "  |  ".join(cells)

        # Remove heading markers:  ### Heading  →  Heading
        line = re.sub(r"^#{1,6}\s+", "", line)

        # Remove bold + italic wrapping:  ***text***  →  text
        line = re.sub(r"\*{3}(.+?)\*{3}", r"\1", line)
        # Remove bold:  **text**  →  text
        line = re.sub(r"\*{2}(.+?)\*{2}", r"\1", line)
        # Remove italic:  *text*  →  text  (but not bullet points)
        line = re.sub(r"(?<!\s)\*([^\s*][^*]*?)\*(?!\s)", r"\1", line)

        # Remove underline bold/italic:  __text__  →  text, _text_  →  text
        line = re.sub(r"_{2}(.+?)_{2}", r"\1", line)
        line = re.sub(r"(?<!\w)_([^_]+?)_(?!\w)", r"\1", line)

        # Remove inline code:  `code`  →  code
        line = re.sub(r"`([^`]+?)`", r"\1", line)

        # Convert Markdown links:  [text](url)  →  text
        line = re.sub(r"\[([^\]]+?)\]\([^)]+?\)", r"\1", line)

        # Convert image links:  ![alt](url)  →  alt
        line = re.sub(r"!\[([^\]]*?)\]\([^)]+?\)", r"\1", line)

        # Convert bullet points:  - item  or  * item  →  • item
        line = re.sub(r"^(\s*)[-*]\s+", r"\1• ", line)

        # Remove blockquote markers:  > text  →  text
        line = re.sub(r"^>\s?", "", line)

        result_lines.append(line)

    # Join and clean up excessive blank lines (max 2 consecutive)
    text = "\n".join(result_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
