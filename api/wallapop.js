// api/wallapop.js — Precios de cartas de fútbol en Wallapop España
// Usa la API interna de Wallapop (no requiere credenciales)

const BAD = /camiseta|jersey|poster|póster|cuadro|álbum vacio|cromos sueltos|lote|figur|mug|taza|funda|sleeve|display|caja vacia|panini album/i;
const GRADED = /psa\s*\d|bgs\s*\d|cgc\s*\d|beckett/i;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if(req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if(!q?.trim()) return res.status(400).json({ results: [] });

  try {
    // API interna de Wallapop — búsqueda nacional (Madrid como centro, radio máximo)
    const params = new URLSearchParams({
      keywords:   q.trim(),
      latitude:   "40.4168",
      longitude:  "-3.7038",
      order_by:   "newest",
      distance:   "200000",  // 200km radio — cubre toda España
      language:   "es_ES",
    });

    const r = await fetch(
      `https://api.wallapop.com/api/v3/general/search?${params}`,
      {
        headers: {
          "Accept":          "application/json, text/plain, */*",
          "Accept-Language": "es-ES,es;q=0.9",
          "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          "Origin":          "https://es.wallapop.com",
          "Referer":         "https://es.wallapop.com/",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if(!r.ok) throw new Error(`Wallapop ${r.status}`);
    const data = await r.json();

    // La respuesta puede variar — intentamos dos estructuras conocidas
    const items =
      data?.search_objects ||
      data?.data?.section?.payload?.items ||
      data?.items ||
      [];

    const results = items
      .map(it => {
        // Precio — puede estar en distintas rutas según versión de API
        const price =
          it?.price?.amount ||
          it?.salePrice?.amount ||
          it?.price ||
          null;

        const priceEur = price ? parseFloat(price) : null;
        if(!priceEur || priceEur <= 0) return null;

        const title = it?.title || it?.name || "";
        if(BAD.test(title) || GRADED.test(title)) return null;
        if(priceEur < 1) return null; // filtrar artículos claramente erróneos

        const slug = it?.web_slug || it?.slug || "";
        return {
          title,
          priceEur,
          price: `${priceEur.toFixed(2)} €`,
          url: slug ? `https://es.wallapop.com/item/${slug}` : null,
          image: it?.images?.[0]?.urls?.medium ||
                 it?.main_image_url ||
                 it?.picture?.medium ||
                 null,
        };
      })
      .filter(Boolean);

    res.status(200).json({ results });
  } catch(e) {
    console.error("Wallapop error:", e.message);
    res.status(200).json({ results: [], error: e.message });
  }
}
