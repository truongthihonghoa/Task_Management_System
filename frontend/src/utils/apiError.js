export function getApiErrorMessage(error, fallback = 'An unexpected error occurred.') {
  if (!error?.response) {
    return fallback;
  }

  const data = error.response.data;
  const detail = data?.detail;

  if (typeof data?.message === 'string') {
    return data.message;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail[0]?.msg || fallback;
  }

  if (detail?.message) {
    return detail.message;
  }

  return fallback;
}
