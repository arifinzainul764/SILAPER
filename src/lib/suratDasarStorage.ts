const DB_NAME = 'silaper_attachments';
const DB_VERSION = 1;
const STORE_NAME = 'surat_dasar_pdfs';

export interface StoredSuratDasarRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
  ownerId?: string;
  updatedAt: number;
}

const memoryFallback = new Map<string, StoredSuratDasarRecord>();

function openAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Gagal membuka penyimpanan lampiran lokal.'));
  });
}

function isOwnerAuthorized(
  recordOwnerId: string | undefined,
  requesterOwnerId?: string,
  allowAnyOwner = false,
): boolean {
  if (allowAnyOwner) return true;
  if (!requesterOwnerId || !recordOwnerId) return true;
  return recordOwnerId === requesterOwnerId;
}

export async function saveSuratDasarPdf(
  id: string,
  file: Blob,
  name: string,
  ownerId?: string,
): Promise<void> {
  const cleanOwner = (ownerId || '').trim();
  const record: StoredSuratDasarRecord = {
    id,
    name,
    size: file.size,
    mimeType: file.type || 'application/pdf',
    blob: file,
    ...(cleanOwner ? { ownerId: cleanOwner } : {}),
    updatedAt: Date.now(),
  };
  memoryFallback.set(id, record);

  try {
    const db = await openAttachmentDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal menyimpan file PDF Surat Dasar.'));
      };
    });
  } catch {
    // Fallback to in-memory map if IndexedDB is restricted
  }
}

export async function getSuratDasarPdf(
  id: string,
  requesterOwnerId?: string,
  allowAnyOwner = false,
): Promise<StoredSuratDasarRecord | null> {
  if (!id) return null;
  const cached = memoryFallback.get(id);

  try {
    const db = await openAttachmentDb();
    const record = await new Promise<StoredSuratDasarRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredSuratDasarRecord | undefined) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('Gagal membaca file PDF Surat Dasar.'));
      };
    });
    if (record) {
      if (!isOwnerAuthorized(record.ownerId, requesterOwnerId, allowAnyOwner)) {
        return null;
      }
      memoryFallback.set(id, record);
      return record;
    }
  } catch {
    // Fall back to in-memory copy if IndexedDB is blocked
  }

  if (cached && isOwnerAuthorized(cached.ownerId, requesterOwnerId, allowAnyOwner)) {
    return cached;
  }
  return null;
}

export async function deleteSuratDasarPdf(
  id: string,
  requesterOwnerId?: string,
  allowAnyOwner = false,
): Promise<void> {
  if (!id) return;

  if (!allowAnyOwner && requesterOwnerId) {
    const existing = await getSuratDasarPdf(id, undefined, true);
    if (existing?.ownerId && existing.ownerId !== requesterOwnerId) {
      return;
    }
  }

  memoryFallback.delete(id);

  try {
    const db = await openAttachmentDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function readSmallPdfAsDataUrl(
  file: File,
  maxDataUrlLength: number,
): Promise<string> {
  // Base64 expands binary by ~34% + data URI prefix
  const estimatedBase64Length = Math.ceil((file.size * 4) / 3) + 40;
  if (estimatedBase64Length > maxDataUrlLength) {
    return '';
  }

  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.length <= maxDataUrlLength ? result : '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export function dataUrlToPdfBlob(dataUrl?: string): Blob | null {
  if (!dataUrl || !dataUrl.startsWith('data:application/pdf')) return null;
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const byteString = window.atob(parts[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i += 1) {
      bytes[i] = byteString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  } catch {
    return null;
  }
}

export function formatPdfFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
