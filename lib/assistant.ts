import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { RETAILER, type Customer, type Product } from "./data";

export const MODEL = "claude-opus-5-5";

export const AnswerSchema = z.object({
  recommendation: z.string(),
  products: z.array(z.string()),
  facts_used: z.array(z.string()),
});
export type Answer = z.infer<typeof AnswerSchema>;

const client = new Anthropic();

const BASE = `You are the online shopping assistant for ${RETAILER}, a UK fashion retailer.
Recommend 2 or 3 products from the catalogue provided, by id. Only use ids that appear in the catalogue.
Write the recommendation as a short, warm reply to the shopper (60 words or fewer), in British English, prices in £.
Do not invent products, stock, sizes or facts.
Refer to products by name only. Never write product ids in the recommendation text.`;

const CATALOGUE_ONLY = `${BASE}
You know nothing about this shopper beyond their question. Recommend from the catalogue alone.
Return facts_used as an empty array.`;

const KNOWS_CUSTOMER = `${BASE}
You also have this shopper's customer profile and event history from the retailer's CRM (Klaviyo).
They have consented to personalisation. Use what the history tells you about fit, returns, price band and what they respond to.
Only state things about the customer that their profile or events actually say (for example, don't give a colour for something they bought if the order doesn't record one).
Address them by first name. Don't recite their data back to them or sound like surveillance: use it the way a great shop assistant who remembers them would.
Return facts_used: 2 to 4 short labels (under 8 words each) naming the specific customer facts that changed your answer, e.g. "Returned 3 dresses as too short".`;

export async function ask(question: string, catalogue: Product[], customer?: Customer): Promise<Answer> {
  const today = new Date().toISOString().slice(0, 10);
  const parts = [`Today is ${today}.`, `Catalogue:\n${JSON.stringify(catalogue)}`];
  if (customer) parts.push(`Customer profile:\n${JSON.stringify(customer.profile)}`, `Customer events (newest first):\n${JSON.stringify(customer.events)}`);
  parts.push(`Shopper's question: ${question}`);

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: customer ? KNOWS_CUSTOMER : CATALOGUE_ONLY,
    messages: [{ role: "user", content: parts.join("\n\n") }],
    output_config: { effort: "low", format: betaZodOutputFormat(AnswerSchema) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`No usable answer (stop_reason: ${response.stop_reason})`);
  }
  const ids = new Set(catalogue.map((p) => p.id));
  const out = response.parsed_output;
  return { ...out, products: out.products.filter((id) => ids.has(id)).slice(0, 3), facts_used: customer ? out.facts_used : [] };
}
