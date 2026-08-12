from app.services.space_retention_service import purge_expired_spaces


def run() -> tuple[int, int]:
    return purge_expired_spaces()


def main() -> None:
    deleted_count, expired_reopen_count = run()
    print(f"Expired deleted spaces hard-deleted: {deleted_count}")
    print(f"Archived space reopen windows expired: {expired_reopen_count}")


if __name__ == "__main__":
    main()
