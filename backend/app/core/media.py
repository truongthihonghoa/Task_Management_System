import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", BACKEND_DIR / "media")).resolve()
MEDIA_FOLDERS = {
    "attachment": "attachments",
    "comment": "comments",
    "description": "descriptions",
}


def ensure_media_dirs() -> None:
    for folder in MEDIA_FOLDERS.values():
        (MEDIA_ROOT / folder).mkdir(parents=True, exist_ok=True)


def get_media_folder(usage: str, task_id: str) -> Path:
    folder = MEDIA_FOLDERS[usage]
    path = MEDIA_ROOT / folder / task_id
    path.mkdir(parents=True, exist_ok=True)
    return path
