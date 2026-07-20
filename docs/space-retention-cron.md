# Space Retention Cron Job

Deleted spaces stay restorable for 14 days. After that, run the cleanup job to hard-delete expired spaces and their related data.

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
