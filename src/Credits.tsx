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
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("sales")
          .select("*")
          .eq("type", "credit")
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(error);
          return;
        }

        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        from += pageSize;
      }

      const data = allData;

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

          let parsedItems = [];

          try {
            parsedItems =
              typeof sale.items === "string"
                ? JSON.parse(sale.items)
                : sale.items || [];
          } catch {
            parsedItems = [];
          }

          if (!parsedItems || parsedItems.length === 0) {
            grouped[cleanPhone].manualCredits.push({
              amount: Number(sale.total),
              note: sale.note || "",
              date: sale.date,
            });
          } else {
            grouped[cleanPhone].sales.push({
              id: sale.id,
              items: parsedItems,
              total: Number(sale.total),
              profit: Number(sale.profit),
              date: sale.date,
              type: sale.type,
              customer: cleanPhone,
            });
          }
        });

        // Robust date parser for sorting
        const parseDate = (d: string) => {
          if (!d) return 0;

          // Try native first
          const native = new Date(d);
          if (!isNaN(native.getTime())) return native.getTime();

          const parts = d.split(",");
          const datePart = parts[0]?.trim();
          const timePart = parts[1]?.trim() || "00:00:00";

          if (!datePart) return 0;

          const nums = datePart.split(/[\/\-]/).map(Number);
          if (nums.length !== 3) return 0;

          let day = nums[0];
          let month = nums[1];
          let year = nums[2];

          // 🔥 smarter detection
          const hasAmPm = /am|pm/i.test(d);

          if (hasAmPm) {
            // assume US format if AM/PM exists → MM/DD/YYYY
            month = nums[0];
            day = nums[1];
          } else if (nums[0] > 12) {
            // definitely DD/MM/YYYY
            day = nums[0];
            month = nums[1];
          } else if (nums[1] > 12) {
            // definitely MM/DD/YYYY
            month = nums[0];
            day = nums[1];
          } else {
            // ambiguous → default to DD/MM (Somalia/UK style)
            day = nums[0];
            month = nums[1];
          }

          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${timePart}`;
          return new Date(iso).getTime();
        };

        Object.values(grouped).forEach((acc) => {
          acc.sales.sort((a, b) => parseDate(b.date) - parseDate(a.date));
          acc.manualCredits.sort((a, b) => parseDate(b.date) - parseDate(a.date));
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
              .eq("type", "credit")
              .order("date", { ascending: false })
              .range(0, 5000);

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

                let parsedItems = [];

                try {
                  parsedItems =
                    typeof sale.items === "string"
                      ? JSON.parse(sale.items)
                      : sale.items || [];
                } catch {
                  parsedItems = [];
                }

                if (!parsedItems || parsedItems.length === 0) {
                  grouped[cleanPhone].manualCredits.push({
                    amount: Number(sale.total),
                    note: sale.note || "",
                    date: sale.date,
                  });
                } else {
                  grouped[cleanPhone].sales.push({
                    id: sale.id,
                    items: parsedItems,
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
        .sort((a, b) => {
          const getName = (acc: any) => {
            const c = customers.find(
              (x) => x.phone.toString() === acc.phone.toString()
            );
            return (c?.name || acc.phone || "").toLowerCase();
          };

          return getName(a).localeCompare(getName(b));
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
                      // Improved robust date parser for sorting
                      const parseDate = (d: string) => {
                        if (!d) return 0;

                        const parts = d.split(",");
                        const datePart = parts[0]?.trim();
                        const timePart = parts[1]?.trim() || "00:00:00";

                        if (!datePart) return 0;

                        const nums = datePart.split(/[\/\-]/).map(Number);
                        if (nums.length !== 3) return 0;

                        let day = nums[0];
                        let month = nums[1];
                        let year = nums[2];

                        const hasAmPm = /am|pm/i.test(d);

                        // STRONGER detection rules
                        if (hasAmPm) {
                          // US format → MM/DD/YYYY
                          month = nums[0];
                          day = nums[1];
                        } else if (nums[0] > 12) {
                          // DD/MM/YYYY
                          day = nums[0];
                          month = nums[1];
                        } else if (nums[1] > 12) {
                          // MM/DD/YYYY
                          month = nums[0];
                          day = nums[1];
                        } else {
                          // ⚠️ critical fix: check recent data pattern
                          // If both <=12, assume DD/MM (your system default)
                          day = nums[0];
                          month = nums[1];
                        }

                        // Normalize time (handle PM manually if needed)
                        let hours = 0, minutes = 0, seconds = 0;

                        const timeMatch = timePart.match(/(\d+):(\d+):(\d+)/);
                        if (timeMatch) {
                          hours = Number(timeMatch[1]);
                          minutes = Number(timeMatch[2]);
                          seconds = Number(timeMatch[3]);
                        }

                        if (/pm/i.test(timePart) && hours < 12) hours += 12;
                        if (/am/i.test(timePart) && hours === 12) hours = 0;

                        return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
                      };
                      const sortedSales = [...account.sales]
                        .map(s => ({ ...s, _ts: parseDate(s.date) }))
                        .sort((a, b) => b._ts - a._ts);

                      const salesHtml = sortedSales
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

                      const manualCreditsHtml = [...(account.manualCredits || [])]
                        .map(c => ({ ...c, _ts: parseDate(c.date) }))
                        .sort((a, b) => b._ts - a._ts)
                        .map(
                          (c) =>
                            `<div style="margin-bottom:6px;">$${c.amount.toFixed(2)} — ${c.date}${c.note ? ` (${c.note})` : ""}</div>`
                        )
                        .join("") || "<div>No manual credits</div>";

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
                            ${manualCreditsHtml}

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