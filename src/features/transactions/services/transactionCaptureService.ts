import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { getPlanEntitlements, getUpgradeMessage, normalizePlanId } from '../../plans/plans';
import type { CapturedTransactionDraft, TransactionAttachment, TransactionAttachmentKind } from '../types';

const RECEIPT_BUCKET = 'transaction-receipts';

type ProfilePlanRow = {
  subscription_plan: string | null;
  trial_ends_at: string | null;
};

export type LocalCaptureFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function readFileAsBase64(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function readFileAsBytes(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return new Uint8Array(await response.arrayBuffer());
  }

  const base64 = await readFileAsBase64(uri);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function getFunctionErrorMessage(error: unknown, response?: Response) {
  const fallback =
    error instanceof Error && error.message
      ? error.message
      : 'Nao foi possivel processar o arquivo enviado.';

  const errorContext =
    typeof error === 'object' && error && 'context' in error
      ? (error as { context?: Response }).context
      : undefined;
  const errorResponse = response ?? errorContext;

  if (!errorResponse) {
    return fallback;
  }

  try {
    const contentType = errorResponse.headers.get('Content-Type') ?? '';
    const body = contentType.includes('application/json')
      ? await errorResponse.clone().json()
      : await errorResponse.clone().text();

    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }

    if (body && typeof body === 'object') {
      const message =
        (body as { error?: unknown }).error ??
        (body as { message?: unknown }).message;

      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  } catch {
    // Keep the SDK message if the response body cannot be read.
  }

  return fallback;
}

function mapAttachmentRow(row: {
  id: string;
  user_id: string;
  group_id: string | null;
  transaction_id: string | null;
  group_split_id: string | null;
  attachment_kind: TransactionAttachmentKind;
  source_type: 'manual' | 'voice' | 'ocr';
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  capture_metadata: Record<string, unknown> | null;
  created_at: string;
}): TransactionAttachment {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    transactionId: row.transaction_id,
    groupSplitId: row.group_split_id,
    attachmentKind: row.attachment_kind,
    sourceType: row.source_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    captureMetadata: row.capture_metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function pickImageFromCamera(): Promise<LocalCaptureFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permissao da camera negada.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `camera-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
  };
}

export async function pickImageFromLibrary(): Promise<LocalCaptureFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permissao da galeria negada.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `gallery-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
  };
}

export async function pickDocumentFile(): Promise<LocalCaptureFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/pdf',
    size: asset.size ?? 0,
  };
}

export async function uploadTransactionAttachment({
  file,
  attachmentKind,
  sourceType,
  groupId,
  captureMetadata,
}: {
  file: LocalCaptureFile;
  attachmentKind: TransactionAttachmentKind;
  sourceType: 'manual' | 'voice' | 'ocr';
  groupId?: string | null;
  captureMetadata?: Record<string, unknown>;
}): Promise<TransactionAttachment> {
  const userId = await requireCurrentUserId();
  const storagePath = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const fileBytes = await readFileAsBytes(file.uri);

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from('transaction_attachments')
    .insert({
      user_id: userId,
      group_id: groupId ?? null,
      attachment_kind: attachmentKind,
      source_type: sourceType,
      storage_bucket: RECEIPT_BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.mimeType,
      file_size: file.size,
      capture_metadata: captureMetadata ?? {},
    })
    .select(
      'id, user_id, group_id, transaction_id, group_split_id, attachment_kind, source_type, storage_bucket, storage_path, file_name, mime_type, file_size, capture_metadata, created_at',
    )
    .single();

  if (error) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return mapAttachmentRow(data as Parameters<typeof mapAttachmentRow>[0]);
}

export async function createSignedAttachmentUrl(
  attachment: Pick<TransactionAttachment, 'storageBucket' | 'storagePath'>,
) {
  const { data, error } = await supabase.storage
    .from(attachment.storageBucket)
    .createSignedUrl(attachment.storagePath, 60 * 10);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function deleteTransactionAttachment(
  attachment: Pick<TransactionAttachment, 'id' | 'storageBucket' | 'storagePath'>,
) {
  await supabase.storage.from(attachment.storageBucket).remove([attachment.storagePath]);
  const { error } = await supabase.from('transaction_attachments').delete().eq('id', attachment.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function parseTransactionFromOcr(file: LocalCaptureFile): Promise<CapturedTransactionDraft> {
  const base64Data = await readFileAsBase64(file.uri);
  const { data, error, response } = await supabase.functions.invoke('parse-transaction-ocr', {
    body: {
      fileName: file.name,
      mimeType: file.mimeType,
      base64Data,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, response));
  }

  const draft = (data as { draft?: CapturedTransactionDraft }).draft;
  if (!draft) {
    throw new Error('Nao foi possivel interpretar o documento enviado.');
  }

  return draft;
}

export async function parseTransactionFromVoice(file: LocalCaptureFile): Promise<CapturedTransactionDraft> {
  const userId = await requireCurrentUserId();
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_plan, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const entitlements = getPlanEntitlements(
    normalizePlanId((profileData as ProfilePlanRow | null)?.subscription_plan),
    (profileData as ProfilePlanRow | null)?.trial_ends_at,
  );
  if (!entitlements.voiceCapture) {
    throw new Error(getUpgradeMessage('Cadastro por voz'));
  }

  const base64Data = await readFileAsBase64(file.uri);
  const { data, error, response } = await supabase.functions.invoke('parse-transaction-voice', {
    body: {
      fileName: file.name,
      mimeType: file.mimeType,
      base64Data,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, response));
  }

  const draft = (data as { draft?: CapturedTransactionDraft }).draft;
  if (!draft) {
    throw new Error('Nao foi possivel interpretar o audio enviado.');
  }

  return draft;
}
