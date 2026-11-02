"use client";

import { useEffect, useRef, useState } from "react";
import { RETAILER, customers, productById, type Customer, type Product } from "@/lib/data";

type Turn = { kind: "question" | "recommendation"; message: string; products: string[]; facts_used: string[] };
type Msg = { role: "user"; content: string } | { role: "assistant"; turn: Turn };
type Side = "catalogue" | "customer";
type Chat = { messages: Msg[]; loading: boolean; error?: string };

const OPENER = "I need something to wear to a wedding in June";
const EMPTY: Chat = { messages: [], loading: false };

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

// What the model sees of its own earlier turns: the text, plus which products it showed.
function toApi(messages: Msg[]) {
  return messages.map((m) =>
    m.role === "user"
      ? m
      : {
          role: "assistant" as const,
          content: m.turn.products.length
            ? `${m.turn.message}\n[Showed: ${m.turn.products.map((id) => productById.get(id)?.name).join(", ")}]`
            : m.turn.message,
        },
  );
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

function ChatPanel({ side, title, sub, chat, notice, onSend }: {
  side: Side; title: string; sub: string; chat: Chat; notice?: string | null; onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const questions = chat.messages.filter((m) => m.role === "assistant" && m.turn.kind === "question").length;
  const started = chat.messages.length > 0;

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [chat.messages.length, chat.loading]);

  return (
    <section className={`panel${side === "customer" ? " aware" : ""}`}>
      <div className="panel-head">
        <div>
          <p className="eyebrow"><span className="gt">&gt;</span> {side === "customer" ? "Knows the customer" : "Catalogue only"}</p>
          <h2>{title}</h2>
          <p className="sub">{sub}</p>
        </div>
        <div className="counter"><b>{questions}</b>questions asked</div>
      </div>

      {notice && <p className="notice">{notice}</p>}

      <div className="thread">
        {!started && <p className="placeholder">Start the conversation above.</p>}
        {chat.messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg user">{m.content}</div>
          ) : (
            <div key={i} className="msg bot">
              <p>{m.turn.message}</p>
              {m.turn.facts_used.length > 0 && (
                <div className="chips" aria-label="Why">{m.turn.facts_used.map((f) => <span className="chip" key={f}>{f}</span>)}</div>
              )}
              {m.turn.products.length > 0 && (
                <div className="cards">
                  {m.turn.products.map((id) => productById.get(id)).filter(Boolean).map((p) => <ProductCard key={p!.id} p={p!} />)}
                </div>
              )}
            </div>
          ),
        )}
        {chat.loading && <p className="loading">Thinking</p>}
        {chat.error && <p className="error">{chat.error}</p>}
        <div ref={end} />
      </div>

      {started && (
        <form className="reply" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSend(draft.trim()); setDraft(""); } }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply as the shopper" aria-label={`Reply to the ${side} assistant`} disabled={chat.loading} />
          <button disabled={chat.loading || !draft.trim()}>Send <span aria-hidden>&gt;</span></button>
        </form>
      )}
    </section>
  );
}

export default function Home() {
  const [customerId, setCustomerId] = useState("priya");
  const [consent, setConsent] = useState(true);
  const [opener, setOpener] = useState(OPENER);
  const [chats, setChats] = useState<Record<Side, Chat>>({ catalogue: EMPTY, customer: EMPTY });

  const customer = customers.find((c) => c.id === customerId);
  const personalised = Boolean(customer && consent);

  // A different shopper or consent setting is a different conversation.
  useEffect(() => { setChats({ catalogue: EMPTY, customer: EMPTY }); }, [customerId, consent]);

  async function send(side: Side, history: Msg[]) {
    setChats((c) => ({ ...c, [side]: { messages: history, loading: true } }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApi(history), side, customerId, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChats((c) => ({ ...c, [side]: { messages: [...history, { role: "assistant", turn: data }], loading: false } }));
    } catch (e) {
      setChats((c) => ({ ...c, [side]: { messages: history, loading: false, error: e instanceof Error ? e.message : "Something went wrong." } }));
    }
  }

  function start() {
    const first: Msg[] = [{ role: "user", content: opener.trim() }];
    send("catalogue", first);
    send("customer", first);
  }

  const notice = !customer
    ? "Anonymous visitor: no customer profile, so this assistant only has the catalogue."
    : !consent
      ? "Personalisation consent is off, so the customer's data isn't used. This assistant only has the catalogue."
      : null;

  const busy = chats.catalogue.loading || chats.customer.loading;

  return (
    <>
      <header className="bar">
        <div className="brand"><span className="gt">&gt;</span> {RETAILER}<small>Customer-aware shopping assistant · prototype</small></div>
        <span className="mode">Live · Claude</span>
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

        <form className="ask" onSubmit={(e) => { e.preventDefault(); if (opener.trim()) start(); }}>
          <input value={opener} onChange={(e) => setOpener(e.target.value)} aria-label="Shopper's first message" />
          <button disabled={busy || !opener.trim()}>{chats.catalogue.messages.length ? "Start over" : "Ask both"} <span aria-hidden>&gt;</span></button>
        </form>

        <div className="panels">
          <ChatPanel side="catalogue" title="What the agent sees" sub="Product catalogue only" chat={chats.catalogue} onSend={(t) => send("catalogue", [...chats.catalogue.messages, { role: "user", content: t }])} />
          <ChatPanel
            side="customer"
            title="What a great assistant knows"
            sub={personalised ? `Catalogue + ${customer!.profile.first_name}'s Klaviyo profile and history` : "Catalogue + customer profile"}
            chat={chats.customer} notice={notice}
            onSend={(t) => send("customer", [...chats.customer.messages, { role: "user", content: t }])}
          />
        </div>

        <p className="foot">{RETAILER} is a fictional retailer. All products and customers are synthetic.</p>
      </main>
    </>
  );
}
