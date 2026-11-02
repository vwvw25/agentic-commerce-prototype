import productsJson from "@/data/products.json";
import customersJson from "@/data/customers.json";

export const RETAILER = "Ondine & Vale";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  was_price?: number;
  sizes: string[];
  colours: string[];
  length_fit: string;
  tags: string[];
  on_sale: boolean;
  new_arrival: boolean;
};

export type KlaviyoEvent = {
  metric: "Placed Order" | "Refunded Order" | "Viewed Product" | "Opened Email" | "Clicked Email";
  datetime: string;
  properties: Record<string, unknown>;
};

export type Customer = {
  id: string;
  label: string;
  profile: {
    first_name: string;
    email: string;
    location: { city: string; country: string };
    properties: Record<string, string | number | boolean>;
  };
  events: KlaviyoEvent[];
};

export const products = productsJson as Product[];
export const customers = customersJson as unknown as Customer[];

export const productById = new Map(products.map((p) => [p.id, p]));

// Keyword -> categories. Keeps the prompt small: only the relevant slice of the catalogue is sent.
const CATEGORY_RULES: { words: RegExp; categories: string[] }[] = [
  { words: /wedding|occasion|party|event|evening|christening|races|ceremony|guest/i, categories: ["dresses", "jumpsuits", "skirts", "shoes", "accessories", "outerwear"] },
  { words: /dress/i, categories: ["dresses"] },
  { words: /jumpsuit/i, categories: ["jumpsuits"] },
  { words: /shoe|sandal|heel|trainer|wedge/i, categories: ["shoes"] },
  { words: /jacket|coat|blazer|cardigan|layer/i, categories: ["outerwear"] },
  { words: /top|shirt|blouse|cami|tee/i, categories: ["tops"] },
  { words: /skirt/i, categories: ["skirts"] },
  { words: /trouser|pants/i, categories: ["trousers"] },
  { words: /hat|bag|clutch|earring|scarf|accessor/i, categories: ["accessories"] },
];

export function catalogueFor(question: string): Product[] {
  const categories = new Set(CATEGORY_RULES.filter((r) => r.words.test(question)).flatMap((r) => r.categories));
  return categories.size ? products.filter((p) => categories.has(p.category)) : products;
}
