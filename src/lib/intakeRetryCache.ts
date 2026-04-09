const RETRY_SOURCE_MAX_BYTES = 2_000_000;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export interface IntakeRetrySource {
  encoding: 'base64';
  payload: string;
  fileName: string;
  fileType: string;
  lastModified: number;
  sizeBytes: number;
}

export function buildIntakeRetrySource(file: File): Promise<{ retrySource?: IntakeRetrySource; reason?: string }> {
  if (!Number.isFinite(file.size) || file.size <= 0) return Promise.resolve({ reason: 'Original file bytes are empty.' });
  if (file.size > RETRY_SOURCE_MAX_BYTES) {
    return Promise.resolve({ reason: `Retry parse cache is limited to ${Math.round(RETRY_SOURCE_MAX_BYTES / (1024 * 1024))} MB files.` });
  }
  return file.arrayBuffer().then((buffer) => ({
    retrySource: {
      encoding: 'base64' as const,
      payload: bytesToBase64(new Uint8Array(buffer)),
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      lastModified: file.lastModified || Date.now(),
      sizeBytes: file.size,
    },
  })).catch(() => ({ reason: 'Could not persist original file bytes for retry.' }));
}

export function fileFromIntakeRetrySource(source: IntakeRetrySource): File {
  const bytes = base64ToBytes(source.payload);
  const safeBytes = Uint8Array.from(bytes);
  return new File([safeBytes], source.fileName, { type: source.fileType, lastModified: source.lastModified });
}
