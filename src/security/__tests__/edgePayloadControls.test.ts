import {
  assertJsonRequestSize,
  OCR_MAX_BYTES,
  OCR_MIME_TYPES,
  PayloadValidationError,
  validateBase64Payload,
} from '../../../supabase/functions/_shared/securityControls';

describe('Edge payload controls', () => {
  const validBase64 = Buffer.from('receipt').toString('base64');

  it('accepts a bounded allowlisted payload', () => {
    expect(
      validateBase64Payload({
        base64Data: validBase64,
        mimeType: 'image/png',
        fileName: 'receipt.png',
        allowedMimeTypes: OCR_MIME_TYPES,
        maxDecodedBytes: OCR_MAX_BYTES,
      }).decodedBytes,
    ).toBe(7);
  });

  it('rejects oversized content before JSON/base64 decoding', () => {
    expect(() => assertJsonRequestSize(String(20 * 1024 * 1024), OCR_MAX_BYTES)).toThrow(
      PayloadValidationError,
    );
  });

  it('rejects non-allowlisted media and malformed base64', () => {
    expect(() =>
      validateBase64Payload({
        base64Data: 'not base64!',
        mimeType: 'text/html',
        fileName: 'payload.html',
        allowedMimeTypes: OCR_MIME_TYPES,
        maxDecodedBytes: OCR_MAX_BYTES,
      }),
    ).toThrow(PayloadValidationError);
  });
});
