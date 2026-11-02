# Customer-aware shopping assistant (prototype)

The prototype from the workshop case study on the Agentic Commerce Consultant application
(Accenture Song). One screen, one shopper question, two AI assistants side by side:

- **Catalogue only**: answers from the product catalogue, like most shopping agents today.
- **Knows the customer**: same question, plus the shopper's Klaviyo-style profile and event
  history. Shows "why" chips naming the customer facts it used.

The retailer, **Ondine & Vale**, is fictional. All products and customers are synthetic.

## Run it

```bash
# Run from ~/Projects/agentic-commerce-prototype
cd ~/Projects/agentic-commerce-prototype && npm install && npm run dev
```

Open http://localhost:3000.

**Two modes**, shown in the top-right badge:

- **Scripted demo** (no `ANTHROPIC_API_KEY` set): fixed answers for the default wedding
  question. No API calls, no cost, always the same. Other questions get the same answers.
- **Live · Claude**: set the key and every Ask makes two parallel calls to Claude
  (`claude-opus-5-5`, low effort, structured JSON output).

```bash
# Run from ~/Projects/agentic-commerce-prototype
cd ~/Projects/agentic-commerce-prototype && cp .env.local.example .env.local
```

Then put your key in `.env.local` and restart `npm run dev`.

## How it works

- `data/products.json`: 40 products (id, name, category, price, was_price, sizes, colours,
  length/fit, tags, on_sale, new_arrival).
- `data/customers.json`: 3 customers shaped like Klaviyo data. Profile properties (size,
  location, consent) and events (Placed Order, Refunded Order with reason, Viewed Product,
  Opened Email, Clicked Email) with dates.
- `lib/data.ts`: filters the catalogue by category from keywords in the question before
  anything is sent to the model (a wedding question sends dresses, jumpsuits, skirts,
  shoes, accessories and outerwear).
- `lib/assistant.ts`: the two prompts and the Claude call. The model returns
  `{ recommendation, products: [ids], facts_used: [strings] }`. Product ids not in the
  catalogue are dropped. Server-side refusal fallback (`fallbacks: "default"`) is on.
- `app/api/recommend/route.ts`: one route, two calls in parallel. With the anonymous
  visitor or consent off, the right panel reuses the catalogue-only answer and says why.
- `app/page.tsx`: the single screen. Changing the shopper or consent re-runs the question.

No database, no vector store.

## The three customers

| Customer | Who they are | What changes the wedding answer |
|---|---|---|
| Priya | Frequent returner for fit | Size 12, 5'10". Returned three dresses as "Too short", kept a Tall midi, viewed a maxi. Gets maxi and Tall-fit pieces instead of minis. |
| Charlotte | Loyal high spender | Gold tier, £255 average order, buys new arrivals, clicked the Aurelia in the "New In: Occasion" email. Gets premium new-in pieces. |
| Jess | Lapsed, sale-only buyer | Size 14. Last order January 2026, every order discounted, clicks sale emails, just viewed a sale dress. Gets sale pieces with the was/now price. |

## Demo script (30 to 45 seconds)

1. **(0 to 8s)** Start on **Anonymous visitor** with the default question, *"I need something to
   wear to a wedding in June"*. "This is what shopping agents do today: both sides give
   the same catalogue answer. A satin mini, a midi, sandals."
2. **(8 to 22s)** Click **Priya**. Point at the profile strip: three dresses returned as
   "Too short", she's 5'10". Then point at the right panel: "The assistant that knows her
   skips the minis and goes for Tall and maxi lengths in her size." Point at the **why
   chips**. "The left side still recommends the satin mini she already sent back."
3. **(22 to 32s)** Click **Jess**. "Lapsed nine months, only ever buys on sale. The
   assistant leads with the dress she just viewed, now £69, with the was/now price."
4. **(32 to 42s)** Turn **Personalisation consent** off. "No consent, no customer data. It
   falls back to the catalogue answer and says so." Close: "The brand already holds this
   data. It just isn't reaching the agent."

In live mode the wording changes on every run, so do a rehearsal run first.

## Deploy to Vercel

Import the repo in Vercel. No settings beyond the defaults. To run live, add
`ANTHROPIC_API_KEY` as an environment variable. Leave it unset to deploy the scripted demo.

**Cost and exposure:** live mode is a public page that spends your API credit on every
Ask (two Claude Opus 5.5 calls, roughly 4 to 5 thousand input tokens each, so a few pence
per Ask). For a link you share in an application, either deploy the scripted demo or set
a monthly spend limit on the Anthropic Console before adding the key. The API route has
`maxDuration = 60`, within the Vercel Hobby limit.
