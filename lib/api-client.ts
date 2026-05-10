// When running inside Capacitor (file:// protocol), API calls need an absolute URL
// When running in a browser (same-server mode), relative URLs work fine
const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'https://text-adventure-game-blush.vercel.app';
  }
  return '';
})();

export async function apiFetch(path: string, options?: RequestInit) {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res;
}
