import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'crewaa_access_token';
const REFRESH_TOKEN_KEY = 'crewaa_refresh_token';

const isWeb = Platform.OS === 'web';

export async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
      }
    } catch {
      // Storage unavailable in private browsing mode
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {
    // SecureStore write failed
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(ACCESS_TOKEN_KEY);
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(REFRESH_TOKEN_KEY);
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch {
      // Ignore
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore deletion errors on already-cleared storage
  }
}
