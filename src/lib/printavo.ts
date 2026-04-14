// Printavo GraphQL API v2 client.
// Auth: email + token headers.

const ENDPOINT = "https://www.printavo.com/api/v2";

export type PrintavoLineItem = {
  description?: string | null;
  items?: number | null; // quantity
  price?: number | null;
};

export type PrintavoInvoice = {
  id: string;
  visualId?: string | null;
  nickname?: string | null;
  total?: number | null;
  dueAt?: string | null;
  customerDueAt?: string | null;
  createdAt?: string | null;
  status?: { id?: string | null; name?: string | null } | null;
  tags?: string[] | null;
  contact?: {
    id?: string | null;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    customer?: {
      id?: string | null;
      companyName?: string | null;
    } | null;
  } | null;
  lineItemGroups?: {
    nodes?: Array<{
      id?: string | null;
      lineItems?: { nodes?: PrintavoLineItem[] | null } | null;
    }> | null;
  } | null;
};

export type PrintavoPage<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

function getCreds(): { email: string; token: string } {
  const email = process.env.PRINTAVO_EMAIL;
  const token = process.env.PRINTAVO_TOKEN;
  if (!email || !token) {
    throw new Error(
      "PRINTAVO_EMAIL and PRINTAVO_TOKEN must be set in the environment",
    );
  }
  return { email, token };
}

export async function printavoGql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { email, token } = getCreds();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      email,
      token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Printavo ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(
      `Printavo GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!json.data) {
    throw new Error("Printavo returned no data");
  }
  return json.data;
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
        dueAt
        customerDueAt
        createdAt
        status { id name }
        tags
        contact {
          id
          email
          phone
          fullName
          customer { id companyName }
        }
        lineItemGroups {
          nodes {
            id
            lineItems {
              nodes { description items price }
            }
          }
        }
      }
    }
  }
`;

export async function fetchInvoicesPage(
  after: string | null,
  since: Date,
): Promise<PrintavoPage<PrintavoInvoice>> {
  const data = await printavoGql<{ invoices: PrintavoPage<PrintavoInvoice> }>(
    INVOICES_QUERY,
    {
      first: 50,
      after,
      inProductionAfter: since.toISOString(),
    },
  );
  return data.invoices;
}

export async function* iterateInvoicesSince(
  since: Date,
): AsyncGenerator<PrintavoInvoice> {
  let cursor: string | null = null;
  for (;;) {
    const page = await fetchInvoicesPage(cursor, since);
    for (const n of page.nodes) yield n;
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) return;
    cursor = page.pageInfo.endCursor;
  }
}
