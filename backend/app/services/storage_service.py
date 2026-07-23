"""Storage adapter for uploaded media.

Local storage remains the default. Cloudinary is used only when
MEDIA_STORAGE=cloudinary is configured.
"""

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status


MAX_UPLOAD_SIZE = 20 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class StoredUpload:
    file_path: str
    file_url: str
    file_size: int
    public_id: str | None = None


def is_cloudinary_enabled() -> bool:
    return os.getenv("MEDIA_STORAGE", "local").strip().lower() == "cloudinary"


def _cloudinary_folder(*parts: str) -> str:
    root = os.getenv("CLOUDINARY_FOLDER", "taskflow").strip().strip("/") or "taskflow"
    clean_parts = [part.strip().strip("/") for part in parts if part and part.strip().strip("/")]
    return "/".join([root, *clean_parts])


def _read_upload_bytes(file: UploadFile, *, max_size: int) -> tuple[bytes, int]:
    total_size = 0
    chunks: list[bytes] = []

    while True:
        chunk = file.file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {max_size // (1024 * 1024)}MB",
            )
        chunks.append(chunk)

    file.file.seek(0)
    return b"".join(chunks), total_size


def upload_to_cloudinary(
    file: UploadFile,
    *,
    folder: str,
    public_id: str,
    max_size: int = MAX_UPLOAD_SIZE,
    resource_type: str = "auto",
) -> StoredUpload:
    try:
        import cloudinary
        import cloudinary.uploader
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary storage is enabled but the cloudinary package is not installed.",
        ) from exc

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary storage is enabled but Cloudinary credentials are missing.",
        )

    file_bytes, file_size = _read_upload_bytes(file, max_size=max_size)
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)

    try:
        result: dict[str, Any] = cloudinary.uploader.upload(
            file_bytes,
            folder=_cloudinary_folder(folder),
            public_id=Path(public_id).stem,
            resource_type=resource_type,
            use_filename=False,
            unique_filename=True,
            overwrite=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload file to Cloudinary.",
        ) from exc

    secure_url = result.get("secure_url") or result.get("url")
    stored_public_id = result.get("public_id")
    if not secure_url or not stored_public_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloudinary upload response is missing required fields.",
        )

    return StoredUpload(
        file_path=stored_public_id,
        file_url=secure_url,
        file_size=file_size,
        public_id=stored_public_id,
    )
