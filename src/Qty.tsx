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

  const totalInventoryWorth = products.reduce(
    (sum, p) => sum + p.qty * p.price,
    0
  );

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
      alert("Updated ✅");
    }
  };

  if (!form) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 30, maxWidth: 500, margin: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
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
        <button onClick={() => goTo(index + 1)}>Next ➡</button>
      </div>
    </div>
  );
}