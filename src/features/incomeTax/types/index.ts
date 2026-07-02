export type IncomeTaxSectionKey = 'rendimentos' | 'dedutiveis' | 'outras';

export type IncomeTaxLine = {
  category: string;
  amount: number;
  count: number;
};

export type IncomeTaxSection = {
  key: IncomeTaxSectionKey;
  title: string;
  description: string;
  lines: IncomeTaxLine[];
  total: number;
};

export type IncomeTaxReceipt = {
  transactionTitle: string;
  date: string | null;
  fileName: string;
  kind: string;
  url: string | null;
};

export type IncomeTaxReport = {
  year: number;
  ownerName: string | null;
  ownerCpf: string | null;
  sections: IncomeTaxSection[];
  totalIncome: number;
  totalDeductible: number;
  totalExpense: number;
  transactionCount: number;
  receipts: IncomeTaxReceipt[];
  generatedAt: string;
};
