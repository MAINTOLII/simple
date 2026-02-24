import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { Sale } from "./types";

type Product = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
  price: number;
  is_weight: boolean;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  unit: "piece" | "kg";
};

type Props = {
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
};

export default function Sales({ setSales }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<
    { id: number; name: string | null; phone: number }[]
  >([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("mato_cart");
    return saved ? JSON.parse(saved) : [];
  });

  const [customerInput, setCustomerInput] = useState(() => {
    return localStorage.getItem("mato_customer") || "";
  });

  const [lineTotals, setLineTotals] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("mato_line_totals");
    return saved ? JSON.parse(saved) : {};
  });
  const [lockedPrices, setLockedPrices] = useState<Record<string, boolean>>({});
  useEffect(() => {
    localStorage.setItem("mato_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("mato_customer", customerInput);
  }, [customerInput]);

  useEffect(() => {
    localStorage.setItem("mato_line_totals", JSON.stringify(lineTotals));
  }, [lineTotals]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("*");
      if (data) {
        setProducts(
          data.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            qty: Number(p.qty),
            cost: Number(p.cost),
            price: Number(p.price),
            is_weight: p.is_weight,
          }))
        );
      }
    };

    const fetchCustomers = async () => {
      const { data } = await supabase.from("customers").select("*");
      if (data) setCustomers(data);
    };

    fetchProducts();
    fetchCustomers();
  }, []);

  const filteredProducts =
    search.length >= 2
      ? products.filter((p) =>
          p.slug.toLowerCase().includes(search.toLowerCase())
        )
      : [];

  const filteredCustomers =
    customerInput.length >= 2
      ? customers.filter((c) => {
          const nameMatch =
            c.name &&
            c.name.toLowerCase().includes(customerInput.toLowerCase());
          const phoneMatch = c.phone.toString().includes(customerInput);
          return nameMatch || phoneMatch;
        })
      : [];

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      const quantityToAdd = product.is_weight ? 0.1 : 1;

      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + quantityToAdd }
            : i
        );
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.slug,
          price: product.price,
          cost: product.cost,
          quantity: quantityToAdd,
          unit: product.is_weight ? "kg" : "piece",
        },
      ];
    });
    setSearch("");
  };

  const updateQuantity = (id: string, value: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (value === "") return { ...i, quantity: 0 };

        const quantity = parseFloat(value);
        if (isNaN(quantity)) return i;

        const manualLine = lineTotals[id];

        // If line total exists → recalc unit price, unless locked for kg
        if (
          manualLine !== undefined &&
          manualLine !== "" &&
          !(lockedPrices[id] && i.unit === "kg")
        ) {
          const lineTotal = parseFloat(manualLine);
          if (!isNaN(lineTotal) && quantity > 0) {
            const newPrice = lineTotal / quantity;
            return { ...i, quantity, price: parseFloat(newPrice.toFixed(2)) };
          }
        }

        return { ...i, quantity };
      })
    );
  };

  const updatePrice = (id: string, value: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (value === "") return { ...i, price: 0 };

        const price = parseFloat(value);
        if (isNaN(price)) return i;

        const manualLine = lineTotals[id];

        // If line total exists → recalc quantity
        if (manualLine !== undefined && manualLine !== "") {
          const lineTotal = parseFloat(manualLine);
          if (!isNaN(lineTotal) && price > 0) {
            const newQty = lineTotal / price;
            return { ...i, price: parseFloat(price.toFixed(2)), quantity: parseFloat(newQty.toFixed(3)) };
          }
        }

        return { ...i, price: parseFloat(price.toFixed(2)) };
      })
    );
  };

  const updateLineTotal = (id: string, value: string) => {
    setLineTotals((prev) => ({ ...prev, [id]: value }));

    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (value === "") return i;

        const lineTotal = parseFloat(value);
        if (isNaN(lineTotal)) return i;

        // LOCKED MODE (kg only)
        if (lockedPrices[id] && i.unit === "kg" && i.price > 0) {
          const newQty = lineTotal / i.price;
          return { ...i, quantity: parseFloat(newQty.toFixed(3)) };
        }

        // NORMAL BEHAVIOUR
        if (i.price > 0) {
          const newQty = lineTotal / i.price;
          return { ...i, quantity: parseFloat(newQty.toFixed(3)) };
        }

        if (i.quantity > 0) {
          const newPrice = lineTotal / i.quantity;
          return { ...i, price: parseFloat(newPrice.toFixed(2)) };
        }

        return i;
      })
    );
  };

  const total = cart.reduce((sum, i) => {
    const manualLine = lineTotals[i.id];

    if (manualLine !== undefined && manualLine !== "") {
      const parsed = parseFloat(manualLine);
      if (!isNaN(parsed)) return sum + parsed;
    }

    return sum + i.price * i.quantity;
  }, 0);

  const extractCustomerValue = (input: string) => {
    const match = input.match(/\((\d+)\)/);
    if (match) return match[1];
    return input.trim();
  };

  const normalizeAndEnsureCustomer = async (input: string) => {
    let clean = input.trim();

    // remove leading zeros
    while (clean.startsWith("0")) {
      clean = clean.slice(1);
    }

    // If numeric, ensure customer exists in DB
    const numericPhone = clean ? Number(clean) : NaN;
    const isNumeric = clean !== "" && !isNaN(numericPhone);

    if (isNumeric) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", numericPhone)
        .maybeSingle();

      if (!existingCustomer) {
        await supabase.from("customers").insert({
          id: numericPhone,
          phone: numericPhone,
          name: null,
        });

        setCustomers((prev) => [
          ...prev,
          { id: numericPhone, phone: numericPhone, name: null },
        ]);
      }

      return { clean, numericPhone };
    }

    // Non-numeric entries are allowed, but won't be added to customers table
    return { clean, numericPhone: null };
  };

  const profit = cart.reduce(
    (s, i) => s + (i.price - i.cost) * i.quantity,
    0
  );

  const createSale = (
    type: "cash" | "credit" | "shs",
    customer?: string,
    shsAmount?: number
  ): Sale => ({
    id: Date.now(),
    items: cart,
    total,
    profit,
    date: new Date().toLocaleString(),
    type,
    customer: customer || undefined,
    shsAmount,
  });

  const reduceStockAndSync = async () => {
    for (const item of cart) {
      const product = products.find((p) => p.id === item.id);
      if (!product) continue;

      const newQty = product.qty - item.quantity;

      await supabase
        .from("products")
        .update({ qty: newQty })
        .eq("id", item.id);
    }

    setProducts((prev) =>
      prev.map((prod) => {
        const soldItem = cart.find((c) => c.id === prod.id);
        if (!soldItem) return prod;
        return { ...prod, qty: prod.qty - soldItem.quantity };
      })
    );
  };

  const cashCheckout = async () => {
    if (!cart.length) return;
    let cleanCustomerForSale: string | undefined = undefined;

    if (customerInput.trim()) {
      const raw = extractCustomerValue(customerInput);
      const { clean } = await normalizeAndEnsureCustomer(raw);
      cleanCustomerForSale = clean ? clean : undefined;
    }

    const newSale = createSale("cash", cleanCustomerForSale);
    await reduceStockAndSync();

    const { error } = await supabase.from("sales").insert({
      date: newSale.date,
      total: newSale.total,
      profit: newSale.profit,
      type: newSale.type,
      customer: newSale.customer || null,
      shs_amount: null,
      items: newSale.items,
    });

    if (error) {
      alert("Failed to save sale to database");
      console.error(error);
      return;
    }

    const { data: refreshedSales } = await supabase
      .from("sales")
      .select("*")
      .order("id", { ascending: false });

    if (refreshedSales) setSales(refreshedSales as any);

    setCart([]);
    setLineTotals({});
    setCustomerInput("");
    localStorage.removeItem("mato_cart");
    localStorage.removeItem("mato_customer");
    localStorage.removeItem("mato_line_totals");
    alert("Transaction complete");
  };

  const creditCheckout = async () => {
    if (!cart.length) return;
    if (!customerInput.trim()) {
      alert("Customer field cannot be empty.");
      return;
    }

    const raw = extractCustomerValue(customerInput);
    const { clean } = await normalizeAndEnsureCustomer(raw);

    const newSale = createSale("credit", clean);
    await reduceStockAndSync();

    const { error } = await supabase.from("sales").insert({
      date: newSale.date,
      total: newSale.total,
      profit: newSale.profit,
      type: newSale.type,
      customer: newSale.customer || null,
      shs_amount: null,
      items: newSale.items,
    });

    if (error) {
      alert("Failed to save sale to database");
      console.error(error);
      return;
    }

    const { data: refreshedSales } = await supabase
      .from("sales")
      .select("*")
      .order("id", { ascending: false });

    if (refreshedSales) setSales(refreshedSales as any);

    setCart([]);
    setLineTotals({});
    setCustomerInput("");
    localStorage.removeItem("mato_cart");
    localStorage.removeItem("mato_customer");
    localStorage.removeItem("mato_line_totals");
    alert("Credit transaction complete");
  };

  const shsCheckout = async () => {
    if (!cart.length) return;
    const shsInput = prompt("How many Somali Shillings received?");
    if (!shsInput) return;
    const shsValue = parseFloat(shsInput);
    if (isNaN(shsValue)) return;

    const newSale = createSale("shs", undefined, shsValue);
    await reduceStockAndSync();

    const { error } = await supabase.from("sales").insert({
      date: newSale.date,
      total: newSale.total,
      profit: newSale.profit,
      type: newSale.type,
      customer: null,
      shs_amount: newSale.shsAmount || null,
      items: newSale.items,
    });

    if (error) {
      alert("Failed to save sale to database");
      console.error(error);
      return;
    }

    const { data: refreshedSales } = await supabase
      .from("sales")
      .select("*")
      .order("id", { ascending: false });

    if (refreshedSales) setSales(refreshedSales as any);

    setCart([]);
    setLineTotals({});
    localStorage.removeItem("mato_cart");
    localStorage.removeItem("mato_customer");
    localStorage.removeItem("mato_line_totals");
    alert("SHS transaction complete");
  };

  return (
    <>
      <input
        style={{ width: "100%", marginBottom: 8 }}
        placeholder="Search product..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ marginBottom: 10 }}>
        <input
          style={{ width: "100%", marginBottom: 4 }}
          placeholder="Customer name or phone (optional for cash)"
          value={customerInput}
          onChange={(e) => setCustomerInput(e.target.value)}
        />

        {filteredCustomers.length > 0 && (
          <div
            style={{
              border: "1px solid #ccc",
              background: "black",
              color: "white",
              maxHeight: 150,
              overflowY: "auto",
            }}
          >
            {filteredCustomers.map((c) => (
              <div
                key={c.id}
                style={{ padding: 6, cursor: "pointer", color: "white" }}
                onClick={() =>
                  setCustomerInput(
                    c.name ? `${c.name} (${c.phone})` : c.phone.toString()
                  )
                }
              >
                {c.name ? `${c.name} (${c.phone})` : c.phone}
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredProducts.map((p) => (
        <div
          key={p.id}
          onClick={() => addToCart(p)}
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            {p.slug} — ${p.price}
          </span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>({p.qty})</span>
        </div>
      ))}

      <hr style={{ margin: "25px 0" }} />

      {cart.map((i) => (
        <div key={i.id} style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{i.name}</span>
            <span
              onClick={() => {
                setCart((prev) => prev.filter((item) => item.id !== i.id));
                setLineTotals((prev) => {
                  const copy = { ...prev };
                  delete copy[i.id];
                  return copy;
                });
              }}
              style={{
                color: "red",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold",
                paddingLeft: 8,
              }}
            >
              ×
            </span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <div>
              <div style={{ fontSize: 12 }}>Qty ({i.unit})</div>
              <input
                type="number"
                step={i.unit === "kg" ? "0.001" : "1"}
                value={i.quantity === 0 ? "" : i.quantity}
                onChange={(e) => updateQuantity(i.id, e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                Unit Price ($)
                {i.unit === "kg" && (
                  <span
                    onClick={() =>
                      setLockedPrices((prev) => ({
                        ...prev,
                        [i.id]: !prev[i.id],
                      }))
                    }
                    style={{
                      cursor: "pointer",
                      fontSize: 12,
                      color: lockedPrices[i.id] ? "gold" : "#888",
                    }}
                    title="Lock unit price"
                  >
                    ⚡
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                value={i.price === 0 ? "" : i.price}
                onChange={(e) => updatePrice(i.id, e.target.value)}
                style={{ width: 90 }}
                disabled={lockedPrices[i.id] && i.unit === "kg"}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Line Total ($)</div>
              <input
                type="number"
                step="0.01"
                value={
                  lineTotals[i.id] !== undefined
                    ? lineTotals[i.id]
                    : i.quantity === 0
                    ? ""
                    : (i.price * i.quantity).toFixed(2)
                }
                onChange={(e) => updateLineTotal(i.id, e.target.value)}
                style={{ width: 100 }}
              />
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        <strong>Total: ${total.toFixed(2)}</strong>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={cashCheckout}>Cash</button>
        <button onClick={creditCheckout}>Credit</button>
        <button onClick={shsCheckout}>SHS</button>
        <button
          onClick={() => {
            setCart([]);
            setLineTotals({});
            setCustomerInput("");
            localStorage.removeItem("mato_cart");
            localStorage.removeItem("mato_customer");
            localStorage.removeItem("mato_line_totals");
          }}
        >
          Clear
        </button>
      </div>
    </>
  );
}