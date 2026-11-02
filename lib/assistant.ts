import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { RETAILER, type Customer, type Product } from "./data";

export const MODEL = "claude-opus-5-5";

export const TurnSchema = z.object({
  kind: z.enum(["question", "recommendation"]),
  message: z.string(),
  products: z.array(z.string()),
  facts_used: z.array(z.string()),
});
export type Turn = z.infer<typeof TurnSchema>;

export type ChatMessage = { role: "user" | "assistant"; content: string };

const client = new Anthropic();

const BASE = `You are the online shopping assistant for ${RETAILER}, a UK fashion retailer. Behave like a great in-store sales assistant.
Before recommending, make sure you know what you need to give a good answer: typically the occasion and dress code, their size, their budget, and anything about fit or style they want or avoid.
Ask ONE short question per turn (kind "question", products empty). Ask the most important thing first. Ask at most 3 questions in total, then recommend.
When you know enough, recommend 2 or 3 products from the catalogue (kind "recommendation"), by id. Only use ids that appear in the catalogue, and only sizes they stock.
Keep every message short and warm (60 words or fewer), in British English, prices in £.
Refer to products by name only. Never write product ids in the message. Do not invent products, stock, sizes or facts.`;

const CATALOGUE_ONLY = `${BASE}
You know nothing about this shopper beyond what they tell you in this conversation.
Return facts_used as an empty array.`;

const KNOWS_CUSTOMER = `${BASE}
You also have this shopper's customer profile and event history from the retailer's CRM (Klaviyo). They have consented to personalisation.
Don't ask for anything the history already answers (size, fit problems, price band, styles they like). Only ask what the data can't tell you, such as the dress code or time of day. If the history answers everything, recommend straight away.
Your FIRST reply must open by saying, naturally and in your own words, that you'll look at their past orders with ${RETAILER} (for example "Let me take a look at your past orders with us..."), then continue. Say this only once.
Address them by first name. Only state things their profile or events actually say (don't give a colour for a past purchase if the order doesn't record one). Use what you know the way a shop assistant who remembers them would, without reciting their data back.
Return facts_used on every turn: 1 to 4 short labels (under 8 words each) naming the customer facts you used in this turn, e.g. "Returned 3 dresses as too short" or "Usual size 12".`;

export async function reply(messages: ChatMessage[], catalogue: Product[], customer?: Customer): Promise<Turn> {
  const today = new Date().toISOString().slice(0, 10);
  const context = [`Today is ${today}.`, `Catalogue:\n${JSON.stringify(catalogue)}`];
  if (customer) context.push(`Customer profile:\n${JSON.stringify(customer.profile)}`, `Customer events (newest first):\n${JSON.stringify(customer.events)}`);

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${customer ? KNOWS_CUSTOMER : CATALOGUE_ONLY}\n\n${context.join("\n\n")}`,
    messages,
    output_config: { effort: "low", format: betaZodOutputFormat(TurnSchema) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`No usable answer (stop_reason: ${response.stop_reason})`);
  }
  const ids = new Set(catalogue.map((p) => p.id));
  const out = response.parsed_output;
  return {
    ...out,
    products: out.kind === "recommendation" ? out.products.filter((id) => ids.has(id)).slice(0, 3) : [],
    facts_used: customer ? out.facts_used : [],
  };
}
