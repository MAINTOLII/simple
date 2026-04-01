import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Replace with your real values
const supabase = createClient(
  "https://swrgqktuatubssvwjkyx.supabase.co",
 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k");

type Sale = {
  id: string;
  customer: string;
  total: number;
  profit: number;
  type: string;
  date: string | null;
  created_at?: string | null;
  items: any;
  note?: string | null;
};

function safeParseItems(items: any) {
  try {
    if (!items) return [];
    if (typeof items === "string") return JSON.parse(items);
    return items;
  } catch {
    return [];
  }
}

function safeDate(d: Sale) {
  // Prefer clean timestamp
  if (d.created_at) return new Date(d.created_at).getTime();

  // Fallback for messy legacy date
  if (!d.date) return 0;

  const parsed = new Date(d.date);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  return 0;
}

export default function Check() {
  const [data, setData] = useState<Record<string, Sale[]>>({});
  const [loading, setLoading] = useState(true);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [payments, setPayments] = useState<{ id: string; phone: string; amount: number; created_at?: string }[]>([]);
  const [customers, setCustomers] = useState<{ name: string | null; phone: number }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAll();
    fetchPayments();
    fetchCustomers();
  }, []);

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from("credit_payments2")
      .select("id, phone, amount, created_at");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setPayments(data as any);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("name, phone");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setCustomers(data as any);
  };

  const fetchAll = async () => {
    setLoading(true);

    let allSales: Sale[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching:", error);
        break;
      }

      if (!data || data.length === 0) break;

      allSales = [...allSales, ...data];
      from += pageSize;
    }

    // ✅ filter ONLY credit sales
    const creditSales = allSales.filter((s) => s.type === "credit");

    // ✅ group by customer
    const grouped: Record<string, Sale[]> = {};

    for (const sale of creditSales) {
      const key = sale.customer || "UNKNOWN";

      if (!grouped[key]) grouped[key] = [];

      grouped[key].push({
        ...sale,
        items: safeParseItems(sale.items),
      });
    }

    // ✅ sort each customer's sales properly
    Object.keys(grouped).forEach((customer) => {
      grouped[customer].sort((a, b) => safeDate(b) - safeDate(a));
    });

    setData(grouped);
    setLoading(false);
  };

  if (loading) return <div>Loading ALL sales...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>All Credit Sales</h2>
      <input
        placeholder="Search name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          marginBottom: 12,
          padding: 8,
          width: "100%",
          borderRadius: 6
        }}
      />

      {Object.entries(data)
        .filter(([customer, sales]) => {
          const phone = customer;
          const matchedCustomer = customers.find(
            (c) => c.phone.toString() === phone.toString()
          );
          const name = matchedCustomer?.name || "";
          const term = search.toLowerCase();

          return (
            phone.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term)
          );
        })
  .map(([customer, sales]) => {
        const total = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);

        const phone = customer;

        const matchedCustomer = customers.find(
          (c) => c.phone.toString() === phone.toString()
        );

        const name = matchedCustomer?.name;

        const totalPaid = payments
          .filter((p) => String(p.phone) === String(phone))
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const balance = total - totalPaid;

        return (
          <div
            key={customer}
            style={{
              marginBottom: 8,
              border: "1px solid #222",
              borderRadius: 6,
              overflow: "hidden",
              background: "#111",
              color: "white"
            }}
          >
            {/* HEADER */}
            <div
              onClick={() =>
                setOpenCustomer(
                  openCustomer === customer ? null : customer
                )
              }
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
                cursor: "pointer",
                background: "#161616"
              }}
            >
              <div>
                <strong>
                  {name ? `${phone} (${name})` : phone}
                </strong>
              </div>
              <div>
                ${balance.toFixed(2)}{" "}
                <span style={{ opacity: 0.6 }}>
                  {openCustomer === customer ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {/* EXPANDED */}
            {openCustomer === customer && (
              <div style={{ padding: 12 }}>
                <button
                  onClick={() => {
                    const salesHtml = sales
                      .map((s) => {
                        const items = safeParseItems(s.items);

                        const itemsHtml =
                          items && items.length > 0
                            ? items
                                .map(
                                  (i: any) =>
                                    `<div style="margin-left:10px;font-size:13px;">• ${i.name} x${i.quantity} = $${(
                                      i.price * i.quantity
                                    ).toFixed(2)}</div>`
                                )
                                .join("")
                            : (s.note ? `<div style="margin-left:10px;font-size:13px;opacity:0.7;">Note: ${s.note}</div>` : "");

                        const date = s.created_at || s.date || "";

                        return `
                          <div style="margin-bottom:12px;border:1px solid #ddd;padding:8px;border-radius:6px;">
                            <div><strong>${date}</strong></div>
                            <div>Total: $${Number(s.total).toFixed(2)}</div>
                            ${itemsHtml}
                            <div style="margin-top:6px;">
                              <button onclick="window.deleteSale('${s.id}')" style="background:red;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Clear Sale</button>
                            </div>
                          </div>
                        `;
                      })
                      .join("");

                    const html = `
                      <html>
                        <body style="font-family:Arial;padding:16px;max-width:600px;margin:auto;">
                          <h2>Statement</h2>

                          <div style="margin-bottom:10px;">
                            <button onclick="window.clearAll()" style="background:black;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;margin-right:6px;">Clear All</button>
                            <button onclick="window.print()">Print</button>
                          </div>

                          <div><strong>${customer}</strong></div>
                          <hr />
                          <div><strong>Payments</strong></div>
                          ${payments
                            .filter((p) => String(p.phone) === String("${customer}"))
                            .map(
                              (p) => `
                                <div style="margin-bottom:8px;background:#0a2e0a;color:#9fff9f;padding:8px;border-radius:6px;">
                                  <div><strong>${p.created_at || ""}</strong></div>
                                  <div><strong>Payment Made:</strong> $${Number(p.amount).toFixed(2)}</div>
                                  <button onclick="window.deletePayment('${p.id}')" style="margin-top:6px;background:#145214;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Clear Payment</button>
                                </div>
                              `
                            )
                            .join("")}
                          <hr />
                          ${salesHtml || "<div>No sales</div>"}
                          <hr />
                          <div><strong>Total Owed:</strong> $${total.toFixed(2)}</div>
                          <div><strong>Total Paid:</strong> $${totalPaid.toFixed(2)}</div>
                          <div><strong>Balance:</strong> $${balance.toFixed(2)}</div>

                          <script>
                            window.deleteSale = async function(id) {
                              if (!confirm('Delete this sale?')) return;
                              await fetch('${"https://swrgqktuatubssvwjkyx.supabase.co/rest/v1/sales?id=eq."}' + id, {
                                method: 'DELETE',
                                headers: {
                                  apikey: '${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}',
                                  Authorization: 'Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}'
                                }
                              });
                              location.reload();
                            };

                            window.deletePayment = async function(id) {
                              if (!confirm('Delete this payment?')) return;

                              await fetch('${"https://swrgqktuatubssvwjkyx.supabase.co/rest/v1/credit_payments2?id=eq."}' + id, {
                                method: 'DELETE',
                                headers: {
                                  apikey: '${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}',
                                  Authorization: 'Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}'
                                }
                              });

                              location.reload();
                            };

                            window.clearAll = async function() {
                              if (!confirm('Delete ALL sales AND payments for this customer?')) return;

                              // delete sales
                              await fetch('${"https://swrgqktuatubssvwjkyx.supabase.co/rest/v1/sales?customer=eq."}' + encodeURIComponent('${customer}'), {
                                method: 'DELETE',
                                headers: {
                                  apikey: '${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}',
                                  Authorization: 'Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}'
                                }
                              });

                              // delete payments
                              await fetch('${"https://swrgqktuatubssvwjkyx.supabase.co/rest/v1/credit_payments2?phone=eq."}' + encodeURIComponent('${customer}'), {
                                method: 'DELETE',
                                headers: {
                                  apikey: '${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}',
                                  Authorization: 'Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cmdxa3R1YXR1YnNzdndqa3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjQ1NzYsImV4cCI6MjA4MzUwMDU3Nn0.0FQcggOAijqZ3nbOaK369Yy5erTTOtby53x0DHstV9k"}'
                                }
                              });

                              location.reload();
                            };
                          </script>
                        </body>
                      </html>
                    `;

                    const w = window.open("", "_blank");
                    if (!w) return;
                    w.document.write(html);
                    w.document.close();
                  }}
                  style={{ marginBottom: 10 }}
                >
                  Statement
                </button>

                {/* PAYMENTS LIST */}
                <div style={{ marginBottom: 10 }}>
                  <strong>Payments</strong>
                  {payments
                    .filter((p) => String(p.phone) === String(customer))
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          background: "#0a2e0a",
                          color: "#9fff9f",
                          padding: 6,
                          marginTop: 4,
                          borderRadius: 6,
                          fontSize: 13
                        }}
                      >
                        <div>{p.created_at}</div>
                        <div>Payment Made: ${p.amount}</div>
                        <button
                          onClick={async () => {
                            if (!window.confirm("Delete this payment?")) return;

                            const { error } = await supabase
                              .from("credit_payments2")
                              .delete()
                              .eq("id", p.id);

                            if (error) {
                              alert("Error deleting payment");
                              console.error(error);
                              return;
                            }

                            fetchPayments();
                          }}
                          style={{
                            marginTop: 4,
                            background: "#145214",
                            color: "white",
                            border: "none",
                            padding: "3px 6px",
                            borderRadius: 4,
                            cursor: "pointer"
                          }}
                        >
                          Delete Payment
                        </button>
                      </div>
                    ))}
                </div>

                {sales.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      border: "1px solid #333",
                      marginBottom: 6,
                      padding: 6,
                      fontSize: 13
                    }}
                  >
                    <div>{s.created_at || s.date}</div>
                    <div>Total: {s.total}</div>
                    {/* Show manual credit note if no items and note exists */}
                    {!safeParseItems(s.items).length && s.note && (
                      <div style={{ fontStyle: "italic", opacity: 0.7 }}>
                        Note: {s.note}
                      </div>
                    )}
                    {(() => {
                      const items = safeParseItems(s.items);
                      const preview = items
                        .slice(0, 2)
                        .map((i: any) => i.name)
                        .join(", ");
                      return (
                        <div>
                          Items: {items.length} {items.length > 0 ? `(${preview}${items.length > 2 ? "..." : ""})` : ""}
                        </div>
                      );
                    })()}
                    {/* Delete button */}
                    <button
                      onClick={async () => {
                        if (!window.confirm("Delete this sale?")) return;

                        const { error } = await supabase
                          .from("sales")
                          .delete()
                          .eq("id", s.id);

                        if (error) {
                          alert("Error deleting");
                          console.error(error);
                          return;
                        }

                        // refresh list after delete
                        fetchAll();
                      }}
                      style={{
                        marginTop: 6,
                        background: "red",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer"
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}