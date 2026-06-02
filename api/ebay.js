// /api/ebay.js
// Función intermediaria para CardGoal que consulta la API de eBay.
// Las claves NUNCA van escritas aquí: se leen de las variables de entorno de Vercel.
//   EBAY_CLIENT_ID   -> tu App ID  (JUANMART-cardgoal-PRD-...)
//   EBAY_CLIENT_SECRET -> tu Cert ID (PRD-...)

// Cache del token en memoria para no pedirlo en cada búsqueda
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  // Si tenemos un token válido aún, lo reutilizamos
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Faltan las claves de eBay en Vercel");

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Error al pedir token a eBay: ${res.status} ${t}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Caduca un poco antes del tiempo real, por seguridad
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  // Permitir que la app (cardgoal.es) llame a esta función
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Falta el parámetro de búsqueda (q)" });

  try {
    const token = await getToken();

    const url =
      "https://api.ebay.com/buy/browse/v1/item_summary/search?" +
      `q=${encodeURIComponent(q)}&limit=8`;

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Mercado España. Cambia a EBAY_US para mercado internacional.
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_ES",
      },
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: `eBay devolvió error: ${r.status}`, detail: t });
    }

    const data = await r.json();
    const items = (data.itemSummaries || []).map((it) => ({
      title: it.title,
      image: it.image?.imageUrl || it.thumbnailImages?.[0]?.imageUrl || null,
      price: it.price?.value ? Number(it.price.value) : null,
      currency: it.price?.currency || "EUR",
      condition: it.condition || null,
      url: it.itemWebUrl || null,
    }));

    // El primer resultado con foto suele ser el mejor para mostrar el cromo
    const best = items.find((i) => i.image) || items[0] || null;

    return res.status(200).json({ query: q, best, results: items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
