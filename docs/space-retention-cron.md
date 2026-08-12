# Space Retention Cron Job

Deleted spaces stay restorable for 14 days. Archived spaces stay reopenable for 7 days. The backend starts a scheduled space-retention job by default to hard-delete expired deleted spaces and expire archived-space reopen windows.

Runtime controls:

```text
SPACE_RETENTION_JOB_ENABLED=true
SPACE_RETENTION_JOB_INTERVAL_SECONDS=86400
```

Set `SPACE_RETENTION_JOB_ENABLED=false` to disable the background job. The default interval is 24 hours.

Run manually from the project root:

```bash
docker compose exec -T backend python -m app.jobs.cleanup_expired_spaces
```

If the backend background job is disabled, an alternative Linux cron entry can run the cleanup daily at midnight:

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
