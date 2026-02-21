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
        return { ...i, price };
      })
    );
  };

  const updateLineTotal = (id: string, value: string) => {
    setLineTotals((prev) => ({ ...prev, [id]: value }));

    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (value === "") return { ...i, price: 0 };

        const lineTotal = parseFloat(value);
        if (isNaN(lineTotal) || i.quantity <= 0) return i;

        const newUnitPrice = lineTotal / i.quantity;
        return { ...i, price: parseFloat(newUnitPrice.toFixed(2)) };
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
    const cleanCustomer = customerInput
      ? extractCustomerValue(customerInput)
      : undefined;

    const newSale = createSale("cash", cleanCustomer);
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

    let cleanCustomer = extractCustomerValue(customerInput);

    // normalize phone (remove leading zero)
    if (cleanCustomer.startsWith("0")) {
      cleanCustomer = cleanCustomer.slice(1);
    }

    // ensure numeric
    const numericPhone = Number(cleanCustomer);
    if (isNaN(numericPhone)) {
      alert("Customer phone must be a valid number.");
      return;
    }

    // check if customer exists
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", numericPhone)
      .maybeSingle();

    // if not exists → create customer
    if (!existingCustomer) {
      await supabase.from("customers").insert({
        id: numericPhone,
        phone: numericPhone,
        name: null,
      });

      // refresh local customers state
      setCustomers((prev) => [
        ...prev,
        { id: numericPhone, phone: numericPhone, name: null },
      ]);
    }

    const newSale = createSale("credit", cleanCustomer);
    await reduceStockAndSync();

    const { error } = await supabase.from("sales").insert({
      date: newSale.date,
      total: newSale.total,
      profit: newSale.profit,
      type: newSale.type,
      customer: numericPhone.toString(),
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
                step={i.unit === "kg" ? "0.01" : "1"}
                value={i.quantity === 0 ? "" : i.quantity}
                onChange={(e) => updateQuantity(i.id, e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Unit Price ($)</div>
              <input
                type="number"
                step="0.01"
                value={i.price === 0 ? "" : i.price}
                onChange={(e) => updatePrice(i.id, e.target.value)}
                style={{ width: 90 }}
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