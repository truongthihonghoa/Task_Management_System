const NOTIFICATION_DISPLAY_DAYS = 30;

export const notificationLimitMessage = "That's all your notifications from the last 30 days.";

export function isNotificationWithinDisplayWindow(notification) {
  const createdAt = notification?.created_at || notification?.createdAt;
  if (!createdAt) return true;

  const normalized = String(createdAt).trim().toLowerCase();
  if (
    normalized === 'today' ||
    normalized === 'yesterday' ||
    normalized.includes('sec ago') ||
    normalized.includes('min ago') ||
    normalized.includes('hour ago') ||
    normalized.includes('hours ago')
  ) {
    return true;
  }

  const dayMatch = normalized.match(/^(\d+)\s+days?\s+ago$/);
  if (dayMatch) {
    return Number(dayMatch[1]) <= NOTIFICATION_DISPLAY_DAYS;
  }

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }

  const cutoff = Date.now() - NOTIFICATION_DISPLAY_DAYS * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
}
