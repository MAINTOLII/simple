import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Product = {
  id: string;
  slug: string;
  qty: number;
  is_weight: boolean;
  cost: number;
  price: number;
};

export default function Qty() {
  const [products, setProducts] = useState<Product[]>([]);
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const totalInventoryWorth = products.reduce(
    (sum, p) => sum + p.qty * p.price,
    0
  );

  const lowStockItems = products
    .filter((p) => p.is_weight === false && p.qty >= 0 && p.qty <= 3)
    .sort((a, b) => a.qty - b.qty);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, slug, qty, is_weight, cost, price")
      .order("slug", { ascending: true });

    if (data && data.length > 0) {
      setProducts(data);
      setForm(data[0]);
    }
  };

  const goTo = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= products.length) return;
    setIndex(newIndex);
    setForm(products[newIndex]);
  };

  const handleSearch = (value: string) => {
    setSearch(value);

    const foundIndex = products.findIndex((p) =>
      p.slug.toLowerCase().includes(value.toLowerCase())
    );

    if (foundIndex !== -1) {
      goTo(foundIndex);
    }
  };

  const updateField = (field: keyof Product, value: any) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  const saveChanges = async () => {
    if (!form) return;

    const { error } = await supabase
      .from("products")
      .update({
        slug: form.slug,
        qty: form.qty,
        is_weight: form.is_weight,
        cost: form.cost,
        price: form.price,
      })
      .eq("id", form.id);

    if (!error) {
      const updated = [...products];
      updated[index] = form;
      setProducts(updated);

      // automatically go to next item if exists
      if (index < updated.length - 1) {
        goTo(index + 1);
      }
    }
  };

  const openLowStockStatement = () => {
    const now = new Date();

    const rows = lowStockItems
      .map(
        (p) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${p.slug}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${p.qty}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${p.is_weight ? "kg" : "pcs"}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Low Stock Statement</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 6px 0; }
            .meta { color: #666; font-size: 12px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; font-size: 12px; color: #666; padding: 8px; border-bottom: 2px solid #ddd; }
            .actions { display:flex; gap:8px; margin: 12px 0 16px 0; }
            button { padding: 8px 10px; font-size: 14px; cursor: pointer; }
            @media print {
              .actions { display:none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>Low Stock Items (0–3)</h2>
          <div class="meta">Generated: ${now.toLocaleString()} • Total: ${lowStockItems.length}</div>

          <div class="actions">
            <button onclick="window.print()">Print / Save as PDF</button>
            <button onclick="window.close()">Close</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:right;">Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="3" style="padding:8px;">No low stock items 🎉</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked. Please allow popups to print the low stock statement.");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!form) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 30, maxWidth: 500, margin: "auto", position: "relative" }}>

      <button
        onClick={openLowStockStatement}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          fontSize: 10,
          padding: "4px 8px",
        }}
      >
        Low
      </button>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: "100%", padding: 6 }}
          />
        </div>
        <div>
          <strong>
            {index + 1}/{products.length}
          </strong>
        </div>

        <div style={{ marginTop: 8, fontSize: 14 }}>
          Total Inventory Worth: $
          {totalInventoryWorth.toFixed(2)}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ marginBottom: 15 }}>
          <label>Name</label>
          <input
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label>Quantity</label>
          <input
            type="number"
            step={form.is_weight ? "0.001" : "1"}
            value={form.qty}
            onChange={(e) =>
              updateField("qty", parseFloat(e.target.value))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label>Cost</label>
          <input
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) =>
              updateField("cost", parseFloat(e.target.value))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label>Price</label>
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) =>
              updateField("price", parseFloat(e.target.value))
            }
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>
            <input
              type="checkbox"
              checked={form.is_weight}
              onChange={(e) => updateField("is_weight", e.target.checked)}
            />{" "}
            Is Weight Item
          </label>
        </div>

        <button
          onClick={saveChanges}
          style={{ width: "100%", padding: 8 }}
        >
          Save Changes
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 20,
        }}
      >
        <button onClick={() => goTo(index - 1)}>⬅ Prev</button>
        <button
          onClick={async () => {
            await saveChanges();
          }}
        >
          Next ➡
        </button>
      </div>
    </div>
  );
}