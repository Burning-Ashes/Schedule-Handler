/**
 * Single source of truth for the backend API base URL.
 * - In development: falls back to http://localhost:8000
 * - In production: set VITE_API_URL in Vercel environment variables
 */
const rawApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const API_BASE = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;
