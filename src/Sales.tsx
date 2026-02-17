import { useState } from "react";

import type { Sale, CreditAccount } from "./types";

type Product = {
  id: number;
  name: string;
  price: number;
  cost: number;
  unit: "piece" | "kg";
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  unit: "piece" | "kg";
};

type Props = {
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  setCredits: React.Dispatch<React.SetStateAction<CreditAccount[]>>;
};

export default function Sales({
  setSales,
  setCredits,
}: Props) {
  const [products] = useState<Product[]>([
    { id: 1, name: "Ice Bag", price: 0.3, cost: 0.15, unit: "piece" },
    { id: 2, name: "Soap", price: 1, cost: 0.6, unit: "piece" },
    { id: 3, name: "Banana (kg)", price: 2.5, cost: 1.8, unit: "kg" },
    { id: 4, name: "Raisins (kg)", price: 4, cost: 3, unit: "kg" },
  ]);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerInput, setCustomerInput] = useState("");

  const filteredProducts =
    search.length >= 2
      ? products.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        )
      : [];

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + (product.unit === "kg" ? 0.1 : 1) }
            : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          cost: product.cost,
          quantity: product.unit === "kg" ? 0.1 : 1,
          unit: product.unit,
        },
      ];
    });
    setSearch("");
  };

  const updateQuantity = (id: number, value: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        if (value === "") {
          return { ...i, quantity: 0 };
        }

        const quantity = parseFloat(value);
        if (isNaN(quantity)) return i;

        if (i.unit === "piece") {
          return { ...i, quantity: quantity };
        }

        return { ...i, quantity };
      })
    );
  };

  const updatePrice = (id: number, value: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        if (value === "") {
          return { ...i, price: 0 };
        }

        const price = parseFloat(value);
        if (isNaN(price)) return i;

        return { ...i, price };
      })
    );
  };

  const updateLineTotal = (id: number, value: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        if (value === "") {
          return { ...i, price: 0 };
        }

        const lineTotal = parseFloat(value);
        if (isNaN(lineTotal) || i.quantity === 0) return i;

        const newUnitPrice = lineTotal / i.quantity;

        return { ...i, price: newUnitPrice };
      })
    );
  };

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
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
    items: cart.map((item) => ({
      ...item,
    })),
    total,
    profit,
    date: new Date().toLocaleString(),
    type,
    customer: customer || undefined,
    shsAmount,
  });

  const cashCheckout = () => {
    if (!cart.length) return;
    setSales((p) => [...p, createSale("cash", customerInput)]);
    setCart([]);
    setCustomerInput("");
  };

  const creditCheckout = () => {
    if (!cart.length) return;
    const phone = prompt("Customer phone number:");
    if (!phone) return;

    const sale = createSale("credit", phone);
    setSales((p) => [...p, sale]);

    setCredits((prev) => {
      const existing = prev.find((c) => c.phone === phone);
      if (existing) {
        return prev.map((c) =>
          c.phone === phone ? { ...c, sales: [...c.sales, sale] } : c
        );
      }
      return [
        ...prev,
        { phone, sales: [sale], payments: [], manualCredits: [] },
      ];
    });

    setCart([]);
  };

  const shsCheckout = () => {
    if (!cart.length) return;

    const shsInput = prompt("How many Somali Shillings received?");
    if (!shsInput) return;

    const shsValue = parseFloat(shsInput);
    if (isNaN(shsValue)) return;

    const sale = createSale("shs", undefined, shsValue);
    setSales((p) => [...p, sale]);

    setCart([]);
    setCustomerInput("");
  };

  return (
    <>
      <input
        style={{ width: "100%", marginBottom: 8 }}
        placeholder="Search product..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredProducts.map((p) => (
        <div
          key={p.id}
          onClick={() => addToCart(p)}
          style={{ cursor: "pointer" }}
        >
          {p.name} — ${p.price}
        </div>
      ))}

      <input
        style={{ width: "100%", marginTop: 8 }}
        placeholder="Customer (optional)"
        value={customerInput}
        onChange={(e) => setCustomerInput(e.target.value)}
      />

      <hr style={{ margin: "25px 0" }} />

      {cart.map((i) => (
        <div key={i.id} style={{ marginBottom: 8 }}>
          {i.name}
          <div style={{ display: "flex", gap: 5 }}>
            <div>
              <div style={{ fontSize: 12 }}>Qty ({i.unit})</div>
              <input
                type="number"
                step={i.unit === "kg" ? "0.01" : "1"}
                value={i.quantity === 0 ? "" : i.quantity}
                onChange={(e) =>
                  updateQuantity(i.id, e.target.value)
                }
                style={{ width: 80 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Unit Price ($)</div>
              <input
                type="number"
                step="0.01"
                value={i.price === 0 ? "" : i.price}
                onChange={(e) =>
                  updatePrice(i.id, e.target.value)
                }
                style={{ width: 90 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Line Total ($)</div>
              <input
                type="number"
                step="0.01"
                value={
                  i.quantity === 0
                    ? ""
                    : (i.price * i.quantity).toFixed(2)
                }
                onChange={(e) =>
                  updateLineTotal(i.id, e.target.value)
                }
                style={{ width: 100 }}
              />
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        <strong>Total: ${total.toFixed(2)}</strong>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={cashCheckout}>Cash</button>
        <button onClick={creditCheckout}>Credit</button>
        <button onClick={shsCheckout}>SHS</button>
      </div>
    </>
  );
}