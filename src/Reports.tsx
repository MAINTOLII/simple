import { useEffect, useState } from "react";
import { supabase } from "./supabase";

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
  created_at?: string;
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


export default function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [credits, setCredits] = useState<CreditAccount[]>([]);
  const [payments, setPayments] = useState<
    { phone: string; amount: number; created_at?: string }[]
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .order("date", { ascending: false });

      const { data: creditsData } = await supabase
        .from("credit_accounts")
        .select("*");

      const { data: paymentsData } = await supabase
        .from("credit_payments2")
        .select("phone, amount, created_at");

      if (salesData) {
        setSales(
          salesData.map((s: any) => ({
            ...s,
            items: s.items
              ? typeof s.items === "string"
                ? JSON.parse(s.items)
                : s.items
              : [],
            shsAmount: s.shs_amount || 0,
            created_at: s.created_at,
          }))
        );
      }

      if (creditsData) {
        setCredits(creditsData);
      }

      if (paymentsData) {
        setPayments(
          paymentsData.map((p: any) => ({
            phone: p.phone,
            amount: Number(p.amount),
            created_at: p.created_at,
          }))
        );
      }
    };

    fetchData();
  }, []);
  const getBusinessStart = () => {
    const now = new Date();
    const start = new Date();
    start.setHours(5, 0, 0, 0);

    if (now.getHours() < 5) {
      start.setDate(start.getDate() - 1);
    }

    return start;
  };

  const businessStart = getBusinessStart();

  const parseSaleDate = (dateStr: string) => {
    // Handles formats like "19/02/2026, 14:19:58"
    if (!dateStr) return null;

    const [datePart, timePart] = dateStr.split(",");
    if (!datePart || !timePart) return null;

    const [day, month, year] = datePart.trim().split("/");

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      ...timePart.trim().split(":").map(Number)
    );
  };

  const filteredSales = sales.filter((sale) => {
    let saleTime: Date | null = null;

    if (sale.created_at) {
      saleTime = new Date(sale.created_at);
    } else {
      saleTime = parseSaleDate(sale.date);
    }

    if (!saleTime) return false;

    return saleTime >= businessStart;
  });

  const filteredPayments = payments.filter((p: any) => {
    const paymentTime = p.created_at
      ? new Date(p.created_at)
      : null;

    if (!paymentTime) return false;

    return paymentTime >= businessStart;
  });

  const totalCashSales = filteredSales
    .filter((sale) => sale.type === "cash")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalShsSales = filteredSales
    .filter((sale) => sale.type === "shs")
    .reduce((sum, sale) => sum + (sale.shsAmount || 0), 0);

  const totalProfit = filteredSales.reduce(
    (sum, sale) => sum + sale.profit,
    0
  );

  const totalSales = filteredSales.reduce(
    (sum, sale) => sum + sale.total,
    0
  );

  const totalCreditPayments = filteredPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const getCustomerName = (phone: string) => {
    const account = credits.find((c) => c.phone === phone);
    if (!account) return null;

    // Look through ALL sales to find a stored customer name
    const saleWithName = account.sales.find((s) => s.customer);

    return saleWithName?.customer || null;
  };


  return (
    <>
      <h4>Sales & Payments</h4>

      <div style={{ marginBottom: 10 }}>
        <strong>Total Sales:</strong>{" "}
        ${totalSales.toFixed(2)}
        <br />
        <strong>Total Profit:</strong>{" "}
        ${totalProfit.toFixed(2)}
        <br />
        <strong>Total Revenue (Cash):</strong>{" "}
        ${totalCashSales.toFixed(2)}
        <br />
        <strong>Total SHS Revenue:</strong>{" "}
        {totalShsSales.toFixed(0)} SHS
        <br />
        <strong>Total Credit Payments:</strong>{" "}
        ${totalCreditPayments.toFixed(2)}
        <hr />
      </div>

      {filteredSales.map((sale) => (
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
      {filteredPayments.map((payment, idx) => {
        const name = getCustomerName(payment.phone);
        return (
          <div
            key={`${payment.phone}-${idx}`}
            style={{ marginBottom: 6 }}
          >
            {payment.phone}
            {name && ` (${name})`} paid $
            {Number(payment.amount).toFixed(2)}
          </div>
        );
      })}
    </>
  );
}