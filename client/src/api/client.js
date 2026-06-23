import axios from 'axios';

// In dev, VITE_API_URL is empty and requests go through the Vite proxy.
// In prod, set VITE_API_URL to the deployed API origin.
const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

const api = axios.create({ baseURL });

// Attach the JWT (if present) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise error messages so components can show err.message directly.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
