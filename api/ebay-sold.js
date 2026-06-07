// api/ebay-sold.js — Ventas cerradas de eBay
// Intenta Finding API primero, si falla usa Browse API como fallback

const GRADED = /\bpsa\s*\d|\bbgs\s*\d|\bcgc\s*\d|\bsgc\s*\d|beckett\s*\d|\bslabbed\b/i;
const BAD    = /camiseta|t-?shirt|signed photo|poster|funda|sleeve|figura|mug|botas|bufanda/i;

function toEur(val, cur) {
  const mult = cur === "USD" ? 0.92 : cur === "GBP" ? 1.17 : 1;
  return Math.round(val * mult * 100) / 100;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if(req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if(!q?.trim()) return res.status(400).json({ results: [] });

  const APP_ID = process.env.EBAY_CLIENT_ID;
  const SECRET = process.env.EBAY_CLIENT_SECRET;

  // ── INTENTO 1: Finding API (findCompletedItems) ──
  try {
    const params = new URLSearchParams({
      "OPERATION-NAME":       "findCompletedItems",
      "SERVICE-VERSION":      "1.0.0",
      "SECURITY-APPNAME":     APP_ID,
      "RESPONSE-DATA-FORMAT": "JSON",
      "keywords":             q.trim(),
      "paginationInput.entriesPerPage": "20",
      "sortOrder":            "EndTimeSoonest",
      "itemFilter(0).name":   "SoldItemsOnly",
      "itemFilter(0).value":  "true",
    });

    const r = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params}`,
      { signal: AbortSignal.timeout(7000) }
    );

    if(r.ok) {
      const data = await r.json();
      const raw = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
      const results = raw
        .filter(it => (it?.sellingStatus?.[0]?.sellingState?.[0]?.["__value__"] || "") === "EndedWithSales")
        .map(it => {
          const po = it?.sellingStatus?.[0]?.currentPrice?.[0] || {};
          const val = parseFloat(po["__value__"] || "0");
          if(!val) return null;
          const title = it?.title?.[0] || "";
          if(GRADED.test(title) || BAD.test(title)) return null;
          return { title, priceEur: toEur(val, po["@currencyId"]||"EUR"), endTime: it?.listingInfo?.[0]?.endTime?.[0]||null };
        }).filter(Boolean);
      if(results.length > 0) return res.status(200).json({ results, source:"finding-api" });
    }
  } catch(e) { console.log("Finding API:", e.message); }

  // ── INTENTO 2: Browse API con OAuth (la que ya funciona en /api/ebay) ──
  try {
    const tr = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded",
        "Authorization":"Basic " + Buffer.from(`${APP_ID}:${SECRET}`).toString("base64"),
      },
      body:"grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });
    if(!tr.ok) throw new Error("token failed");
    const { access_token } = await tr.json();

    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q.trim())}&limit=20&filter=categoryIds:{212}`;
    const r = await fetch(url, {
      headers:{ "Authorization":`Bearer ${access_token}`, "X-EBAY-C-MARKETPLACE-ID":"EBAY_US" }
    });
    if(!r.ok) throw new Error(`browse ${r.status}`);
    const data = await r.json();
    const results = (data.itemSummaries||[])
      .filter(it => !GRADED.test(it.title||"") && !BAD.test(it.title||""))
      .map(it => {
        const val = parseFloat(it.price?.value||"0");
        if(!val) return null;
        return { title:it.title, priceEur:toEur(val, it.price?.currency||"USD"), endTime:null };
      }).filter(Boolean);
    return res.status(200).json({ results, source:"browse-api" });
  } catch(e) { console.error("Browse API:", e.message); }

  return res.status(200).json({ results:[], error:"all-failed" });
}
