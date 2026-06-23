/// <reference path="../deno-globals.d.ts" />

import {
  buildDataUrl,
  callOpenAIJson,
  corsHeaders,
  enforceEdgeSecurity,
  normalizeDraft,
  requireAuthenticatedUser,
} from '../_shared/transactionParsing.ts';
import {
  OCR_MAX_BYTES,
  OCR_MIME_TYPES,
  PayloadValidationError,
  readBoundedJsonRequest,
  validateBase64Payload,
} from '../_shared/securityControls.ts';

const OCR_SCHEMA = {
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
    const payload = await readBoundedJsonRequest(request, OCR_MAX_BYTES);
    const validated = validateBase64Payload({
      base64Data: String(payload.base64Data ?? ''),
      fileName: String(payload.fileName ?? 'documento'),
      mimeType: String(payload.mimeType ?? 'application/octet-stream'),
      allowedMimeTypes: OCR_MIME_TYPES,
      maxDecodedBytes: OCR_MAX_BYTES,
    });
    const { base64Data, fileName, mimeType } = validated;
    await enforceEdgeSecurity(authContext, {
      quota: 'ocr',
      units: validated.decodedBytes,
    });

    const userContent =
      mimeType.startsWith('image/')
        ? [
            {
              type: 'input_text',
              text:
                'Extraia os principais dados desta nota fiscal ou comprovante brasileiro e devolva apenas o JSON solicitado.',
            },
            {
              type: 'input_image',
              image_url: buildDataUrl(mimeType, base64Data),
              detail: 'high',
            },
          ]
        : [
            {
              type: 'input_text',
              text:
                'Extraia os principais dados deste arquivo de comprovante brasileiro e devolva apenas o JSON solicitado.',
            },
            {
              type: 'input_file',
              filename: fileName,
              file_data: buildDataUrl(mimeType, base64Data),
            },
          ];

    const parsed = await callOpenAIJson<Record<string, unknown>>({
      model: Deno.env.get('OPENAI_OCR_MODEL') ?? 'gpt-4.1-mini',
      instructions: [
        'Voce recebe notas fiscais, notinhas e comprovantes brasileiros.',
        'Extraia os campos principais para um rascunho de transacao financeira.',
        'Prefira valores totais pagos ou recebidos.',
        'Se nao houver certeza sobre valor, tipo ou data, devolva null no campo e explique em warnings.',
        'Use paymentMethod entre: Pix, Transferencia, Dinheiro, Cartao de credito, Cartao de debito, Boleto.',
        'Use suggestedCategoryCode entre os codigos comuns de financas pessoais, como food, transport, housing, shopping, health, education, leisure, services, taxes, salary, freelance, investments, gifts, other.',
        'Use occurredAt em ISO 8601 quando souber a data; se souber apenas a data, use meia-noite UTC.',
        'notes deve resumir informacoes uteis encontradas no documento.',
      ].join(' '),
      userContent,
      schema: OCR_SCHEMA,
      schemaName: 'parsed_transaction_ocr',
    });

    const draft = normalizeDraft(parsed, JSON.stringify({ fileName, mimeType }), 'Lancamento por OCR');

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

    const message = error instanceof Error ? error.message : 'Falha ao processar o OCR.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
