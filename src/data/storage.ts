/**
 * On the phone: a small SQLite-backed key-value store (expo-sqlite/kv-store), included in Expo Go.
 * The web version is in storage.web.ts.
 */
import Storage from 'expo-sqlite/kv-store';

import { STORAGE_KEY } from './state';

export function loadSaved(): string | null {
  try {
    return Storage.getItemSync(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function save(json: string): void {
  try {
    Storage.setItemSync(STORAGE_KEY, json);
  } catch {
    // Nothing useful to do; the next change tries again.
  }
}

export function clearSaved(): void {
  try {
    Storage.removeItemSync(STORAGE_KEY);
  } catch {
    // ignore
  }
}
