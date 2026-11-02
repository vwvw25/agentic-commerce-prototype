import { NextResponse } from "next/server";
import { reply, type ChatMessage } from "@/lib/assistant";
import { catalogueFor, customers } from "@/lib/data";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, side, customerId, consent } = (await req.json()) as {
    messages: ChatMessage[];
    side: "catalogue" | "customer";
    customerId: string;
    consent: boolean;
  };
  if (!messages?.length) return NextResponse.json({ error: "Say something first." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });

  // The customer side only gets the profile with consent; otherwise it behaves like the catalogue side.
  const customer = side === "customer" && consent ? customers.find((c) => c.id === customerId) : undefined;
  const catalogue = catalogueFor(messages.filter((m) => m.role === "user").map((m) => m.content).join(" "));

  try {
    return NextResponse.json(await reply(messages, catalogue, customer));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "The assistant couldn't answer. Try again." }, { status: 502 });
  }
}
