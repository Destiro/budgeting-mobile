/**
 * In a browser: localStorage. It can be unavailable (private browsing, blocked site data),
 * so every call is guarded and the app still runs, just without saving.
 */
import { STORAGE_KEY } from './state';

export function loadSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function save(json: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // ignore
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
