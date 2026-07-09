from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_auth = HTTPBearer(
    auto_error=False,
    description="Paste JWT access token here. Use Bearer authentication.",
)


def get_optional_bearer_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_auth),
) -> Optional[str]:
    if not credentials:
        return None
    return credentials.credentials
