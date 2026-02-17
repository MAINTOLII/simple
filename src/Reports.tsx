
type CartItem = {
  id: number;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  unit: "piece" | "kg";
};

type Sale = {
  id: number;
  items: CartItem[];
  total: number;
  profit: number;
  date: string;
  type: "cash" | "credit" | "shs";
  shsAmount?: number;
  customer?: string;
};

type CreditAccount = {
  phone: string;
  sales: Sale[];
  payments: number[];
  manualCredits: { amount: number; note: string; date: string }[];
};

type Props = {
  sales: Sale[];
  credits: CreditAccount[];
};

export default function Reports({ sales, credits }: Props) {
  const totalCashSales = sales
    .filter((sale) => sale.type === "cash")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalShsSales = sales
    .filter((sale) => sale.type === "shs")
    .reduce((sum, sale) => sum + (sale.shsAmount || 0), 0);

  const totalCreditSales = sales
    .filter((sale) => sale.type === "credit")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalManualCredits = credits.reduce(
    (sum, account) =>
      sum +
      (account.manualCredits || []).reduce(
        (mSum, m) => mSum + m.amount,
        0
      ),
    0
  );

  const totalCreditPayments = credits.reduce(
    (sum, account) =>
      sum + account.payments.reduce((pSum, p) => pSum + p, 0),
    0
  );

  const totalCreditsGivenOut =
    totalCreditSales + totalManualCredits;

  const expectedCashDrawer =
    totalCashSales + totalCreditPayments;

  const expectedShsDrawer = totalShsSales;

  const totalProfit = sales.reduce(
    (sum, sale) => sum + sale.profit,
    0
  );

  return (
    <>
      <h4>Sales & Payments</h4>

      <div style={{ marginBottom: 10 }}>
        <strong>Total Profit:</strong>{" "}
        ${totalProfit.toFixed(2)}
        <br />
        <strong>Total Cash Sales:</strong>{" "}
        ${totalCashSales.toFixed(2)}
        <br />
        <strong>Total SHS Revenue:</strong>{" "}
        {totalShsSales.toFixed(0)} SHS
        <br />
        <strong>Total Credit Sales:</strong>{" "}
        ${totalCreditSales.toFixed(2)}
        <br />
        <strong>Total Manual Credits:</strong>{" "}
        ${totalManualCredits.toFixed(2)}
        <br />
        <strong>Total Credits Given Out:</strong>{" "}
        ${totalCreditsGivenOut.toFixed(2)}
        <br />
        <strong>Total Credit Payments:</strong>{" "}
        ${totalCreditPayments.toFixed(2)}
        <br />
        <strong>Expected Cash Drawer:</strong>{" "}
        ${expectedCashDrawer.toFixed(2)}
        <br />
        <strong>Expected SHS Drawer:</strong>{" "}
        {expectedShsDrawer.toFixed(0)} SHS
        <br />
        <hr />
      </div>

      {sales.map((sale) => (
        <div key={sale.id} style={{ marginBottom: 12 }}>
          <div>
            {sale.date} ({sale.type === "shs" ? "SHS" : sale.type})
            {sale.customer && ` — ${sale.customer}`}
          </div>

          <div style={{ marginLeft: 10 }}>
            {sale.items.map((item) => (
              <div key={item.id}>
                - {item.name} x{item.quantity} = $
                {(item.price * item.quantity).toFixed(2)}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            Revenue: ${sale.total.toFixed(2)} | Profit: $
            {sale.profit.toFixed(2)}
          </div>
          {sale.type === "shs" && sale.shsAmount && (
            <div>SHS Paid: {sale.shsAmount.toFixed(0)} SHS</div>
          )}
        </div>
      ))}

      <hr style={{ margin: "25px 0" }} />

      <h4>Credit Payments</h4>
      {credits.flatMap((account) =>
        account.payments.map((payment, idx) => (
          <div
            key={`${account.phone}-${idx}`}
            style={{ marginBottom: 6 }}
          >
            {account.phone} paid $
            {payment.toFixed(2)}
          </div>
        ))
      )}
    </>
  );
}