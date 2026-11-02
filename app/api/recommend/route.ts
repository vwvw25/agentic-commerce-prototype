import { NextResponse } from "next/server";
import { ask, scripted } from "@/lib/assistant";
import { catalogueFor, customers } from "@/lib/data";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { question, customerId, consent } = (await req.json()) as { question: string; customerId: string; consent: boolean };
  if (!question?.trim()) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });

  const customer = customers.find((c) => c.id === customerId);
  const personalised = Boolean(customer && consent);
  const fallbackReason = !customer ? "anonymous" : !consent ? "no-consent" : null;
  const live = Boolean(process.env.ANTHROPIC_API_KEY);

  try {
    const catalogue = catalogueFor(question);
    const [catalogueOnly, knowsCustomer] = live
      ? await Promise.all([ask(question, catalogue), personalised ? ask(question, catalogue, customer) : null])
      : [scripted(), personalised ? scripted(customer) : null];

    return NextResponse.json({
      mode: live ? "live" : "scripted",
      catalogueOnly,
      // Without a customer or consent, the right panel falls back to the catalogue-only answer.
      knowsCustomer: knowsCustomer ?? catalogueOnly,
      fallbackReason,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "The assistant couldn't answer. Try again." }, { status: 502 });
  }
}
