export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a',
]);

export type AttachmentFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export function validateAttachmentFile<T extends AttachmentFile>(file: T): T & { mimeType: string } {
  const mimeType = file.mimeType.toLowerCase().split(';', 1)[0].trim();
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    throw new Error('Tipo de arquivo nao permitido.');
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('O arquivo deve ter no maximo 10 MB.');
  }
  if (!file.name.trim() || file.name.length > 120 || /[\\/\0]/.test(file.name)) {
    throw new Error('Nome de arquivo invalido.');
  }
  return { ...file, mimeType };
}
