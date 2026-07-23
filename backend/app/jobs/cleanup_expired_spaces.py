from app.db.session import SessionLocal
from app.repository.space import (
    cleanup_expired_archived_space_reopen_windows,
    cleanup_expired_deleted_spaces,
)


def run() -> tuple[int, int]:
    db = SessionLocal()
    try:
        deleted_count = cleanup_expired_deleted_spaces(db)
        expired_reopen_count = cleanup_expired_archived_space_reopen_windows(db)
        return deleted_count, expired_reopen_count
    finally:
        db.close()


def main() -> None:
    deleted_count, expired_reopen_count = run()
    print(f"Expired deleted spaces hard-deleted: {deleted_count}")
    print(f"Archived space reopen windows expired: {expired_reopen_count}")


if __name__ == "__main__":
    main()
