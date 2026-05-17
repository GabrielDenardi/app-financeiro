export type EntryType = 'income' | 'expense';

export type PaymentMethod =
  | 'Pix'
  | 'Transferencia'
  | 'Dinheiro'
  | 'Cartao de credito'
  | 'Cartao de debito'
  | 'Boleto';

export type TransactionSourceType =
  | 'manual'
  | 'voice'
  | 'ocr'
  | 'transfer'
  | 'group_split'
  | 'group_settlement'
  | 'goal_contribution'
  | 'imported'
  | 'card_payment'
  | 'card_installment';

export type FinanceCategory = {
  id: string;
  code: string;
  label: string;
  kind: 'income' | 'expense' | 'both';
  color: string;
  icon: string;
};

export type TransactionFeedItem = {
  id: string;
  title: string;
  notes?: string;
  amount: number;
  type: EntryType;
  category: string;
  categoryId?: string | null;
  categoryColor?: string;
  paymentMethod: string;
  sourceType?: TransactionSourceType;
  occurredAt?: string;
  occurredOn?: string;
  dateLabel?: string;
  date?: string;
  dateISO?: string;
  accountName?: string;
  cardName?: string;
  installmentLabel?: string;
  groupId?: string | null;
};

export type TransactionSection = {
  date: string;
  data: TransactionFeedItem[];
};

export type TransactionFilters = {
  search?: string;
  type?: 'all' | EntryType;
  month?: number | null;
  paymentMethod?: string | null;
  from?: string | null;
  to?: string | null;
};

export type CreateTransactionInput = {
  accountId: string;
  categoryId: string | null;
  title: string;
  amount: number;
  type: EntryType;
  paymentMethod: string;
  occurredAt: string;
  notes?: string;
  isRecurring?: boolean;
  sourceType?: 'manual' | 'voice' | 'ocr';
  attachmentId?: string | null;
  captureMetadata?: {
    transcript?: string;
    ocrText?: string;
    provider: 'openai';
    confidence?: number | null;
    warnings?: string[];
    merchantOrIssuer?: string | null;
    documentNumber?: string | null;
  };
};

export type TransactionAttachmentKind = 'receipt' | 'invoice' | 'ocr_document' | 'audio_note';

export type TransactionAttachment = {
  id: string;
  userId: string;
  groupId?: string | null;
  transactionId?: string | null;
  groupSplitId?: string | null;
  attachmentKind: TransactionAttachmentKind;
  sourceType: 'manual' | 'voice' | 'ocr';
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  captureMetadata?: Record<string, unknown>;
  createdAt: string;
};

export type CapturedTransactionDraft = {
  title: string;
  amount: number | null;
  type: EntryType | null;
  paymentMethod: string;
  occurredAt: string;
  suggestedCategoryCode: string | null;
  notes: string;
  merchantOrIssuer: string | null;
  documentNumber: string | null;
  warnings: string[];
  rawTranscriptOrOcrText: string;
  confidence: number | null;
  provider: 'openai';
};
