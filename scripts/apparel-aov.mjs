#!/usr/bin/env node
// Compute AOV (and a few related stats) for apparel orders in calendar 2025,
// pulling invoices straight from the Printavo GraphQL API.
//
// "Apparel" classification: an invoice counts as apparel if ANY of its line
// items has a description matching one of the keywords below. Tweak the list
// at the top of the file if it under/over-counts.
//
// Run with: npm run apparel-aov
//   (requires PRINTAVO_EMAIL and PRINTAVO_TOKEN in .env.local)

const ENDPOINT = "https://www.printavo.com/api/v2";

const APPAREL_KEYWORDS = [
  "shirt", "tee", "t-shirt", "tshirt", "hoodie", "hooded", "sweatshirt",
  "crewneck", "jersey", "polo", "tank", "long sleeve", "longsleeve",
  "uniform", "jacket", "windbreaker", "pullover", "quarter zip", "1/4 zip",
  "pants", "joggers", "shorts", "cap", "hat", "beanie", "visor",
  "socks", "apparel",
];

// Year window we're reporting on.
const YEAR = 2025;
const WINDOW_START = new Date(`${YEAR}-01-01T00:00:00Z`);
const WINDOW_END = new Date(`${YEAR}-12-31T23:59:59Z`);

// Statuses to count as "real" orders (filter out quotes from AOV).
const QUOTE_STATUSES = new Set(["Quote Sent", "Quote Requested"]);

const email = process.env.PRINTAVO_EMAIL;
const token = process.env.PRINTAVO_TOKEN;
if (!email || !token) {
  console.error("PRINTAVO_EMAIL and PRINTAVO_TOKEN must be set (in .env.local).");
  process.exit(1);
}

const INVOICES_QUERY = /* GraphQL */ `
  query Invoices($first: Int!, $after: String, $inProductionAfter: ISO8601DateTime) {
    invoices(
      first: $first
      after: $after
      inProductionAfter: $inProductionAfter
      sortOn: CUSTOMER_DUE_AT
      sortDescending: false
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        visualId
        nickname
        total
        createdAt
        status { name }
        lineItemGroups {
          nodes {
            lineItems { nodes { description items price } }
          }
        }
      }
    }
  }
`;

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      email,
      token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Printavo ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

function matchedKeyword(desc) {
  if (!desc) return null;
  const lower = desc.toLowerCase();
  for (const kw of APPAREL_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function lineItemsOf(inv) {
  const groups = inv.lineItemGroups?.nodes ?? [];
  return groups.flatMap((g) => g?.lineItems?.nodes ?? []);
}

async function main() {
  let cursor = null;
  let pages = 0;
  let totalScanned = 0;
  let inWindow = 0;
  let apparelOrders = 0;
  let apparelRevenue = 0;
  let nonApparelOrders = 0;
  let nonApparelRevenue = 0;
  const matchedSamples = [];
  const unmatchedSamples = [];
  const matchedKeywordCounts = new Map();

  // Pull ~14 months back so we definitely include all of 2025.
  const since = new Date(WINDOW_START);
  since.setMonth(since.getMonth() - 2);

  while (true) {
    pages++;
    const data = await gql(INVOICES_QUERY, {
      first: 50,
      after: cursor,
      inProductionAfter: since.toISOString(),
    });
    const page = data.invoices;
    for (const inv of page.nodes) {
      totalScanned++;
      const createdAt = inv.createdAt ? new Date(inv.createdAt) : null;
      if (!createdAt || createdAt < WINDOW_START || createdAt > WINDOW_END) {
        continue;
      }
      if (inv.status?.name && QUOTE_STATUSES.has(inv.status.name)) {
        continue;
      }
      inWindow++;
      const items = lineItemsOf(inv);
      let matchedAny = false;
      for (const li of items) {
        const kw = matchedKeyword(li?.description);
        if (kw) {
          matchedAny = true;
          matchedKeywordCounts.set(kw, (matchedKeywordCounts.get(kw) ?? 0) + 1);
          if (matchedSamples.length < 10) {
            matchedSamples.push({ visualId: inv.visualId, desc: li.description, kw });
          }
        } else if (li?.description && unmatchedSamples.length < 10) {
          unmatchedSamples.push({ visualId: inv.visualId, desc: li.description });
        }
      }
      const total = Number(inv.total ?? 0);
      if (matchedAny) {
        apparelOrders++;
        apparelRevenue += total;
      } else {
        nonApparelOrders++;
        nonApparelRevenue += total;
      }
    }
    process.stdout.write(`  ...page ${pages} (${totalScanned} scanned, ${inWindow} in ${YEAR})\r`);
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  console.log("\n");
  const fmt = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const aov = (rev, count) => (count > 0 ? rev / count : 0);

  console.log(`Calendar ${YEAR} — invoices (excluding quote statuses)`);
  console.log("─".repeat(60));
  console.log(`In-window invoices:     ${inWindow}`);
  console.log(`Apparel orders:         ${apparelOrders}`);
  console.log(`  Revenue:              ${fmt(apparelRevenue)}`);
  console.log(`  AOV:                  ${fmt(aov(apparelRevenue, apparelOrders))}`);
  console.log(`Non-apparel orders:     ${nonApparelOrders}`);
  console.log(`  Revenue:              ${fmt(nonApparelRevenue)}`);
  console.log(`  AOV:                  ${fmt(aov(nonApparelRevenue, nonApparelOrders))}`);
  console.log(`All orders AOV:         ${fmt(aov(apparelRevenue + nonApparelRevenue, apparelOrders + nonApparelOrders))}`);

  console.log("\nTop matched keywords (line-item hits):");
  const sorted = [...matchedKeywordCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [kw, n] of sorted.slice(0, 12)) {
    console.log(`  ${kw.padEnd(16)} ${n}`);
  }

  console.log("\nSample matched line items (first 10):");
  for (const s of matchedSamples) {
    console.log(`  #${s.visualId ?? "?"}  [${s.kw}]  ${s.desc}`);
  }

  if (apparelOrders > 0 && unmatchedSamples.length > 0) {
    console.log("\nSample UN-matched line items (sanity-check the keyword list):");
    for (const s of unmatchedSamples) {
      console.log(`  #${s.visualId ?? "?"}  ${s.desc}`);
    }
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
