"use client";

import { useEffect, useState } from "react";
import { RETAILER, customers, productById, type Customer, type Product } from "@/lib/data";

type Answer = { recommendation: string; products: string[]; facts_used: string[] };
type Result = { mode: "live" | "scripted"; catalogueOnly: Answer; knowsCustomer: Answer; fallbackReason: "anonymous" | "no-consent" | null };

const DEFAULT_QUESTION = "I need something to wear to a wedding in June";

const SWATCH: Record<string, string> = {
  champagne: "#e8d6b0", emerald: "#1f6b4f", sage: "#a9b89a", "dusty pink": "#d9a9a6", "cornflower blue": "#6f8fd8",
  terracotta: "#c0643f", "navy floral": "#283a63", lilac: "#c7a8e0", "butter yellow": "#f1df8f", ink: "#1d2333",
  black: "#0b0b0b", cobalt: "#1f47b8", oat: "#d8cdb6", "sky blue": "#9cc5e8", fuchsia: "#d0218c", jade: "#2e8b72",
  "red floral": "#b5303a", "pale pink": "#f1cfd3", white: "#f4f4f4", "yellow gingham": "#ecd36a", silver: "#c4c6cc",
  blush: "#e8b9b5", mint: "#b6e0c9", stone: "#b8ad9c", coral: "#ee7d65", olive: "#6b6b3a", midnight: "#1a1f3d",
  natural: "#d9c9a8", nude: "#d6b49b", ivory: "#f2ead8", gold: "#c9a54a", pearl: "#ece6dc", straw: "#d9c27c",
  print: "#8a5fb0", sand: "#cdb994", cream: "#efe6cf", "navy stripe": "#24304f", blue: "#5b84c4", cocoa: "#5b3f33",
  "mid blue": "#5a7fae", camel: "#b48a5a", navy: "#22305a", rust: "#a04a25",
};

function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#000" : "#fff";
}

function ProductCard({ p }: { p: Product }) {
  const colour = p.colours[0];
  const bg = SWATCH[colour] ?? "#555";
  return (
    <div className="card">
      <div className="swatch" style={{ background: bg, color: textOn(bg) }}>{colour}</div>
      <div className="info">
        <p className="name">{p.name}</p>
        <p className="price">
          {p.on_sale && <span className="badge sale">Sale</span>}
          {p.new_arrival && <span className="badge">New</span>}
          £{p.price}
          {p.was_price && <s>£{p.was_price}</s>}
        </p>
        <p className="fit">{p.length_fit}</p>
      </div>
    </div>
  );
}

function ProfileStrip({ c }: { c: Customer }) {
  const props = c.profile.properties;
  return (
    <div className="profile">
      <div className="props">
        <div><b>{c.profile.first_name}</b> · {c.profile.location.city}</div>
        {Object.entries(props).filter(([k]) => k !== "personalisation_consent").map(([k, v]) => (
          <div key={k}>{k.replace(/_/g, " ")}: {String(v)}</div>
        ))}
      </div>
      <div className="events">
        {c.events.map((e, i) => {
          const p = e.properties;
          const what = (p.product_name ?? p.campaign ?? (p.items as { product_name: string }[] | undefined)?.map((x) => x.product_name).join(", ")) as string;
          return (
            <span key={i} className={`ev${e.metric === "Refunded Order" ? " refund" : ""}`}>
              <em>{e.datetime.slice(0, 10)}</em>{e.metric}: {what}{p.return_reason ? ` (${p.return_reason})` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, sub, answer, aware, notice, loading, error }: {
  title: string; sub: string; answer?: Answer; aware?: boolean; notice?: string | null; loading: boolean; error?: string;
}) {
  return (
    <section className={`panel${aware ? " aware" : ""}`}>
      <p className="eyebrow"><span className="gt">&gt;</span> {aware ? "Knows the customer" : "Catalogue only"}</p>
      <h2>{title}</h2>
      <p className="sub">{sub}</p>
      {loading ? <p className="loading">Thinking</p>
        : error ? <p className="error">{error}</p>
        : !answer ? <p className="placeholder">Ask a question to compare.</p>
        : <>
            {notice && <p className="notice">{notice}</p>}
            <p className="reply">{answer.recommendation}</p>
            {aware && answer.facts_used.length > 0 && (
              <div className="chips" aria-label="Why">{answer.facts_used.map((f) => <span className="chip" key={f}>{f}</span>)}</div>
            )}
            <div className="cards">
              {answer.products.map((id) => productById.get(id)).filter(Boolean).map((p) => <ProductCard key={p!.id} p={p!} />)}
            </div>
          </>}
    </section>
  );
}

export default function Home() {
  const [customerId, setCustomerId] = useState("priya");
  const [consent, setConsent] = useState(true);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [result, setResult] = useState<Result>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const customer = customers.find((c) => c.id === customerId);

  async function run() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, customerId, consent }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Re-run when the customer or consent changes, so the comparison always matches the controls.
  useEffect(() => { run(); }, [customerId, consent]); // eslint-disable-line react-hooks/exhaustive-deps

  const notice = result?.fallbackReason === "anonymous"
    ? "Anonymous visitor: no customer profile, so this falls back to the catalogue-only answer."
    : result?.fallbackReason === "no-consent"
      ? "Personalisation consent is off, so the customer's data isn't used. Falling back to the catalogue-only answer."
      : null;

  return (
    <>
      <header className="bar">
        <div className="brand"><span className="gt">&gt;</span> {RETAILER}<small>Customer-aware shopping assistant · prototype</small></div>
        {result && <span className="mode">{result.mode === "live" ? "Live · Claude" : "Scripted demo · no API key"}</span>}
      </header>

      <main>
        <div className="controls">
          <div>
            <p className="eyebrow">Shopper</p>
            <div className="customers" role="group" aria-label="Shopper">
              <button className="cust" aria-pressed={customerId === "anonymous"} onClick={() => setCustomerId("anonymous")}>
                <b>Anonymous visitor</b><span>No profile</span>
              </button>
              {customers.map((c) => (
                <button key={c.id} className="cust" aria-pressed={customerId === c.id} onClick={() => setCustomerId(c.id)}>
                  <b>{c.profile.first_name}</b><span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="consent">
            <button type="button" role="switch" className="switch" aria-checked={consent} onClick={() => setConsent(!consent)} aria-label="Personalisation consent" />
            Personalisation consent
          </label>
        </div>

        {customer && <ProfileStrip c={customer} />}

        <form className="ask" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Shopper's question" />
          <button disabled={loading}>Ask <span aria-hidden>&gt;</span></button>
        </form>

        <div className="panels">
          <Panel title="What the agent sees" sub="Product catalogue only" answer={result?.catalogueOnly} loading={loading} error={error} />
          <Panel
            title="What a great assistant knows"
            sub={customer ? `Catalogue + ${customer.profile.first_name}'s Klaviyo profile and history` : "Catalogue + customer profile"}
            answer={result?.knowsCustomer} aware notice={notice} loading={loading} error={error}
          />
        </div>

        <p className="foot">{RETAILER} is a fictional retailer. All products and customers are synthetic.</p>
      </main>
    </>
  );
}
