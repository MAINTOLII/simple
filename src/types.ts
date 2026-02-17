export type Sale = {
  id: number;
  items: any[];
  total: number;
  profit: number;
  date: string;
  type: "cash" | "credit" | "shs";
  shsAmount?: number;
  customer?: string;
};

export type CreditAccount = {
  phone: string;
  sales: Sale[];
  payments: number[];
  
  manualCredits: { amount: number; note: string; date: string }[];
};

// rest of the file remains unchanged