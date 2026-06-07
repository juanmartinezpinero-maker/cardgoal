// api/ebay-sold.js — Vercel serverless function
// Busca ventas CERRADAS (sold) en eBay usando Finding API findCompletedItems
// Devuelve precios reales de lo que se ha vendido, no anuncios activos

const GRADED = /\bpsa\s*\d|\bbgs\s*\d|\bcgc\s*\d|\bsgc\s*\d|beckett\s*\d|\bslabbed\b/i;
const BAD    = /camiseta|t-?shirt|signed|firmad|enmarcad|framed|poster|funda|sleeve|figur|mug|botas|bufanda/i;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ results: [] });

  const APP_ID = process.env.EBAY_CLIENT_ID;
  if (!APP_ID) return res.status(500).json({ error: "Missing EBAY_CLIENT_ID", results: [] });

  // Finding API — findCompletedItems (no requiere OAuth, solo AppID)
  const params = new URLSearchParams({
    "OPERATION-NAME":        "findCompletedItems",
    "SERVICE-VERSION":       "1.0.0",
    "SECURITY-APPNAME":      APP_ID,
    "RESPONSE-DATA-FORMAT":  "JSON",
    "keywords":              q.trim(),
    "paginationInput.entriesPerPage": "20",
    "sortOrder":             "EndTimeSoonest",
    "itemFilter(0).name":    "SoldItemsOnly",
    "itemFilter(0).value":   "true",
    "outputSelector(0)":     "GalleryInfo",
  });

  try {
    const r = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params}`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`eBay ${r.status}`);
    const data = await r.json();

    const raw = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    const results = raw
      .filter(it => {
        // Solo ventas reales (no artículos que terminaron sin vender)
        const state = it?.sellingStatus?.[0]?.sellingState?.[0]?.["__value__"]
                   || it?.sellingStatus?.[0]?.sellingState?.[0]
                   || "";
        return state === "EndedWithSales";
      })
      .map(it => {
        const priceObj = it?.sellingStatus?.[0]?.currentPrice?.[0] || {};
        const cur  = priceObj["@currencyId"] || "EUR";
        const val  = parseFloat(priceObj["__value__"] || "0");
        if (!val || val <= 0) return null;

        // Convertir a EUR
        const mult = cur === "USD" ? 0.92 : cur === "GBP" ? 1.17 : 1;
        const priceEur = Math.round(val * mult * 100) / 100;

        const title    = it?.title?.[0] || "";
        const endTime  = it?.listingInfo?.[0]?.endTime?.[0] || null;
        const image    = it?.galleryInfoContainer?.[0]?.galleryURL?.[0]
                      || it?.galleryURL?.[0]
                      || null;

        return { title, priceEur, endTime, image, url: it?.viewItemURL?.[0] || null };
      })
      .filter(it => {
        if (!it || !it.priceEur || it.priceEur <= 0) return false;
        if (GRADED.test(it.title)) return false;   // excluir PSA/BGS/CGC gradeadas
        if (BAD.test(it.title))    return false;   // excluir camisetas, etc.
        return true;
      });

    res.status(200).json({ results });
  } catch (e) {
    console.error("ebay-sold error:", e.message);
    res.status(200).json({ results: [], error: e.message });
  }
}
