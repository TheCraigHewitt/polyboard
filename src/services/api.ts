export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const token = typeof window !== 'undefined'
    ? window.localStorage.getItem('polyboardApiToken')
    : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers, credentials: 'include' });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('polyboard:unauthorized'));
  }
  return response;
}
