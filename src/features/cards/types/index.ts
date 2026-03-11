export type CreditCard = {
  id: string;
  name: string;
  institution: string;
  network: string;
  lastDigits: string;
  limitAmount: number;
  dueDay: number;
  closingDay: number;
  color: string;
  usedLimitAmount: number;
  openAmount: number;
  availableLimitAmount: number;
  isActive: boolean;
};

export type CardInvoiceSummary = {
  cardId: string;
  cardName: string;
  institution: string;
  network: string;
  lastDigits: string;
  color: string;
  invoiceMonth: string;
  dueDate: string | null;
  invoiceAmount: number;
  openAmount: number;
  paidAmount: number;
  usedLimitAmount: number;
  isDueSoon: boolean;
};

export type CreateCardInput = {
  name: string;
  institution: string;
  network: string;
  lastDigits: string;
  limitAmount: number;
  dueDay: number;
  closingDay: number;
  color: string;
};

export type RecordCardChargeInput = {
  cardId: string;
  title: string;
  totalAmount: number;
  categoryId: string | null;
  purchaseDate: string;
  installmentCount: number;
  notes?: string;
};

export type PayCardInvoiceInput = {
  cardId: string;
  invoiceMonth: string;
  accountId: string;
  amount?: number | null;
  note?: string;
};
