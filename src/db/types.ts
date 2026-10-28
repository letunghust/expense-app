export type TransactionType = 'income' | 'expense';

export type Category = {
  id: number;
  name: string;
  type: TransactionType;
  icon: string; // Ionicons glyph name
  color: string;
};

export type Wallet = {
  id: number;
  name: string;
  icon: string;
  initialBalance: number;
};

export type WalletWithBalance = Wallet & { balance: number; transactionCount: number };

export type Transaction = {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number;
  walletId: number;
  date: string; // YYYY-MM-DD
  note: string;
  receipt: string | null; // attached screenshot, see lib/receipt-files
};

/** A transaction joined with the category and wallet it belongs to, for display. */
export type TransactionRow = Transaction & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  walletName: string;
};

export type TransactionInput = Omit<Transaction, 'id' | 'receipt'> & { receipt?: string | null };

export type CategoryTotal = {
  categoryId: number;
  name: string;
  icon: string;
  color: string;
  total: number;
};

export type BudgetRow = {
  categoryId: number;
  name: string;
  icon: string;
  color: string;
  limit: number | null;
  spent: number;
};
