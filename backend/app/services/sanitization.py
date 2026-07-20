import re

def sanitize_text(val: str) -> str:
    """
    Strips HTML/XML tags from a string to prevent XSS.
    If the value is not a string, returns it as-is.
    """
    if not isinstance(val, str) or not val:
        return val
    # Strip HTML tags
    clean = re.sub(r'<[^>]*>', '', val)
    return clean
