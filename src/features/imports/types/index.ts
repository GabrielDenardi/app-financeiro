export type ImportPreviewRow = {
  rowIndex: number;
  fingerprint: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  categoryCode: string;
  paymentMethod: string;
  occurredOn: string;
  status: 'accepted' | 'duplicate' | 'failed';
  errorMessage: string;
  rawData: Record<string, unknown>;
};

export type ImportBatch = {
  id: string;
  fileName: string;
  fileType: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  finalizedAt: string | null;
};
