export function getSessionToken() {
  try {
    const saved = sessionStorage.getItem('hb_active_session');
    if (!saved) return null;
    return JSON.parse(saved).token || null;
  } catch {
    return null;
  }
}

export async function apiFetch(url, options = {}) {
  const token = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && url !== '/api/auth/login') {
    window.dispatchEvent(new CustomEvent('hb:unauthorized'));
  }
  return response;
}