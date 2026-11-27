import axios from 'axios';
import { createReadPool } from './readPool';

// Use /api in dev (via Vite proxy) and in production (on Vercel).
// An explicit VITE_API_URL or VITE_API_BASE_URL can override when hosting backend separately.
const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fantasy_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

const readPool = createReadPool(api.get.bind(api), () => localStorage.getItem('fantasy_auth_token') || '');
api.get = async (url, config = {}) => {
  const owner = localStorage.getItem('fantasy_auth_token');
  try { return await readPool.get(url, config); }
  catch (error) {
    // A committed mutation invalidates pending reads. Retry once against the
    // committed state, but never retry a view cancellation or account switch.
    if (error.code === 'ERR_CANCELED' && !config.signal?.aborted && owner === localStorage.getItem('fantasy_auth_token')) {
      return readPool.get(url, config);
    }
    throw error;
  }
};
export const clearPendingReads = readPool.clear;
window.addEventListener('storage', event => {
  if (!event.key || event.key === 'fantasy_auth_token') clearPendingReads();
});
api.interceptors.response.use(response => {
  if (!['get', 'head', 'options'].includes(response.config.method)) {
    clearPendingReads();
    window.dispatchEvent(new Event('fantasy-data-changed'));
  }
  return response;
});
export default api;
