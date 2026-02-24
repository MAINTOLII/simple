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