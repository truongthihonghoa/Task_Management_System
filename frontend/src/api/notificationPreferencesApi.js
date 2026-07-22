import axiosClient from './axiosClient';

export async function getNotificationPreference(scope) {
  const response = await axiosClient.get(`/notification-preferences/${scope}`);
  return response.data;
}

export async function updateNotificationPreference(scope, payload) {
  const response = await axiosClient.put(`/notification-preferences/${scope}`, payload);
  return response.data;
}

export async function resetNotificationPreference(scope) {
  const response = await axiosClient.post(`/notification-preferences/${scope}/reset`);
  return response.data;
}
