# Customer-aware shopping assistant (prototype)

The prototype from the workshop case study on the Agentic Commerce Consultant application
(Accenture Song). One screen, two AI shopping assistants, each in its own chat. Both get
the same opening message, then you reply to each as the shopper:

- **Catalogue only**: knows nothing about the shopper, so like a good sales assistant it
  asks first (dress code, size, budget, fit) before recommending.
- **Knows the customer**: also has the shopper's Klaviyo-style profile and history. It
  opens by saying it will look at their past orders, skips what it already knows, and
  asks only what the data can't answer. "Why" chips show the customer facts it used.

A counter on each side shows how many questions it had to ask.

The retailer, **Ondine & Vale**, is fictional. All products and customers are synthetic.

## Run it

```bash
# Run from ~/Projects/agentic-commerce-prototype
cd ~/Projects/agentic-commerce-prototype && npm install && npm run dev
```

Open http://localhost:3000.

It needs an Anthropic API key. Put it in `.env.local` (git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Each message is one call to Claude (`claude-opus-5-5`, low effort, structured JSON output)
and takes about 5 to 10 seconds. Without a key, the page shows an error.

## How it works

- `data/products.json`: 40 products (id, name, category, price, was_price, sizes, colours,
  length/fit, tags, on_sale, new_arrival).
- `data/customers.json`: 3 customers shaped like Klaviyo data. Profile properties (size,
  location, consent) and events (Placed Order, Refunded Order with reason, Viewed Product,
  Opened Email, Clicked Email) with dates.
- `lib/data.ts`: filters the catalogue by category from keywords in the question before
  anything is sent to the model (a wedding question sends dresses, jumpsuits, skirts,
  shoes, accessories and outerwear).
- `lib/assistant.ts`: the two prompts and the Claude call. Each turn the model returns
  `{ kind: question | recommendation, message, products: [ids], facts_used: [strings] }`. Product ids not in the
  catalogue are dropped. Server-side refusal fallback (`fallbacks: "default"`) is on.
- `app/api/chat/route.ts`: one route, called once per message per side. With the
  anonymous visitor or consent off, the right side gets no customer data and says why.
- `app/page.tsx`: the single screen. Nothing runs until you press Ask both. Changing the
  shopper or consent clears both chats.

No database, no vector store.

## The three customers

| Customer | Who they are | What changes the wedding answer |
|---|---|---|
| Priya | Frequent returner for fit | Size 12, 5'10". Returned three dresses as "Too short", kept a Tall midi, viewed a maxi. Gets maxi and Tall-fit pieces instead of minis. |
| Charlotte | Loyal high spender | Gold tier, £255 average order, buys new arrivals, clicked the Aurelia in the "New In: Occasion" email. Gets premium new-in pieces. |
| Jess | Lapsed, sale-only buyer | Size 14. Last order January 2026, every order discounted, clicks sale emails, just viewed a sale dress. Gets sale pieces with the was/now price. |

## Demo script (45 to 60 seconds)

Answers are generated live, so the wording changes each run. Rehearse once first.

1. **Pick Priya** and point at the profile strip: three dresses returned as "Too short",
   she's 5'10".
2. **Press Ask both** with *"I need something to wear to a wedding in June"*.
   - Left: "It doesn't know her, so it asks her size."
   - Right: "It says it's checking her past orders, already knows length matters, and
     only asks the dress code." Point at the why chips.
3. **Reply on the right**: *"Daytime garden wedding, smart but not black tie"*. It
   recommends Tall and maxi lengths in her size straight away.
4. **Point at the counters.** "The left side still needs her size, budget and fit, which
   the brand already knew."
5. **Close**: turn consent off. "No consent, no customer data: it's back to asking."

## Deploy to Vercel

The repo is connected to a Vercel project, and every push to `main` redeploys it. Add
`ANTHROPIC_API_KEY` in the project's environment variables (Production).

**Cost and exposure:** live mode is a public page that spends your API credit on every
Ask (two Claude Opus 5.5 calls, roughly 4 to 5 thousand input tokens each, so a few pence
per Ask). Keep the key in its own Anthropic workspace with a monthly spend limit. The API route has
`maxDuration = 60`, within the Vercel Hobby limit.
