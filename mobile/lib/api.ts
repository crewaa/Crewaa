import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

/**
 * Resolve the backend URL dynamically:
 * 1. If EXPO_PUBLIC_API_URL is set, use it.
 * 2. On Expo Go / physical devices, extract the host machine's LAN IP from Constants.expoConfig?.hostUri.
 * 3. On Android emulator without hostUri, use 10.0.2.2:8000.
 * 4. On web or iOS simulator, fallback to localhost:8000.
 */
function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Detect Expo Go development server IP (e.g. 10.127.24.35:8081 -> http://10.127.24.35:8000)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number | null;
  detail: string;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = message;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from SecureStore/storage before each request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function readableDetail(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const { loc, msg } = item as { loc?: unknown[]; msg?: string };
          if (!msg) return null;
          const field = Array.isArray(loc)
            ? loc.filter((p) => p !== 'body' && p !== 'query').join(' ')
            : '';
          return field ? `${field}: ${msg}` : msg;
        }
        return null;
      })
      .filter(Boolean) as string[];

    if (messages.length) return messages.join('. ');
  }

  return 'Something went wrong';
}

/**
 * Single-flight silent re-authentication for mobile.
 */
let refreshInFlight: Promise<string | null> | null = null;
const NO_REFRESH = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/google'];

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return null;

        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              'x-refresh-token': refreshToken,
              Cookie: `refresh_token=${refreshToken}`,
            },
          }
        );

        const newAccessToken = res.data.access_token as string;
        const newRefreshToken = (res.data.refresh_token as string) || refreshToken;
        await saveTokens(newAccessToken, newRefreshToken);
        return newAccessToken;
      } catch {
        await clearTokens();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ detail?: unknown }>) => {
    if (error.response) {
      const status = error.response.status;
      const detail = readableDetail(error.response.data?.detail);
      const config = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

      const canRetry =
        status === 401 &&
        config &&
        !config._retried &&
        !NO_REFRESH.some((path) => (config.url ?? '').includes(path));

      if (canRetry) {
        config._retried = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(config);
        }
      }

      throw new ApiError(detail, status);
    }

    throw new ApiError(error.message || 'Network error', null);
  }
);
