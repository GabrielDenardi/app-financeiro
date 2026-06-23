import { MAX_ATTACHMENT_BYTES, validateAttachmentFile } from '../attachmentLimits';

describe('attachment limits', () => {
  const baseFile = {
    uri: 'file:///receipt.png',
    name: 'receipt.png',
    mimeType: 'image/png',
    size: 1024,
  };

  it('accepts a bounded receipt', () => {
    expect(validateAttachmentFile(baseFile)).toMatchObject({ mimeType: 'image/png', size: 1024 });
  });

  it('rejects oversized and disguised files before reading bytes', () => {
    expect(() => validateAttachmentFile({ ...baseFile, size: MAX_ATTACHMENT_BYTES + 1 })).toThrow(/10 MB/);
    expect(() => validateAttachmentFile({ ...baseFile, mimeType: 'text/html' })).toThrow(/nao permitido/);
    expect(() => validateAttachmentFile({ ...baseFile, name: '../receipt.png' })).toThrow(/Nome/);
  });
});
