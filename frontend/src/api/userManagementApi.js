import axiosClient from './axiosClient';

export async function listManagedUsers({
  page = 1,
  pageSize = 20,
  search = '',
  status = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
} = {}) {
  const params = {
    page,
    page_size: pageSize,
    sort_by: sortBy,
    sort_order: sortOrder,
  };

  const trimmedSearch = search.trim();
  if (trimmedSearch) params.search = trimmedSearch;
  if (status) params.status = status;

  const response = await axiosClient.get('/users', { params });
  return response.data;
}

export async function getManagedUser(userId) {
  const response = await axiosClient.get(`/users/${userId}`);
  return response.data;
}

export async function updateManagedUser(userId, payload) {
  const response = await axiosClient.patch(`/users/${userId}`, payload);
  return response.data;
}

export async function updateManagedUserStatus(userId, status) {
  const response = await axiosClient.patch(`/users/${userId}/status`, { status });
  return response.data;
}

export async function updateManagedUserLockStatus(userId, locked) {
  const response = await axiosClient.patch(`/users/${userId}/lock-status`, { locked });
  return response.data;
}
