const rawBaseUrl = import.meta.env.VITE_BASE_URL?.trim();

export const apiBaseUrl = rawBaseUrl
  ? (/^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`).replace(/\/+$/, '')
  : '';
