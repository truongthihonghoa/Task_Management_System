export function getApiErrorMessage(error, fallback = 'An unexpected error occurred.') {
  if (!error?.response) {
    return 'Unable to connect to the server.';
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
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(' ') || fallback;
  }

  return fallback;
}
