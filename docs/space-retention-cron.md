# Space Retention Cron Job

Deleted spaces stay restorable for 14 days. Archived spaces stay reopenable for 7 days. After that, run the cleanup job to hard-delete expired deleted spaces and expire archived-space reopen windows.

Run manually from the project root:

```bash
docker compose exec -T backend python -m app.jobs.cleanup_expired_spaces
```

Example Linux cron entry, daily at midnight:

```cron
0 0 * * * cd /path/to/Task_Managerment_System && docker compose exec -T backend python -m app.jobs.cleanup_expired_spaces
```

The public restore API remains:

```text
POST /api/v1/spaces/{space_id}/restore
```

Only the space owner can restore a deleted space, and only before the 14-day retention period expires.

The public reopen API for archived spaces is:

```text
POST /api/v1/spaces/{space_id}/unarchive
```

Only the space owner can reopen an archived space, and only before the 7-day reopen window expires. Once the cron job expires the reopen window, the Spaces API returns `can_reopen: false`, so the frontend hides the Reopen button.
