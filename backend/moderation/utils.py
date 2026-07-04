def check_content_moderation(text):
    """
    Checks content for guidelines violations using keyword matching.
    Returns (violates, reason)
    """
    if not text:
        return False, None

    # Predefined banned keywords for guidelines violations
    banned_keywords = {
        'spam': ['buy cheap', 'click here for prize', 'make money fast', 'spamlink', 'free cash now'],
        'hate_speech': ['hate group', 'slurword', 'kill them all', 'destroy race', 'white supremacy'],
        'nudity': ['nude pics', 'pornography', 'xxx video', 'naked photos'],
        'harassment': ['doxxing', 'kill yourself', 'fat ugly loser', 'stalking you'],
        'false_information': ['fake cure', 'conspiracy hoax', 'stolen election', 'microchips in vaccine'],
    }

    text_lower = text.lower()
    for reason, keywords in banned_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                return True, reason
    return False, None
