const email = process.env.PRINTAVO_EMAIL;
const token = process.env.PRINTAVO_TOKEN;
if (!email || !token) {
  console.error("Set PRINTAVO_EMAIL and PRINTAVO_TOKEN in .env.local");
  process.exit(1);
}

const query = `{
  queryFields: __schema {
    queryType {
      fields {
        name
        args { name type { name kind ofType { name kind ofType { name kind } } } }
      }
    }
  }
  Invoice: __type(name: "Invoice") {
    fields {
      name
      type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }
    }
  }
  Order: __type(name: "Order") {
    fields { name type { name kind ofType { name kind } } }
  }
  OrderSortField: __type(name: "OrderSortField") { enumValues { name } }
  InvoiceSortField: __type(name: "InvoiceSortField") { enumValues { name } }
  Contact: __type(name: "Contact") {
    fields { name type { name kind ofType { name kind } } }
  }
  LineItemGroup: __type(name: "LineItemGroup") {
    fields { name type { name kind ofType { name kind } } }
  }
  LineItem: __type(name: "LineItem") {
    fields { name type { name kind ofType { name kind } } }
  }
}`;

const res = await fetch("https://www.printavo.com/api/v2", {
  method: "POST",
  headers: { "content-type": "application/json", email, token },
  body: JSON.stringify({ query }),
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
