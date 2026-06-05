// /api/welcome.js
// Envía el email de bienvenida cuando un usuario se registra.
// La clave de Resend va en Vercel como variable de entorno: RESEND_API_KEY
// Cambia el remitente "from" si prefieres no-reply@cardgoal.es

const FROM = "CardGoal <hola@cardgoal.es>";
const SITE = "https://cardgoal.es";

function welcomeHtml() {
  return `
  <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
      <div style="background:#0D1525;border-radius:18px 18px 0 0;padding:28px 24px;text-align:center;">
        <div style="font-size:30px;">⚽</div>
        <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-top:6px;">CardGoal</div>
      </div>

      <div style="background:#ffffff;border-radius:0 0 18px 18px;padding:28px 24px;color:#1a2035;">
        <h1 style="font-size:20px;margin:0 0 12px;">¡Bienvenido a CardGoal! 🎉</h1>
        <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 18px;">
          Gracias por unirte. CardGoal te ayuda a saber lo que valen tus cromos de fútbol y a llevar el control de tu colección. Esto es lo que puedes hacer:
        </p>

        <div style="margin:0 0 14px;padding:14px 16px;background:#f4f6f8;border-radius:12px;">
          <div style="font-weight:700;font-size:15px;">🔍 Buscar cualquier cromo</div>
          <div style="font-size:13px;color:#666;margin-top:3px;line-height:1.5;">Encuentra un jugador y mira su precio de mercado estimado.</div>
        </div>
        <div style="margin:0 0 14px;padding:14px 16px;background:#f4f6f8;border-radius:12px;">
          <div style="font-weight:700;font-size:15px;">📷 Escanear con la cámara</div>
          <div style="font-size:13px;color:#666;margin-top:3px;line-height:1.5;">Haz una foto a tu cromo y la IA lo identifica y lo valora.</div>
        </div>
        <div style="margin:0 0 14px;padding:14px 16px;background:#f4f6f8;border-radius:12px;">
          <div style="font-weight:700;font-size:15px;">📁 Guardar tu colección</div>
          <div style="font-size:13px;color:#666;margin-top:3px;line-height:1.5;">Añade tus cartas y consulta el valor total de todo lo que tienes.</div>
        </div>
        <div style="margin:0 0 22px;padding:14px 16px;background:#f4f6f8;border-radius:12px;">
          <div style="font-weight:700;font-size:15px;">📈 Seguir su valor</div>
          <div style="font-size:13px;color:#666;margin-top:3px;line-height:1.5;">El valor se actualiza según se revalorizan tus cromos.</div>
        </div>

        <div style="text-align:center;margin:0 0 18px;">
          <a href="${SITE}" style="display:inline-block;background:#05C168;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 28px;border-radius:12px;">Empezar ahora</a>
        </div>

        <p style="font-size:13px;line-height:1.6;color:#888;margin:0;text-align:center;">
          Consejo: añade CardGoal a tu pantalla de inicio para tenerlo siempre a mano, como una app. 📲
        </p>
      </div>

      <div style="text-align:center;padding:18px 0;color:#aaa;font-size:11px;">
        CardGoal · ${SITE}
      </div>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Lee el email: por POST (registro real) o por GET ?test=email (prueba rápida)
  let email = "";
  if (req.method === "GET") {
    email = req.query && req.query.test ? String(req.query.test).trim() : "";
    if (!email) return res.status(405).json({ error: "Usa ?test=tu@email.com para enviar un correo de prueba" });
  } else if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      email = (body.email || "").trim();
    } catch { /* ignore */ }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: "Falta RESEND_API_KEY en Vercel" });
  if (!email) return res.status(400).json({ error: "Falta el email" });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "¡Bienvenido a CardGoal! ⚽",
        html: welcomeHtml(),
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Resend error", detail: data });
    return res.status(200).json({ ok: true, id: data.id, sent_to: email });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
