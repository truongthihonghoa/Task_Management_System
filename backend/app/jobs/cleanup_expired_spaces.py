from app.db.session import SessionLocal
from app.repository.space import cleanup_expired_deleted_spaces


def run() -> int:
    db = SessionLocal()
    try:
        return cleanup_expired_deleted_spaces(db)
    finally:
        db.close()


def main() -> None:
    deleted_count = run()
    print(f"Expired deleted spaces hard-deleted: {deleted_count}")


if __name__ == "__main__":
    main()
