import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the httpOnly refresh-token cookie
});

let accessToken: string | null = null;
let refreshingPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

function reportClientError(error: any) {
  try {
    const url = error?.config?.url || '';
    if (!url || url.includes('/activity-tracking') || url.includes('/auth/') || error?.response?.status === 401) return;
    const sessionId = sessionStorage.getItem('jfc_activity_session_id') || '';
    client.post('/activity-tracking/error', {
      path: window.location.pathname + window.location.search,
      sessionId,
      source: 'api',
      message: error?.response?.data?.message || error?.message || 'Request failed',
      status: error?.response?.status || 0,
      method: error?.config?.method?.toUpperCase() || '',
      endpoint: url,
      userAgent: navigator.userAgent,
    }).catch(() => {});
  } catch {}
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    reportClientError(error);
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        if (!refreshingPromise) {
          refreshingPromise = client
            .post('/auth/refresh')
            .then((r) => {
              const newToken = r.data.data.accessToken as string;
              setAccessToken(newToken);
              return newToken;
            })
            .finally(() => {
              refreshingPromise = null;
            });
        }
        const newToken = await refreshingPromise;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return client(original);
        }
      } catch (refreshErr) {
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
