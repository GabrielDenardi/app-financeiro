export const OCR_MAX_BYTES = 8 * 1024 * 1024;
export const VOICE_MAX_BYTES = 10 * 1024 * 1024;
export const JSON_OVERHEAD_BYTES = 64 * 1024;

export const OCR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const VOICE_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
] as const;

export class PayloadValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PayloadValidationError';
    this.status = status;
  }
}

export function maxEncodedLength(maxDecodedBytes: number) {
  return Math.ceil(maxDecodedBytes / 3) * 4;
}

export function assertJsonRequestSize(contentLength: string | null, maxDecodedBytes: number) {
  if (!contentLength) return;
  const length = Number(contentLength);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new PayloadValidationError('Content-Length invalido.');
  }
  if (length > maxEncodedLength(maxDecodedBytes) + JSON_OVERHEAD_BYTES) {
    throw new PayloadValidationError('Payload excede o limite permitido.', 413);
  }
}

export function validateBase64Payload({
  base64Data,
  mimeType,
  fileName,
  allowedMimeTypes,
  maxDecodedBytes,
}: {
  base64Data: string;
  mimeType: string;
  fileName: string;
  allowedMimeTypes: readonly string[];
  maxDecodedBytes: number;
}) {
  const normalized = base64Data.includes(',') ? base64Data.slice(base64Data.indexOf(',') + 1) : base64Data;
  const normalizedMime = mimeType.toLowerCase().split(';', 1)[0].trim();
  const safeName = fileName.trim();

  if (!normalized || normalized.length > maxEncodedLength(maxDecodedBytes)) {
    throw new PayloadValidationError('Arquivo excede o limite permitido.', 413);
  }
  if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new PayloadValidationError('Conteudo base64 invalido.');
  }
  if (!allowedMimeTypes.includes(normalizedMime)) {
    throw new PayloadValidationError('Tipo de arquivo nao permitido.', 415);
  }
  if (!safeName || safeName.length > 120 || /[\\/\0]/.test(safeName)) {
    throw new PayloadValidationError('Nome de arquivo invalido.');
  }

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const decodedBytes = (normalized.length / 4) * 3 - padding;
  if (decodedBytes < 1 || decodedBytes > maxDecodedBytes) {
    throw new PayloadValidationError('Arquivo excede o limite permitido.', 413);
  }

  return { base64Data: normalized, mimeType: normalizedMime, fileName: safeName, decodedBytes };
}
