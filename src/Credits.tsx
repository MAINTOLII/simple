import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { CreditAccount } from "./types";
export default function Credits() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<
    { phone: string; amount: number; created_at: string }[]
  >([]);
  const [credits, setCredits] = useState<CreditAccount[]>([]);
  const [customers, setCustomers] = useState<
    { id: number; name: string | null; phone: number }[]
  >([]);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>("");


  const filteredManualCustomers =
    phone.length >= 2
      ? customers.filter((c) => {
          const nameMatch =
            c.name &&
            c.name.toLowerCase().includes(phone.toLowerCase());
          const phoneMatch = c.phone.toString().includes(phone);
          return nameMatch || phoneMatch;
        })
      : [];
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone");

      if (error) {
        console.error(error);
        return;
      }

      if (data) setCustomers(data as any);
    };

    fetchCustomers();
  }, []);
  const extractPhone = (value: string) => {
    if (!value) return value;
    const match = value.match(/\((\d+)\)/);
    if (match) return match[1];
    return value.trim();
  };

  useEffect(() => {
    const fetchCredits = async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("type", "credit");

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        const grouped: Record<string, CreditAccount> = {};

        data.forEach((sale: any) => {
          if (!sale.customer) return;

          const cleanPhone = extractPhone(sale.customer);

          if (!grouped[cleanPhone]) {
            grouped[cleanPhone] = {
              phone: cleanPhone,
              sales: [],
              payments: [],
              manualCredits: [],
            };
          }

          if (sale.items && sale.items.length === 0) {
            grouped[cleanPhone].manualCredits.push({
              amount: Number(sale.total),
              note: sale.note || "",
              date: sale.date,
            });
          } else {
            grouped[cleanPhone].sales.push({
              id: sale.id,
              items: sale.items || [],
              total: Number(sale.total),
              profit: Number(sale.profit),
              date: sale.date,
              type: sale.type,
              customer: cleanPhone,
            });
          }
        });

        setCredits(Object.values(grouped));
      }
    };

    fetchCredits();
  }, [payments]);

  useEffect(() => {
    const fetchPayments = async () => {
      const { data, error } = await supabase
        .from("credit_payments2")
        .select("phone, amount, created_at");

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setPayments(data as any);
      }
    };

    fetchPayments();
  }, []);

  return (
    <div>
      <h3>Manual Credit</h3>

      {/* Manual Credit Form */}
      <div style={{ marginBottom: 25 }}>
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ marginRight: 5, backgroundColor: "white", color: "black" }}
        />
        {filteredManualCustomers.length > 0 && (
          <div
            style={{
              position: "absolute",
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 6,
              marginTop: 4,
              zIndex: 1000,
              maxHeight: 150,
              overflowY: "auto",
              color: "black",
            }}
          >
            {filteredManualCustomers.map((c, idx) => (
              <div
                key={idx}
                style={{
                  padding: "6px 10px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f2f2f2",
                }}
                onClick={() => {
                  if (c.name) {
                    setPhone(`${c.name} (${c.phone})`);
                  } else {
                    setPhone(c.phone.toString());
                  }
                }}
              >
                {c.name ? `${c.name} (${c.phone})` : c.phone.toString()}
              </div>
            ))}
          </div>
        )}
        <input
          placeholder="Amount (USD)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginRight: 5, backgroundColor: "white", color: "black" }}
        />
        <input
          placeholder="Message"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginRight: 5, backgroundColor: "white", color: "black" }}
        />
        <button
          onClick={async () => {
            if (!phone || !amount || isNaN(parseFloat(amount))) return;

            const value = parseFloat(amount);

            const { error } = await supabase
              .from("sales")
              .insert({
                date: new Date().toLocaleString(),
                total: value,
                profit: 0,
                type: "credit",
                customer: extractPhone(phone),
                items: [],
                note: note || null,
              });

            if (error) {
              console.error(error);
              return;
            }

            setPhone("");
            setAmount("");
            setNote("");

            // refetch credits
            const { data } = await supabase
              .from("sales")
              .select("*")
              .eq("type", "credit");

            if (data) {
              const grouped: Record<string, CreditAccount> = {};

              data.forEach((sale: any) => {
                if (!sale.customer) return;

                const cleanPhone = extractPhone(sale.customer);

                if (!grouped[cleanPhone]) {
                  grouped[cleanPhone] = {
                    phone: cleanPhone,
                    sales: [],
                    payments: [],
                    manualCredits: [],
                  };
                }

                if (sale.items && sale.items.length === 0) {
                  grouped[cleanPhone].manualCredits.push({
                    amount: Number(sale.total),
                    note: sale.note || "",
                    date: sale.date,
                  });
                } else {
                  grouped[cleanPhone].sales.push({
                    id: sale.id,
                    items: sale.items || [],
                    total: Number(sale.total),
                    profit: Number(sale.profit),
                    date: sale.date,
                    type: sale.type,
                    customer: cleanPhone,
                  });
                }
              });

              setCredits(Object.values(grouped));
            }
          }}
        >
          Add
        </button>
      </div>

      <hr />

      <h3>Credit Accounts</h3>
      <div style={{ marginBottom: 15 }}>
        <input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            backgroundColor: "white",
            color: "black",
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        />
      </div>

      {credits.length === 0 && <div>No credit accounts</div>}

      {credits
        .filter((account) => {
          const matchedCustomer = customers.find(
            (c) => c.phone.toString() === account.phone.toString()
          );

          const name = matchedCustomer?.name
            ? matchedCustomer.name.toLowerCase()
            : "";

          const phoneStr = account.phone.toString();

          const salesTotal = account.sales.reduce(
            (sum, sale) => sum + sale.total,
            0
          );

          const manualTotal = (account.manualCredits || []).reduce(
            (sum, c) => sum + c.amount,
            0
          );

          const totalOwed = salesTotal + manualTotal;

          const totalPaid = payments
            .filter((p) => p.phone === account.phone)
            .reduce((sum, p) => sum + Number(p.amount), 0);

          const balance = totalOwed - totalPaid;

          // If no search → only show accounts with non-zero balance
          if (!search.trim()) {
            return balance !== 0;
          }

          // If searching → allow showing any previous credit account
          return (
            name.toLowerCase().includes(search.toLowerCase()) ||
            phoneStr.includes(search)
          );
        })
        .map((account) => {
        const matchedCustomer = customers.find(
          (c) => c.phone.toString() === account.phone.toString()
        );

        const displayLabel = matchedCustomer?.name
          ? `${account.phone} (${matchedCustomer.name})`
          : account.phone;
        const isEditing = editingPhone === account.phone;

        const salesTotal = account.sales.reduce(
          (sum, sale) => sum + sale.total,
          0
        );

        const manualTotal = (account.manualCredits || []).reduce(
          (sum, c) => sum + c.amount,
          0
        );

        const totalOwed = salesTotal + manualTotal;

        const totalPaid = payments
          .filter((p) => p.phone === account.phone)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const balance = totalOwed - totalPaid;

        return (
          <div
            key={account.phone}
            style={{
              marginBottom: 8,
              backgroundColor: "#111",
              color: "white",
              borderRadius: 6,
              border: "1px solid #222",
              overflow: "hidden"
            }}
          >
            <div
              onClick={() =>
                setOpenAccount(
                  openAccount === account.phone ? null : account.phone
                )
              }
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                cursor: "pointer",
                backgroundColor: "#161616"
              }}
            >
              <div style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                {!isEditing && (
                  <>
                    <strong>{displayLabel}</strong>
                    <span
                      style={{ cursor: "pointer", fontSize: 12, opacity: 0.6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPhone(account.phone);
                        setEditNameValue(matchedCustomer?.name || "");
                      }}
                    >
                      ✏️
                    </span>
                  </>
                )}

                {isEditing && (
                  <>
                    <input
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      style={{
                        fontSize: 13,
                        padding: 4,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        color: "black"
                      }}
                    />
                    <button
                      style={{ fontSize: 12 }}
                      onClick={async (e) => {
                        e.stopPropagation();

                        const numericPhone = Number(account.phone);
                        if (isNaN(numericPhone)) return;

                        const { error } = await supabase
                          .from("customers")
                          .update({ name: editNameValue || null })
                          .eq("phone", numericPhone);

                        if (error) {
                          console.error(error);
                          return;
                        }

                        setCustomers((prev) =>
                          prev.map((c) =>
                            c.phone === numericPhone
                              ? { ...c, name: editNameValue || null }
                              : c
                          )
                        );

                        setEditingPhone(null);
                      }}
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ marginRight: 10 }}>
                  ${balance.toFixed(2)}
                </span>
                <span style={{ opacity: 0.6 }}>
                  {openAccount === account.phone ? "▲" : "▼"}
                </span>
              </div>
            </div>
            {openAccount === account.phone && (
              <div style={{ padding: "10px 12px" }}>
                <div style={{ marginTop: 5 }}>
                  <button
                    onClick={async () => {
                      const salesHtml = account.sales
                        .map((sale) => {
                          const itemsHtml = sale.items && sale.items.length > 0
                            ? sale.items
                                .map(
                                  (item: any) =>
                                    `<div style="margin-left:10px;font-size:13px;">• ${item.name} x${item.quantity} = $${(
                                      item.price * item.quantity
                                    ).toFixed(2)}</div>`
                                )
                                .join("")
                            : "";

                          return `
                            <div style="margin-bottom:12px;">
                              <div style="font-weight:600;">${sale.date}</div>
                              <div>Total: $${sale.total.toFixed(2)}</div>
                              ${itemsHtml}
                            </div>
                          `;
                        })
                        .join("");

                      const paymentsHtml = payments
                        .filter((p) => p.phone === account.phone)
                        .map((p) => {
                          const time = p.created_at
                            ? new Date(p.created_at).toLocaleString()
                            : "";
                          return `<div style="margin-bottom:6px;">$${Number(p.amount).toFixed(2)} — ${time}</div>`;
                        })
                        .join("");

                      const html = `
                        <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <title>Credit Statement</title>
                          </head>
                          <body style="font-family:Arial;background:#ffffff;color:#000;padding:16px;max-width:600px;margin:auto;">
                            <h2 style="margin-bottom:8px;">Credit Statement</h2>
                            <div style="margin-bottom:12px;"><strong>${displayLabel}</strong></div>

                            <hr />
                            <h4>Sales</h4>
                            ${salesHtml || "<div>No sales recorded</div>"}

                            <hr />
                            <h4>Manual Credits</h4>
                            ${(account.manualCredits || [])
                              .map(
                                (c) =>
                                  `<div style="margin-bottom:6px;">$${c.amount.toFixed(2)} — ${c.date}${c.note ? ` (${c.note})` : ""}</div>`
                              )
                              .join("") || "<div>No manual credits</div>"}

                            <hr />
                            <h4>Payments</h4>
                            ${paymentsHtml || "<div>No payments recorded</div>"}

                            <hr />
                            <div style="font-size:15px;">
                              <div><strong>Total Owed:</strong> $${totalOwed.toFixed(2)}</div>
                              <div><strong>Total Paid:</strong> $${totalPaid.toFixed(2)}</div>
                              <div><strong>Balance:</strong> $${balance.toFixed(2)}</div>
                            </div>

                            <br />
                            <button onclick="window.print()" style="padding:10px 14px;margin-right:8px;">Print / Save PDF</button>
                            <button onclick="navigator.clipboard.writeText(document.body.innerText)" style="padding:10px 14px;">Copy Text</button>
                          </body>
                        </html>
                      `;

                      const newWindow = window.open("", "_blank");
                      if (!newWindow) return;
                      newWindow.document.write(html);
                      newWindow.document.close();
                    }}
                    style={{ marginRight: 10 }}
                  >
                    Statement
                  </button>
                </div>
                {openAccount === account.phone && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Owed: ${totalOwed.toFixed(2)} | Paid: ${totalPaid.toFixed(2)} | Balance: ${balance.toFixed(2)}
                  </div>
                )}
                {/* Add Payment */}
                <input
                  placeholder="Payment & Enter"
                  type="number"
                  style={{
                    marginTop: 5,
                    backgroundColor: "white",
                    color: "black",
                    padding: 6,
                    borderRadius: 4,
                    border: "1px solid #ccc"
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const value = parseFloat(
                        (e.target as HTMLInputElement).value
                      );
                      if (!value) return;

                      // Insert into DB
                      const { error } = await supabase
                        .from("credit_payments2")
                        .insert({
                          phone: account.phone,
                          amount: value,
                        });

                      if (error) {
                        console.error(error);
                        return;
                      }

                      setPayments((prev) => [
                        ...prev,
                        {
                          phone: account.phone,
                          amount: value,
                          created_at: new Date().toISOString(),
                        },
                      ]);

                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}