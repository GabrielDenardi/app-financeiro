/// <reference path="../deno-globals.d.ts" />

import {
  callOpenAIJson,
  corsHeaders,
  enforceEdgeSecurity,
  normalizeDraft,
  requireAuthenticatedUser,
  transcribeAudio,
} from '../_shared/transactionParsing.ts';
import {
  assertJsonRequestSize,
  PayloadValidationError,
  validateBase64Payload,
  VOICE_MAX_BYTES,
  VOICE_MIME_TYPES,
} from '../_shared/securityControls.ts';

const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    amount: { type: ['number', 'null'] },
    type: { type: ['string', 'null'], enum: ['income', 'expense', null] },
    paymentMethod: { type: 'string' },
    occurredAt: { type: ['string', 'null'] },
    suggestedCategoryCode: { type: ['string', 'null'] },
    notes: { type: 'string' },
    merchantOrIssuer: { type: ['string', 'null'] },
    documentNumber: { type: ['string', 'null'] },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: ['number', 'null'] },
  },
  required: [
    'title',
    'amount',
    'type',
    'paymentMethod',
    'occurredAt',
    'suggestedCategoryCode',
    'notes',
    'merchantOrIssuer',
    'documentNumber',
    'warnings',
    'confidence',
  ],
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await requireAuthenticatedUser(request);
    assertJsonRequestSize(request.headers.get('content-length'), VOICE_MAX_BYTES);

    const payload = await request.json();
    const validated = validateBase64Payload({
      base64Data: String(payload.base64Data ?? ''),
      fileName: String(payload.fileName ?? 'gravacao.webm'),
      mimeType: String(payload.mimeType ?? 'audio/webm'),
      allowedMimeTypes: VOICE_MIME_TYPES,
      maxDecodedBytes: VOICE_MAX_BYTES,
    });
    const { base64Data, fileName, mimeType } = validated;
    await enforceEdgeSecurity(authContext, {
      entitlement: 'voice_capture',
      quota: 'voice',
      units: validated.decodedBytes,
    });

    const transcript = await transcribeAudio({ base64Data, fileName, mimeType });

    const parsed = await callOpenAIJson<Record<string, unknown>>({
      model: Deno.env.get('OPENAI_PARSER_MODEL') ?? 'gpt-4.1-mini',
      instructions: [
        'Voce recebe uma transcricao em portugues de uma pessoa descrevendo uma transacao financeira.',
        'Converta a fala em um rascunho de transacao.',
        'Se nao houver certeza sobre valor, tipo ou data, devolva null no campo e explique em warnings.',
        'Use paymentMethod entre: Pix, Transferencia, Dinheiro, Cartao de credito, Cartao de debito, Boleto.',
        'Para gastos, prefira type expense; para recebimentos, prefira income.',
        'Use suggestedCategoryCode entre: food, transport, housing, shopping, health, education, leisure, services, taxes, salary, freelance, investments, gifts, other.',
        'Use occurredAt em ISO 8601 quando a fala indicar uma data; se nao indicar, devolva null e inclua aviso.',
        'notes deve preservar contexto util da fala.',
      ].join(' '),
      userContent: [
        {
          type: 'input_text',
          text: transcript,
        },
      ],
      schema: VOICE_SCHEMA,
      schemaName: 'parsed_transaction_voice',
    });

    const draft = normalizeDraft(parsed, transcript, 'Lancamento por voz');

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof PayloadValidationError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = error instanceof Error ? error.message : 'Falha ao processar a voz.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
