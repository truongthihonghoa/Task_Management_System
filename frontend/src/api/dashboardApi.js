import axiosClient from './axiosClient';

export async function getSuperAdminDashboard() {
  const response = await axiosClient.get('/dashboard/super-admin');
  return response.data;
}

export async function getSpaceSummaryDashboard(spaceId, params = {}) {
  const response = await axiosClient.get(`/dashboard/spaces/${encodeURIComponent(spaceId)}/summary`, {
    params,
  });
  return response.data;
}

export async function getSuperAdminActivitySpaces() {
  const response = await axiosClient.get('/dashboard/super-admin/activity-spaces');
  return response.data;
}

export async function getSuperAdminRecentActivities(params = {}) {
  const response = await axiosClient.get('/dashboard/super-admin/recent-activities', {
    params,
  });
  return response.data;
}

export async function getSuperAdminAuditLogs(params = {}) {
  const response = await axiosClient.get('/dashboard/super-admin/audit-logs', {
    params,
  });
  return response.data;
}

export async function getSuperAdminAuditLogDetail(logId) {
  const response = await axiosClient.get(
    `/dashboard/super-admin/audit-logs/${encodeURIComponent(logId)}`,
  );
  return response.data;
}

export async function getSuperAdminAssignmentHistory(params = {}) {
  const response = await axiosClient.get('/dashboard/super-admin/assignment-history', {
    params,
  });
  return response.data;
}
