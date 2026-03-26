import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const TELEGRAM_BOT_TOKEN = "8476224927:AAG86ia9pkrjdGxWKShBFXFHr-uMFWGRyos";
const TELEGRAM_CHAT_ID = "6778722674";

type LogEntry = {
  id: string;
  text: string;
  created_at: string;
};

export default function Logbook() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("logbook")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) setEntries(data as any);
    };

    fetchLogs();
  }, []);

  const addEntry = async () => {
    if (!input.trim()) return;

    const { data, error } = await supabase
      .from("logbook")
      .insert({ text: input.trim() })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setEntries((prev) => [data as any, ...prev]);

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `📘 Mato POS Logbook\n🕒 ${new Date().toLocaleString()}\n\n${input.trim()}`,
        }),
      });

      // Fetch all credit sales from today (5AM Nairobi time)
      // Nairobi timezone offset is UTC+3
      const now = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();

      // Nairobi 5AM today in UTC
      const nairobi5AMUtc = new Date(Date.UTC(utcYear, utcMonth, utcDate, 2, 0, 0)); // 5AM Nairobi = 2AM UTC

      // If current time is before Nairobi 5AM, use previous day 5AM
      if (now < nairobi5AMUtc) {
        nairobi5AMUtc.setUTCDate(nairobi5AMUtc.getUTCDate() - 1);
      }

      // Fetch credit sales from 'sales' table with created_at >= nairobi5AMUtc and credit > 0
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("customer, credit")
        .gte("created_at", nairobi5AMUtc.toISOString())
        .gt("credit", 0);

      if (salesError) {
        console.error(salesError);
      } else if (salesData && salesData.length > 0) {
        // Calculate total credits per customer
        const creditsPerCustomer: { [key: string]: number } = {};
        salesData.forEach((sale: any) => {
          const customer = sale.customer || "Unknown";
          const credit = Number(sale.credit) || 0;
          if (!creditsPerCustomer[customer]) {
            creditsPerCustomer[customer] = 0;
          }
          creditsPerCustomer[customer] += credit;
        });

        // Format message
        let creditMessage = `💳 Credit Sales Summary (from 5AM Nairobi):\n`;
        for (const [customer, totalCredit] of Object.entries(creditsPerCustomer)) {
          creditMessage += `- ${customer}: ${totalCredit.toFixed(2)}\n`;
        }

        // Send credit summary message to Telegram
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: creditMessage,
          }),
        });
      }

      setInput("");
    }
  };

  const deleteEntry = async (entry: LogEntry) => {
    const ok = window.confirm("Delete this log entry?");
    if (!ok) return;

    const { error } = await supabase.from("logbook").delete().eq("id", entry.id);

    if (error) {
      console.error(error);
      window.alert("Failed to delete entry");
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  return (
    <div>
      <h3>Daily Log Book</h3>

      <div style={{ marginBottom: 15 }}>
        <textarea
          placeholder="Log anything: incidents, reversals, cash differences, stock received, shortages, etc..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            width: "100%",
            minHeight: 80,
            padding: 8,
            resize: "vertical",
            backgroundColor: "white",
            color: "black",
          }}
        />

        <button onClick={addEntry} style={{ marginTop: 8 }}>
          Add Log Entry
        </button>
      </div>

      <hr />

      {entries.length === 0 && <div>No log entries yet.</div>}

      {entries.map((entry) => (
        <div key={entry.id} style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#555" }}>
              {new Date(entry.created_at).toLocaleString()}
            </div>

            <button
              onClick={() => deleteEntry(entry)}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>

          <div>{entry.text}</div>
        </div>
      ))}
    </div>
  );
}