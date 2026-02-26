import { useState } from "react";
import Credits from "./Credits";
import Reports from "./Reports";
import Sales from "./Sales";
import Edit from "./Edit";
import Logbook from "./Logbook.tsx";
import Qty from "./Qty";


function App() {
  const [page, setPage] = useState<"sales" | "reports" | "credits" | "logbook" | "edit-items" | "qty">("sales");
  const [, setSales] = useState<any[]>([]);

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
        <button onClick={() => setPage("logbook")}>Logbook</button>
        <button onClick={() => setPage("edit-items")}>Edit Items</button>
        <button onClick={() => setPage("qty")}>Temporary</button>
      </div>

      {page === "sales" && (
        <Sales setSales={setSales} />
      )}

      {page === "reports" && (
        <Reports />
      )}

      {page === "credits" && (
        <Credits />
      )}

      {page === "logbook" && (
        <Logbook />
      )}

      {page === "edit-items" && (
        <Edit />
      )}

      {page === "qty" && (
        <Qty />
      )}
    </div>
  );
}

export default App;