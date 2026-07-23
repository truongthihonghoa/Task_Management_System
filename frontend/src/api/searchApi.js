import axiosClient from './axiosClient';

export async function globalSearch({
  q,
  types,
  limitPerType = 5,
  spaceId,
  includeRecent = true,
  signal,
} = {}) {
  const response = await axiosClient.get('/search/global', {
    signal,
    params: {
      q: q || undefined,
      types: types || undefined,
      limit_per_type: limitPerType,
      space_id: spaceId || undefined,
      include_recent: includeRecent,
    },
  });
  return response.data;
}

export async function recordSearchRecent({ entityType, entityId }) {
  await axiosClient.post('/search/recent', {
    entity_type: entityType,
    entity_id: entityId,
  });
}

export async function deleteSearchRecent({ entityType, entityId }) {
  const response = await axiosClient.delete(`/search/recent/${entityType}/${entityId}`);
  return response.data;
}
