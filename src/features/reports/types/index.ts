export type ReportRange = {
  from: string;
  to: string;
};

export type ReportCategoryStat = {
  category: string;
  amount: number;
  share: number;
  color: string;
};

export type ReportPaymentMethodStat = {
  label: string;
  amount: number;
};

export type ReportsSummary = {
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
  topCategories: ReportCategoryStat[];
  paymentMethods: ReportPaymentMethodStat[];
  lineSeries: Array<{ value: number }>;
  barSeries: Array<{ value: number; label: string; frontColor: string }>;
};
