import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 90000 });
export const errorMessage = error => error.response?.data?.error?.message || 'We could not reach the case desk. Check your connection and try again.';
export default api;
