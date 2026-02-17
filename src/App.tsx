import { useState } from "react";
import Credits from "./Credits";
import Reports from "./Reports";
import Sales from "./Sales";
import type { Sale, CreditAccount } from "./types";


function App() {
  const [page, setPage] = useState<"sales" | "reports" | "credits">("sales");
  const [sales, setSales] = useState<Sale[]>([]);
  const [credits, setCredits] = useState<CreditAccount[]>([]);

  const addPayment = (phone: string, amount: number) => {
    if (!amount) return;
    setCredits((prev) =>
      prev.map((c) =>
        c.phone === phone
          ? { ...c, payments: [...c.payments, amount] }
          : c
      )
    );
  };

  const addManualCredit = (phone: string, amount: number, note: string) => {
    if (!amount) return;

    const newCredit = {
      amount,
      note,
      date: new Date().toLocaleString(),
    };

    setCredits((prev) => {
      const existing = prev.find((c) => c.phone === phone);

      if (existing) {
        return prev.map((c) =>
          c.phone === phone
            ? {
                ...c,
                manualCredits: [...(c.manualCredits || []), newCredit],
              }
            : c
        );
      }

      return [
        ...prev,
        {
          phone,
          sales: [],
          payments: [],
          manualCredits: [newCredit],
        },
      ];
    });
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Arial",
        maxWidth: 650,
        margin: "0 auto",
        lineHeight: 1.6,
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 30 }}>
        Mato POS
      </h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 30,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setPage("sales")}>Sales</button>
        <button onClick={() => setPage("reports")}>Reports</button>
        <button onClick={() => setPage("credits")}>Credits</button>
      </div>

      {page === "sales" && (
        <Sales setSales={setSales} setCredits={setCredits} />
      )}

      {page === "reports" && (
        <Reports sales={sales} credits={credits} />
      )}

      {page === "credits" && (
        <Credits
          credits={credits}
          addPayment={addPayment}
          addManualCredit={addManualCredit}
        />
      )}
    </div>
  );
}

export default App;