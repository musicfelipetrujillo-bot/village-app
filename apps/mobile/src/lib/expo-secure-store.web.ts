// Web stub for expo-secure-store.
// SecureStore is a native keychain API unavailable on web.
// Fall back to localStorage so Supabase auth sessions persist
// across browser refreshes during dev preview.
export async function getItemAsync(key: string): Promise<string | null> {
  try { return localStorage.getItem(key); } catch { return null; }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try { localStorage.setItem(key, value); } catch {}
}

export async function deleteItemAsync(key: string): Promise<void> {
  try { localStorage.removeItem(key); } catch {}
}

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
