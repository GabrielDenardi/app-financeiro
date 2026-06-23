import {
  assertJsonRequestSize,
  OCR_MAX_BYTES,
  OCR_MIME_TYPES,
  PayloadValidationError,
  readBoundedJsonRequest,
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

  it('bounds chunked requests even without a content-length header', async () => {
    const validRequest = new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ base64Data: validBase64 }),
    });
    await expect(readBoundedJsonRequest(validRequest, OCR_MAX_BYTES)).resolves.toMatchObject({
      base64Data: validBase64,
    });

    const oversizedRequest = new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ payload: 'x'.repeat(70 * 1024) }),
    });
    await expect(readBoundedJsonRequest(oversizedRequest, 1)).rejects.toMatchObject({ status: 413 });
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
