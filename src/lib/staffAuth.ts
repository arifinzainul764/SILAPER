import { AuthorizedStaff } from '../types/report';

const STAFF_REGISTRY_KEY = 'silaper_staff_registry';
const ACTIVE_STAFF_SESSION_KEY = 'silaper_staff_session';

export function normalizeNipKey(nip: string): string {
  return (nip || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 60);
}

export function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashStaffPassword(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyStaffPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  if (!saltHex || !expectedHash) return false;
  const computed = await hashStaffPassword(password, saltHex);
  return computed === expectedHash;
}

export function readLocalStaffRegistry(): AuthorizedStaff[] {
  try {
    const raw = localStorage.getItem(STAFF_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthorizedStaff[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalStaffRegistry(staffList: AuthorizedStaff[]): void {
  try {
    localStorage.setItem(STAFF_REGISTRY_KEY, JSON.stringify(staffList));
  } catch {
    // Ignore storage quota errors
  }
}

export function readActiveStaffSession(): AuthorizedStaff | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_STAFF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthorizedStaff;
    return parsed && typeof parsed === 'object' && parsed.nipKey ? parsed : null;
  } catch {
    return null;
  }
}

export function writeActiveStaffSession(staff: AuthorizedStaff | null): void {
  try {
    if (!staff) {
      sessionStorage.removeItem(ACTIVE_STAFF_SESSION_KEY);
    } else {
      sessionStorage.setItem(ACTIVE_STAFF_SESSION_KEY, JSON.stringify(staff));
    }
  } catch {
    // Ignore sessionStorage errors
  }
}
