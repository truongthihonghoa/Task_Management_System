import axiosClient from './axiosClient';

export async function getNotifications(params = {}) {
  const response = await axiosClient.get('/notifications', { params });
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await axiosClient.get('/notifications/unread-count');
  return response.data;
}

export async function markNotificationsRead({ target = 'all', notificationIds = [] } = {}) {
  const response = await axiosClient.patch('/notifications/read-state', {
    target,
    is_read: true,
    notification_ids: target === 'selected' ? notificationIds : undefined,
  });
  return response.data;
}

export async function getNotificationDetail(notificationId) {
  const response = await axiosClient.get(`/notifications/${notificationId}`);
  return response.data;
}

export async function deleteNotification(notificationId) {
  await axiosClient.delete(`/notifications/${notificationId}`);
}
