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
Do not invent products, stock, sizes or facts.`;

const CATALOGUE_ONLY = `${BASE}
You know nothing about this shopper beyond their question. Recommend from the catalogue alone.
Return facts_used as an empty array.`;

const KNOWS_CUSTOMER = `${BASE}
You also have this shopper's customer profile and event history from the retailer's CRM (Klaviyo).
They have consented to personalisation. Use what the history tells you about fit, returns, price band and what they respond to.
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

// Scripted answers for running without an API key. Shown in the UI as "Scripted demo".
export function scripted(customer?: Customer): Answer {
  if (!customer)
    return {
      recommendation: "For a June wedding, a satin mini is a great statement, or go for a floaty pleated midi. Finish with block-heel sandals that work on grass.",
      products: ["d01", "d02", "s01"],
      facts_used: [],
    };
  const answers: Record<string, Answer> = {
    priya: {
      recommendation: "Priya, for June I'd skip the minis and go long. The Freya Tall maxi is cut for 5'8\" and over, and the Juniper maxi you looked at is long enough with a heel. Both come in your size 12.",
      products: ["d14", "d03", "s01"],
      facts_used: ["Returned 3 dresses as too short", "Usual size 12", "Height 5'10\"", "Kept the Isla Tall midi"],
    },
    charlotte: {
      recommendation: "Charlotte, the Aurelia silk bias midi from our new-in occasion edit would be beautiful for June, and it pairs with the Vera slingbacks you already have. The Delphine maxi is the showstopper alternative.",
      products: ["d05", "d08", "o01"],
      facts_used: ["Clicked the Aurelia in 'New In: Occasion'", "Buys new arrivals", "Average order £255", "Owns the Vera Slingback"],
    },
    jess: {
      recommendation: "Jess, the Esme wrap midi you were looking at is now £69 (was £110) and still in your size 14. The Rosa puff-sleeve midi is £59, and the Alba wedges are £35 and good on grass.",
      products: ["d04", "d10", "s03"],
      facts_used: ["Every order bought on sale", "Viewed the Esme wrap midi", "No order in 9 months", "Usual size 14"],
    },
  };
  return answers[customer.id];
}
