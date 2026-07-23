from datetime import datetime, timezone, timedelta

def vietnam_now() -> datetime:
    """Return naive datetime representing the current time in Vietnam (UTC+7)."""
    return datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)
