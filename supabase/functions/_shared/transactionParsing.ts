/// <reference path="../deno-globals.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export type AuthenticatedContext = {
  supabase: ReturnType<typeof createUserClient>;
  userId: string;
};

export function createUserClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export async function enforceEdgeSecurity(
  context: AuthenticatedContext,
  {
    entitlement,
    quota,
    units,
  }: { entitlement?: 'voice_capture' | 'data_import_export'; quota: 'ocr' | 'voice'; units: number },
) {
  if (entitlement) {
    const { error } = await context.supabase.rpc('assert_entitlement', {
      p_feature: entitlement,
    });
    if (error) {
      throw new Response(JSON.stringify({ error: 'Recurso indisponivel no plano atual.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { error: quotaError } = await context.supabase.rpc('consume_edge_quota', {
    p_feature: quota,
    p_units: units,
  });
  if (quotaError) {
    throw new Response(JSON.stringify({ error: 'Limite de uso temporario atingido.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedContext> {
  const authHeader = request.headers.get('Authorization');
  const supabase = createUserClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'Nao autenticado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return {
    supabase,
    userId: data.user.id,
  };
}

export function decodeBase64(base64Data: string) {
  const normalized = base64Data.includes(',') ? base64Data.split(',').pop() ?? '' : base64Data;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function buildDataUrl(mimeType: string, base64Data: string) {
  const normalized = base64Data.includes(',') ? base64Data.split(',').pop() ?? '' : base64Data;
  return `data:${mimeType};base64,${normalized}`;
}

function extractJsonText(responseBody: Record<string, unknown>) {
  const outputText = responseBody.output_text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText;
  }

  const output = Array.isArray(responseBody.output) ? responseBody.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: Array<{ text?: string; type?: string }> }).content)
      : [];

    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }

  throw new Error('A OpenAI nao retornou conteudo estruturado.');
}

export async function callOpenAIJson<T>({
  model,
  instructions,
  userContent,
  schema,
  schemaName,
}: {
  model: string;
  instructions: string;
  userContent: Array<Record<string, unknown>>;
  schema: Record<string, unknown>;
  schemaName: string;
}): Promise<T> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada na Edge Function.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: instructions }],
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          schema,
        },
      },
    }),
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const errorMessage =
      (responseBody as { error?: { message?: string } }).error?.message ??
      'Falha ao consultar a OpenAI.';
    throw new Error(errorMessage);
  }

  const rawJson = extractJsonText(responseBody as Record<string, unknown>);
  return JSON.parse(rawJson) as T;
}

export async function transcribeAudio({
  base64Data,
  fileName,
  mimeType,
}: {
  base64Data: string;
  fileName: string;
  mimeType: string;
}) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada na Edge Function.');
  }

  const bytes = decodeBase64(base64Data);
  const formData = new FormData();
  formData.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe');
  formData.append('language', 'pt');
  formData.append(
    'file',
    new Blob([bytes], { type: mimeType || 'audio/webm' }),
    fileName || 'gravacao.webm',
  );

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const errorMessage =
      (responseBody as { error?: { message?: string } }).error?.message ??
      'Falha ao transcrever o audio.';
    throw new Error(errorMessage);
  }

  const transcript = (responseBody as { text?: string }).text?.trim();
  if (!transcript) {
    throw new Error('Nao foi possivel extrair texto do audio enviado.');
  }

  return transcript;
}

export function normalizeDraft(
  rawDraft: Record<string, unknown>,
  rawText: string,
  fallbackTitle: string,
) {
  const warnings = Array.isArray(rawDraft.warnings)
    ? rawDraft.warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    title:
      typeof rawDraft.title === 'string' && rawDraft.title.trim()
        ? rawDraft.title.trim()
        : fallbackTitle,
    amount:
      typeof rawDraft.amount === 'number' && Number.isFinite(rawDraft.amount)
        ? Number(rawDraft.amount.toFixed(2))
        : null,
    type:
      rawDraft.type === 'income' || rawDraft.type === 'expense'
        ? rawDraft.type
        : null,
    paymentMethod:
      typeof rawDraft.paymentMethod === 'string' && rawDraft.paymentMethod.trim()
        ? rawDraft.paymentMethod.trim()
        : 'Transferencia',
    occurredAt:
      typeof rawDraft.occurredAt === 'string' && rawDraft.occurredAt.trim()
        ? rawDraft.occurredAt.trim()
        : new Date().toISOString(),
    suggestedCategoryCode:
      typeof rawDraft.suggestedCategoryCode === 'string' && rawDraft.suggestedCategoryCode.trim()
        ? rawDraft.suggestedCategoryCode.trim()
        : null,
    notes:
      typeof rawDraft.notes === 'string' && rawDraft.notes.trim()
        ? rawDraft.notes.trim()
        : '',
    merchantOrIssuer:
      typeof rawDraft.merchantOrIssuer === 'string' && rawDraft.merchantOrIssuer.trim()
        ? rawDraft.merchantOrIssuer.trim()
        : null,
    documentNumber:
      typeof rawDraft.documentNumber === 'string' && rawDraft.documentNumber.trim()
        ? rawDraft.documentNumber.trim()
        : null,
    warnings,
    rawTranscriptOrOcrText: rawText,
    confidence:
      typeof rawDraft.confidence === 'number' && Number.isFinite(rawDraft.confidence)
        ? Number(rawDraft.confidence)
        : null,
    provider: 'openai' as const,
  };
}
