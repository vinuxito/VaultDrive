export interface StoredUserCache {
  id?: string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  is_admin?: boolean;
  pin_set?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  organization_name?: string | null;
  force_password_change?: boolean;
  private_key_encrypted?: string | null;
  private_key_pin_encrypted?: string | null;
  public_key?: string | null;
  [key: string]: unknown;
}

export function getNormalizedErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }

  if (typeof error === "string") {
    const message = error.trim();
    return message || fallback;
  }

  return fallback;
}

export function readLocalStorageJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`Failed to parse localStorage key \"${key}\". Clearing corrupt value.`, error);
      localStorage.removeItem(key);
      return null;
    }
  } catch (error) {
    console.warn(`Failed to read localStorage key \"${key}\".`, error);
    return null;
  }
}

export function getStoredUserFromLocalStorage(): StoredUserCache | null {
  return readLocalStorageJSON<StoredUserCache>("user");
}
