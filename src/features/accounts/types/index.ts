export type AccountType =
  | 'checking'
  | 'savings'
  | 'investment'
  | 'cash'
  | 'other'
  | 'credit_card';

export type AccountBalanceSnapshot = {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  color: string;
  openingBalance: number;
  currentBalance: number;
  balance?: number;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
};

export type AccountsOverview = {
  accounts: AccountBalanceSnapshot[];
  totalBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpense: number;
};

export type CreateAccountInput = {
  name: string;
  type: AccountType;
  institution?: string;
  color?: string;
  openingBalance: number;
};

export type UpdateAccountInput = Partial<CreateAccountInput> & {
  id: string;
  isActive?: boolean;
};

export type CreateTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
  occurredAt?: string;
};
