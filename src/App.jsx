import { useState, useRef, useCallback, useEffect } from "react";

/* ─── DESIGN SYSTEM — Matchapp Style ────────────────────────
   Dark background, electric green accent, white text.
   Bold typography. Clean and sporty.
──────────────────────────────────────────────────────────────── */
const C = {
  bg:      "#0D0F14",      // near black — main background
  bg2:     "#13161E",      // slightly lighter dark
  bg3:     "#1A1D26",      // card background
  border:  "#252836",      // subtle dark border
  borderL: "#2E3347",      // lighter border
  accent:  "#00E676",      // electric green — Matchapp style
  accentL: "rgba(0,230,118,0.12)",
  accentD: "#00C853",
  blue:    "#4A9EFF",
  blueL:   "rgba(74,158,255,0.12)",
  red:     "#FF5252",
  redL:    "rgba(255,82,82,0.12)",
  gold:    "#FFD740",
  goldL:   "rgba(255,215,64,0.12)",
  white:   "#FFFFFF",
  text:    "#FFFFFF",
  sub:     "#8B92A5",
  hint:    "#555D72",
  // Shadows
  shadow:  "0 2px 12px rgba(0,0,0,0.4)",
  shadowM: "0 8px 32px rgba(0,0,0,0.5)",
  shadowL: "0 16px 64px rgba(0,0,0,0.6)",
};
const FD = "'Syne','Arial Black',sans-serif";
const FB = "'Inter','DM Sans','Segoe UI',sans-serif";

/* ─── SUPABASE ────────────────────────────────────────────── */
const SUPA_URL = "https://pmdeezqpaphdmlnbjczg.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZGVlenFwYXBoZG1sbmJqY3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODg2MjEsImV4cCI6MjA5NTU2NDYyMX0.wNLPCwqTZkR4HJ_BexPNOHtxaokoGNQTubFGrRMeOuo";

const supa = {
  headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${SUPA_KEY}` },

  async signUp(email, password, meta) {
    const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method:"POST", headers:this.headers,
      body: JSON.stringify({email, password, data: meta||{}})
    });
    return r.json();
  },

  // Histórico de precios: guarda una "foto" del precio real de un cromo
  async saveSnapshot(cardKey, priceEur, source) {
    try {
      await fetch(`${SUPA_URL}/rest/v1/price_snapshots`, {
        method:"POST", headers:this.headers,
        body: JSON.stringify({ card_key: cardKey, price_eur: priceEur, source: source||null })
      });
    } catch {}
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method:"POST", headers:this.headers,
      body: JSON.stringify({email, password})
    });
    return r.json();
  },

  async signOut(token) {
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method:"POST",
      headers:{...this.headers, "Authorization":`Bearer ${token}`}
    });
  },

  async getUser(token) {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers:{...this.headers, "Authorization":`Bearer ${token}`}
    });
    return r.json();
  },

  async saveCard(card, token, userId) {
    const r = await fetch(`${SUPA_URL}/rest/v1/collections`, {
      method:"POST",
      headers:{...this.headers, "Authorization":`Bearer ${token}`, "Prefer":"return=representation"},
      body: JSON.stringify({
        user_id: userId,
        player: card.player, team: card.team, season: card.season,
        manufacturer: card.manufacturer, collection: card.collection,
        card_number: card.cardNumber, rarity: card.rarity,
        condition: card.condition, price_eur: card.priceEur,
        price_min: card.priceMin, price_prem: card.pricePrem,
        price_source: card.priceSource, change_week: card.changeWeek,
        change_month: card.changeMonth, scanned: card.scanned||false,
        image: card._thumb || card._ebayImg || null,
        ebay_title: card._ebayTitle || null,
      })
    });
    return r.json();
  },

  async loadCards(token) {
    const r = await fetch(`${SUPA_URL}/rest/v1/collections?select=*&order=created_at.desc`, {
      headers:{...this.headers, "Authorization":`Bearer ${token}`}
    });
    return r.json();
  },

  async deleteCard(id, token) {
    await fetch(`${SUPA_URL}/rest/v1/collections?id=eq.${id}`, {
      method:"DELETE",
      headers:{...this.headers, "Authorization":`Bearer ${token}`}
    });
  },

  // Tracking de comportamiento — fire and forget, nunca bloquea la UI
  trackEvent(userId, token, event) {
    if(!userId || !token || !event?.type) return;
    fetch(`${SUPA_URL}/rest/v1/card_events`, {
      method:"POST",
      headers:{...this.headers, "Authorization":`Bearer ${token}`},
      body: JSON.stringify({
        user_id:        userId,
        event_type:     event.type,
        player:         event.player         || null,
        manufacturer:   event.manufacturer   || null,
        collection_name:event.collection     || null,
        rarity:         event.rarity         || null,
        price_eur:      event.priceEur       || null,
        search_query:   event.query          || null,
      })
    }).catch(()=>{}); // Silencioso — no afecta a la UX
  },

  // Guarda el precio de una carta en Supabase (persistente entre sesiones)
  async updateCardPrice(id, token, price) {
    if(!id || !token) return;
    await fetch(`${SUPA_URL}/rest/v1/collections?id=eq.${id}`, {
      method:"PATCH",
      headers:{...this.headers, "Authorization":`Bearer ${token}`, "Prefer":"return=minimal"},
      body: JSON.stringify({
        price_eur:   price.priceEur   || null,
        price_min:   price.priceMin   || null,
        price_prem:  price.pricePrem  || null,
        price_source: price.priceSource || null,
      })
    });
  },

  async refreshToken(refreshToken) {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:"POST",
      headers:this.headers,
      body: JSON.stringify({refresh_token: refreshToken})
    });
    return r.json();
  },

  async verifyToken(token) {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers:{...this.headers, "Authorization":`Bearer ${token}`}
    });
    return r.ok;
  }
};

/* ─── FREEMIUM ────────────────────────────────────────────── */
const LIMITS = { scans: 5, grades: 3, collection: 15 };

function getUsage(userId) {
  try {
    const key = `cg_usage_${userId}_${new Date().getMonth()}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : { scans:0, grades:0 };
  } catch { return { scans:0, grades:0 }; }
}

function saveUsage(userId, usage) {
  try {
    const key = `cg_usage_${userId}_${new Date().getMonth()}`;
    localStorage.setItem(key, JSON.stringify(usage));
  } catch {}
}

function canScan(userId, isPremium) {
  if(isPremium) return true;
  const u = getUsage(userId);
  return u.scans < LIMITS.scans;
}

function canGrade(userId, isPremium) {
  if(isPremium) return true;
  const u = getUsage(userId);
  return u.grades < LIMITS.grades;
}

function incrementScan(userId) {
  const u = getUsage(userId);
  saveUsage(userId, {...u, scans: u.scans + 1});
}

function incrementGrade(userId) {
  const u = getUsage(userId);
  saveUsage(userId, {...u, grades: u.grades + 1});
}

/* ─── PAYWALL MODAL ────────────────────────────────────────── */
function PaywallModal({type, onClose, lang}) {
  const isES = lang==="es";
  const info = {
    scan: {
      icon:"📷",
      title: isES?"Has usado tus 5 escaneos gratuitos":"You've used your 5 free scans",
      sub: isES?"Actualiza a Premium para escaneos ilimitados":"Upgrade to Premium for unlimited scans",
    },
    grade: {
      icon:"🔬",
      title: isES?"Has usado tus 3 análisis PSA gratuitos":"You've used your 3 free PSA analyses",
      sub: isES?"Actualiza a Premium para análisis ilimitados":"Upgrade to Premium for unlimited analyses",
    },
    collection: {
      icon:"🗂️",
      title: isES?"Límite de 50 cartas alcanzado":"50 card limit reached",
      sub: isES?"Actualiza a Premium para colección ilimitada":"Upgrade to Premium for unlimited collection",
    }
  };
  const i = info[type]||info.scan;

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:24,padding:"32px 24px",maxWidth:340,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:16}}>{i.icon}</div>
        <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:C.white,marginBottom:8,lineHeight:1.3}}>{i.title}</div>
        <div style={{fontSize:13,color:C.sub,marginBottom:24,lineHeight:1.6}}>{i.sub}</div>

        {/* Premium features */}
        <div style={{background:C.bg2,borderRadius:14,padding:"16px",marginBottom:24,textAlign:"left"}}>
          {[
            [isES?"Escaneos ilimitados":"Unlimited scans","📷"],
            [isES?"Análisis PSA ilimitados":"Unlimited PSA","🔬"],
            [isES?"Colección ilimitada":"Unlimited collection","🗂️"],
            [isES?"Precio real de eBay":"Real eBay price","💶"],
          ].map(([t,ic])=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:16}}>{ic}</span>
              <span style={{fontSize:13,color:C.white,fontWeight:500}}>{t}</span>
              <span style={{marginLeft:"auto",color:C.accent,fontSize:14}}>✓</span>
            </div>
          ))}
        </div>

        <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:C.accent,marginBottom:4}}>2,95€<span style={{fontSize:14,color:C.sub,fontWeight:400}}>/mes</span></div>
        <div style={{fontSize:11,color:C.hint,marginBottom:20}}>{isES?"Cancela cuando quieras":"Cancel anytime"}</div>

        <button onClick={()=>startCheckout(window._cgUserEmail||"")} style={{width:"100%",padding:"15px",background:C.accent,border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:C.bg,cursor:"pointer",marginBottom:10,boxShadow:`0 4px 16px ${C.accent}44`}}>
          {isES?"💳 Activar Premium — 2,95€/mes":"💳 Activate Premium — €2.95/mo"}
        </button>
        <button onClick={onClose} style={{width:"100%",padding:"12px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:14,fontFamily:FD,fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer"}}>
          {isES?"Ahora no":"Not now"}
        </button>
      </div>
    </div>
  );
}

/* ─── STRIPE ──────────────────────────────────────────────── */
const STRIPE_PK = "pk_test_51TcWZiCGqeJOlR1JLOOvKcpNeIa9ANXqInqgIHLIG09SAWFEXNx1t9mqwcPsr7YBh2VgUmtLlIXwtMFDbNVAPdro00fFpAhMl1";

function startCheckout(email) {
  // Direct Stripe Payment Link — no backend needed
  const url = "https://buy.stripe.com/test_28E7sK6iL9xjbFW2Hia3u00" + (email ? "?prefilled_email=" + encodeURIComponent(email) : "");
  window.open(url, "_blank");
}

/* ===== eBay afiliado (eBay Partner Network) ===== */
const EBAY_CAMPID = "5339155735";          // Campaign ID de CardGoal
const EBAY_MKRID  = "1185-53479-19255-0";  // Rotation ID de eBay España
function ebayAffiliate(url){
  if(!url) return url;
  try{
    const u = new URL(url);
    u.searchParams.set("mkevt","1");
    u.searchParams.set("mkcid","1");
    u.searchParams.set("mkrid",EBAY_MKRID);
    u.searchParams.set("campid",EBAY_CAMPID);
    u.searchParams.set("toolid","10001");
    return u.toString();
  }catch{
    const sep = url.includes("?")?"&":"?";
    return url+sep+"mkevt=1&mkcid=1&mkrid="+EBAY_MKRID+"&campid="+EBAY_CAMPID+"&toolid=10001";
  }
}
function ebayLinkFor(card){
  // Siempre construir URL de búsqueda (nunca anuncio concreto — pueden caducar y eBay muestra artículos aleatorios)
  const parts = [card?.player];
  if(card?.manufacturer && card.manufacturer!=="?") parts.push(card.manufacturer);
  if(card?.collection   && card.collection!=="?")   parts.push(card.collection);
  if(card?.rarity       && card.rarity!=="Base")    parts.push(card.rarity);
  if(card?.serialNumber && String(card.serialNumber)!=="null") parts.push(card.serialNumber);
  const q = parts.filter(Boolean).join(" ").trim() || "cromos fútbol";
  return ebayAffiliate("https://www.ebay.es/sch/i.html?_nkw="+encodeURIComponent(q));
}

async function checkPremium(email) {
  // For now returns false — will be updated when Stripe webhook is configured
  return false;
}

/* ─── HELPERS ─────────────────────────────────────────────── */
const eur = n => { const v=parseFloat(n); if(!isFinite(v)) return "—"; return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v); };
const num = v => { const n=parseFloat(v); return isFinite(n)?n:null; };
const toDataURL = f => new Promise((ok,ko) => { const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=ko; r.readAsDataURL(f); });

// Compress image to max 1MB before sending to Gemini
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      // Max 800px on longest side
      const max = 800;
      if(w > max || h > max) {
        if(w > h) { h = Math.round(h * max/w); w = max; }
        else { w = Math.round(w * max/h); h = max; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      // Compress to JPEG 0.7 quality
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      resolve(dataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
const sleep = ms => new Promise(r => setTimeout(r,ms));

function jparse(raw) {
  if (!raw) return null;
  const s = raw.replace(/```json|```/gi,"").trim();
  for (const c of [s,...(s.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/g)||[])]) {
    try { const p=JSON.parse(c); if(p!=null) return p; } catch {}
  }
  return null;
}

/* ─── AI ──────────────────────────────────────────────────── */
async function callAI(msgs, search=false, maxTok=800, model="claude-haiku-4-5-20251001") {
  const body = { model, max_tokens:maxTok, messages:msgs };
  if (search) body.tools = [{type:"web_search_20250305",name:"web_search"}];
  const r = await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if (!r.ok) { const e=await r.json().catch(()=>{}); throw new Error(e?.error?.message||`HTTP ${r.status}`); }
  const d = await r.json();
  return d.content?.filter(b=>b.type==="text").map(b=>b.text).join("\n")||"";
}

/* ─── SEARCH — fast, no web search needed ─────────────────── */
/* ─── LOCAL CARD CATALOG (instant search, no API) ─────────── */
const CATALOG = [
  // Bellingham
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:12,priceMin:8,pricePrem:18,changeWeek:5,changeMonth:12},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:280,priceMin:210,pricePrem:380,changeWeek:8,changeMonth:22},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Auto",priceEur:450,priceMin:320,pricePrem:650,changeWeek:12,changeMonth:30},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2022-23",manufacturer:"Topps",collection:"Chrome",rarity:"Rookie",priceEur:35,priceMin:25,pricePrem:55,changeWeek:3,changeMonth:8},
  // Yamal
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:95,priceMin:70,pricePrem:130,changeWeek:15,changeMonth:45},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:4,priceMin:2,pricePrem:8,changeWeek:10,changeMonth:35},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:1200,priceMin:900,pricePrem:1600,changeWeek:20,changeMonth:60},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Rookie",priceEur:45,priceMin:32,pricePrem:65,changeWeek:12,changeMonth:38},
  // Mbappé
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:6,changeMonth:15},
  {player:"Kylian Mbappé",team:"PSG",season:"2022-23",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:850,priceMin:600,pricePrem:1100,changeWeek:4,changeMonth:10},
  {player:"Kylian Mbappé",team:"PSG",season:"2021-22",manufacturer:"Panini",collection:"Select",rarity:"Auto",priceEur:320,priceMin:240,pricePrem:450,changeWeek:3,changeMonth:8},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:5,changeMonth:12},
  // Haaland
  {player:"Erling Haaland",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:15,priceMin:10,pricePrem:22,changeWeek:4,changeMonth:8},
  {player:"Erling Haaland",team:"Manchester City",season:"2022-23",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:65,priceMin:45,pricePrem:90,changeWeek:6,changeMonth:18},
  {player:"Erling Haaland",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Auto",priceEur:380,priceMin:280,pricePrem:520,changeWeek:8,changeMonth:20},
  {player:"Erling Haaland",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:5,priceMin:3,pricePrem:9,changeWeek:3,changeMonth:7},
  // Pedri
  {player:"Pedri",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:8,priceMin:5,pricePrem:14,changeWeek:3,changeMonth:6},
  {player:"Pedri",team:"FC Barcelona",season:"2021-22",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:28,priceMin:20,pricePrem:42,changeWeek:2,changeMonth:5},
  {player:"Pedri",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:2,changeMonth:4},
  // Vinicius
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:14,priceMin:9,pricePrem:21,changeWeek:5,changeMonth:14},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Silver",priceEur:35,priceMin:25,pricePrem:50,changeWeek:6,changeMonth:16},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2022-23",manufacturer:"Panini",collection:"Select",rarity:"Auto",priceEur:290,priceMin:210,pricePrem:400,changeWeek:7,changeMonth:18},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:4,priceMin:2,pricePrem:8,changeWeek:4,changeMonth:10},
  // Messi
  {player:"Lionel Messi",team:"Inter Miami",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:22,priceMin:15,pricePrem:35,changeWeek:3,changeMonth:8},
  {player:"Lionel Messi",team:"FC Barcelona",season:"2020-21",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:1800,priceMin:1400,pricePrem:2400,changeWeek:5,changeMonth:12},
  {player:"Lionel Messi",team:"PSG",season:"2021-22",manufacturer:"Panini",collection:"Prizm",rarity:"Auto",priceEur:950,priceMin:700,pricePrem:1300,changeWeek:4,changeMonth:10},
  {player:"Lionel Messi",team:"Argentina",season:"2022-23",manufacturer:"Panini",collection:"Select",rarity:"Refractor",priceEur:120,priceMin:85,pricePrem:165,changeWeek:6,changeMonth:15},
  // Ronaldo
  {player:"Cristiano Ronaldo",team:"Al-Nassr",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:20,priceMin:14,pricePrem:30,changeWeek:2,changeMonth:6},
  {player:"Cristiano Ronaldo",team:"Manchester United",season:"2021-22",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:1500,priceMin:1100,pricePrem:2000,changeWeek:3,changeMonth:8},
  {player:"Cristiano Ronaldo",team:"Real Madrid",season:"2017-18",manufacturer:"Topps",collection:"Chrome",rarity:"Auto",priceEur:1200,priceMin:900,pricePrem:1600,changeWeek:4,changeMonth:10},
  // Salah
  {player:"Mohamed Salah",team:"Liverpool",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:10,priceMin:7,pricePrem:16,changeWeek:3,changeMonth:7},
  {player:"Mohamed Salah",team:"Liverpool",season:"2023-24",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:2,changeMonth:5},
  // Modric
  {player:"Luka Modric",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:6,priceMin:4,pricePrem:11,changeWeek:2,changeMonth:4},
  {player:"Luka Modric",team:"Real Madrid",season:"2022-23",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:420,priceMin:310,pricePrem:580,changeWeek:3,changeMonth:8},
  // Kane
  {player:"Harry Kane",team:"Bayern Munich",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:12,priceMin:8,pricePrem:18,changeWeek:4,changeMonth:10},
  {player:"Harry Kane",team:"Bayern Munich",season:"2023-24",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:4,priceMin:2,pricePrem:7,changeWeek:3,changeMonth:7},
  // De Bruyne
  {player:"Kevin De Bruyne",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:11,priceMin:7,pricePrem:17,changeWeek:2,changeMonth:5},
  // Gavi
  {player:"Gavi",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:9,priceMin:6,pricePrem:15,changeWeek:3,changeMonth:7},
  {player:"Gavi",team:"FC Barcelona",season:"2021-22",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:22,priceMin:15,pricePrem:34,changeWeek:2,changeMonth:5},
  // Benzema
  {player:"Karim Benzema",team:"Al-Ittihad",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:9,priceMin:6,pricePrem:14,changeWeek:1,changeMonth:3},
  // Neymar
  {player:"Neymar Jr.",team:"Al-Hilal",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:10,priceMin:7,pricePrem:15,changeWeek:2,changeMonth:5},
  // Lewandowski
  {player:"Robert Lewandowski",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:2,changeMonth:4},
  // Griezmann
  {player:"Antoine Griezmann",team:"Atlético Madrid",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:5,priceMin:3,pricePrem:9,changeWeek:2,changeMonth:4},

  // ── PANINI PRIZM 2024-25 ──────────────────────────────────
  {player:"Rodri",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:12,priceMin:8,pricePrem:18,changeWeek:8,changeMonth:25},
  {player:"Rodri",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:320,priceMin:240,pricePrem:450,changeWeek:10,changeMonth:30},
  {player:"Phil Foden",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:10,priceMin:7,pricePrem:16,changeWeek:4,changeMonth:10},
  {player:"Phil Foden",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Silver",priceEur:28,priceMin:20,pricePrem:42,changeWeek:5,changeMonth:12},
  {player:"Bukayo Saka",team:"Arsenal",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:14,priceMin:10,pricePrem:22,changeWeek:6,changeMonth:15},
  {player:"Bukayo Saka",team:"Arsenal",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:45,priceMin:32,pricePrem:65,changeWeek:8,changeMonth:22},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:15,priceMin:10,pricePrem:24,changeWeek:5,changeMonth:12},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:55,priceMin:38,pricePrem:78,changeWeek:12,changeMonth:40},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:10,changeMonth:35},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:16,priceMin:11,pricePrem:25,changeWeek:7,changeMonth:20},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Silver",priceEur:42,priceMin:30,pricePrem:60,changeWeek:8,changeMonth:22},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2022-23",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:80,priceMin:58,pricePrem:115,changeWeek:9,changeMonth:28},
  {player:"Marcus Rashford",team:"Manchester United",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:2,changeMonth:4},
  {player:"Trent Alexander-Arnold",team:"Liverpool",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:10,priceMin:7,pricePrem:16,changeWeek:3,changeMonth:8},
  {player:"Trent Alexander-Arnold",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:35,priceMin:25,pricePrem:52,changeWeek:15,changeMonth:50},
  {player:"Federico Valverde",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:9,priceMin:6,pricePrem:14,changeWeek:3,changeMonth:7},
  {player:"Andriy Lunin",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:4,changeMonth:15},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:11,priceMin:7,pricePrem:17,changeWeek:8,changeMonth:25},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:38,priceMin:27,pricePrem:55,changeWeek:10,changeMonth:30},
  {player:"Raphinha",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:9,priceMin:6,pricePrem:14,changeWeek:5,changeMonth:18},
  {player:"Ferran Torres",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:2,changeMonth:5},
  {player:"Álvaro Morata",team:"Atlético Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:2,changeMonth:5},
  {player:"Antoine Griezmann",team:"Atlético Madrid",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:2,changeMonth:5},
  {player:"Julian Alvarez",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:42,priceMin:30,pricePrem:62,changeWeek:12,changeMonth:38},
  {player:"Cole Palmer",team:"Chelsea",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:8,changeMonth:25},
  {player:"Cole Palmer",team:"Chelsea",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Rookie",priceEur:75,priceMin:55,pricePrem:105,changeWeek:10,changeMonth:30},
  {player:"Cole Palmer",team:"Chelsea",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Gold",cardNumber:"/10",priceEur:480,priceMin:350,pricePrem:650,changeWeek:12,changeMonth:35},
  {player:"Declan Rice",team:"Arsenal",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:10,priceMin:7,pricePrem:16,changeWeek:3,changeMonth:8},
  {player:"Martin Odegaard",team:"Arsenal",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:4,changeMonth:10},
  {player:"Leroy Sane",team:"Bayern Munich",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:7,priceMin:5,pricePrem:11,changeWeek:2,changeMonth:4},
  {player:"Harry Kane",team:"Bayern Munich",season:"2024-25",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:14,priceMin:9,pricePrem:22,changeWeek:4,changeMonth:10},
  {player:"Serge Gnabry",team:"Bayern Munich",season:"2023-24",manufacturer:"Panini",collection:"Prizm",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:1,changeMonth:3},

  // ── PANINI ADRENALYN XL 2024-25 ──────────────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:35,priceMin:25,pricePrem:52,changeWeek:15,changeMonth:45},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:22,priceMin:15,pricePrem:35,changeWeek:6,changeMonth:18},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:20,priceMin:14,pricePrem:30,changeWeek:5,changeMonth:15},
  {player:"Erling Haaland",team:"Manchester City",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:18,priceMin:12,pricePrem:28,changeWeek:4,changeMonth:12},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:15,priceMin:10,pricePrem:24,changeWeek:5,changeMonth:14},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:2,changeMonth:5},
  {player:"Gavi",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:2,changeMonth:4},
  {player:"Rodri",team:"Manchester City",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:18,priceMin:12,pricePrem:28,changeWeek:8,changeMonth:22},
  {player:"Cole Palmer",team:"Chelsea",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:14,priceMin:9,pricePrem:22,changeWeek:6,changeMonth:18},
  {player:"Bukayo Saka",team:"Arsenal",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:12,priceMin:8,pricePrem:19,changeWeek:5,changeMonth:14},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:16,priceMin:10,pricePrem:25,changeWeek:10,changeMonth:30},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:14,priceMin:9,pricePrem:22,changeWeek:7,changeMonth:20},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:10,priceMin:6,pricePrem:16,changeWeek:8,changeMonth:24},
  {player:"Alejandro Garnacho",team:"Manchester United",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:4,priceMin:2,pricePrem:8,changeWeek:5,changeMonth:18},
  {player:"Julián Álvarez",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:12,priceMin:8,pricePrem:19,changeWeek:10,changeMonth:30},
  {player:"Antoine Griezmann",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Base",priceEur:4,priceMin:2,pricePrem:7,changeWeek:2,changeMonth:4},
  {player:"Toni Kroos",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:12,priceMin:8,pricePrem:19,changeWeek:3,changeMonth:8},
  {player:"Mohamed Salah",team:"Liverpool",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:12,priceMin:8,pricePrem:19,changeWeek:4,changeMonth:12},
  {player:"Harry Kane",team:"Bayern Munich",season:"2024-25",manufacturer:"Panini",collection:"Adrenalyn XL",rarity:"Limited Edition",priceEur:10,priceMin:6,pricePrem:16,changeWeek:3,changeMonth:8},

  // ── TOPPS MATCH ATTAX 2024-25 ────────────────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:25,priceMin:18,pricePrem:38,changeWeek:12,changeMonth:38},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:18,priceMin:12,pricePrem:28,changeWeek:6,changeMonth:18},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:15,priceMin:10,pricePrem:24,changeWeek:5,changeMonth:14},
  {player:"Erling Haaland",team:"Manchester City",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:14,priceMin:9,pricePrem:22,changeWeek:4,changeMonth:12},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:12,priceMin:8,pricePrem:19,changeWeek:5,changeMonth:14},
  {player:"Cole Palmer",team:"Chelsea",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:14,priceMin:9,pricePrem:22,changeWeek:8,changeMonth:24},
  {player:"Bukayo Saka",team:"Arsenal",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:10,priceMin:6,pricePrem:16,changeWeek:5,changeMonth:14},
  {player:"Rodri",team:"Manchester City",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:14,priceMin:9,pricePrem:22,changeWeek:7,changeMonth:20},
  {player:"Harry Kane",team:"Bayern Munich",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:10,priceMin:6,pricePrem:16,changeWeek:3,changeMonth:8},
  {player:"Mohamed Salah",team:"Liverpool",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:10,priceMin:6,pricePrem:16,changeWeek:4,changeMonth:12},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:2,changeMonth:5},
  {player:"Gavi",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:1,changeMonth:3},
  {player:"Alejandro Garnacho",team:"Manchester United",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"Base",priceEur:3,priceMin:1,pricePrem:6,changeWeek:5,changeMonth:18},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:12,priceMin:8,pricePrem:19,changeWeek:8,changeMonth:25},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:10,priceMin:6,pricePrem:16,changeWeek:6,changeMonth:18},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:8,priceMin:5,pricePrem:13,changeWeek:7,changeMonth:22},
  {player:"Trent Alexander-Arnold",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Match Attax",rarity:"100 Club",priceEur:15,priceMin:10,pricePrem:24,changeWeek:12,changeMonth:40},

  // ── TOPPS CHROME UEFA 2024 ───────────────────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:22,priceMin:15,pricePrem:34,changeWeek:10,changeMonth:32},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"Chrome",rarity:"Refractor",priceEur:65,priceMin:45,pricePrem:92,changeWeek:12,changeMonth:38},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:5,changeMonth:14},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Refractor",priceEur:55,priceMin:38,pricePrem:78,changeWeek:6,changeMonth:16},
  {player:"Kylian Mbappé",team:"PSG",season:"2022-23",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:14,priceMin:9,pricePrem:22,changeWeek:3,changeMonth:8},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:5,changeMonth:14},
  {player:"Erling Haaland",team:"Manchester City",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:16,priceMin:10,pricePrem:25,changeWeek:4,changeMonth:10},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Rookie",priceEur:48,priceMin:34,pricePrem:68,changeWeek:10,changeMonth:32},
  {player:"Jamal Musiala",team:"Bayern Munich",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:14,priceMin:9,pricePrem:22,changeWeek:6,changeMonth:18},
  {player:"Cole Palmer",team:"Chelsea",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Rookie",priceEur:55,priceMin:38,pricePrem:78,changeWeek:8,changeMonth:24},
  {player:"Bukayo Saka",team:"Arsenal",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:5,changeMonth:14},
  {player:"Pedri",team:"FC Barcelona",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:10,priceMin:6,pricePrem:16,changeWeek:3,changeMonth:8},
  {player:"Gavi",team:"FC Barcelona",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:9,priceMin:6,pricePrem:14,changeWeek:2,changeMonth:6},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2023-24",manufacturer:"Topps",collection:"Chrome",rarity:"Base",priceEur:14,priceMin:9,pricePrem:22,changeWeek:5,changeMonth:14},

  // ── PANINI LIGA ESTE (España) ────────────────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:5,priceMin:3,pricePrem:9,changeWeek:8,changeMonth:25},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Idol",priceEur:28,priceMin:20,pricePrem:42,changeWeek:12,changeMonth:38},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:3,priceMin:2,pricePrem:6,changeWeek:6,changeMonth:20},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:2,changeMonth:5},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Idol",priceEur:12,priceMin:8,pricePrem:19,changeWeek:3,changeMonth:8},
  {player:"Gavi",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:1,changeMonth:3},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:3,priceMin:2,pricePrem:6,changeWeek:4,changeMonth:12},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Idol",priceEur:18,priceMin:12,pricePrem:28,changeWeek:6,changeMonth:18},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:4,priceMin:2,pricePrem:7,changeWeek:5,changeMonth:15},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Idol",priceEur:22,priceMin:15,pricePrem:34,changeWeek:6,changeMonth:18},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Idol",priceEur:16,priceMin:10,pricePrem:25,changeWeek:5,changeMonth:14},
  {player:"Antoine Griezmann",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:1,changeMonth:3},
  {player:"Julián Álvarez",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:3,priceMin:2,pricePrem:6,changeWeek:8,changeMonth:25},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:3,priceMin:2,pricePrem:6,changeWeek:6,changeMonth:20},
  {player:"Raphinha",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:4,changeMonth:15},
  {player:"Robert Lewandowski",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:2,changeMonth:5},
  {player:"Federico Valverde",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:2,changeMonth:5},

  // ── PANINI MEGACRACKS 2024-25 ────────────────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"Base",priceEur:3,priceMin:2,pricePrem:6,changeWeek:8,changeMonth:25},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:18,priceMin:12,pricePrem:28,changeWeek:10,changeMonth:30},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:2,changeMonth:5},
  {player:"Pedri",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:10,priceMin:7,pricePrem:16,changeWeek:3,changeMonth:7},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:12,priceMin:8,pricePrem:19,changeWeek:4,changeMonth:12},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:14,priceMin:9,pricePrem:22,changeWeek:5,changeMonth:15},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:12,priceMin:8,pricePrem:19,changeWeek:4,changeMonth:12},
  {player:"Gavi",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"Base",priceEur:2,priceMin:1,pricePrem:4,changeWeek:1,changeMonth:3},
  {player:"Julián Álvarez",team:"Atlético Madrid",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:8,priceMin:5,pricePrem:13,changeWeek:7,changeMonth:22},
  {player:"Dani Olmo",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:7,priceMin:4,pricePrem:12,changeWeek:6,changeMonth:18},

  // ── PANINI SELECT 2023-24 ────────────────────────────────
  {player:"Lionel Messi",team:"Inter Miami",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Concourse",priceEur:18,priceMin:12,pricePrem:28,changeWeek:3,changeMonth:8},
  {player:"Lionel Messi",team:"Inter Miami",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Premier Level",priceEur:85,priceMin:60,pricePrem:120,changeWeek:5,changeMonth:12},
  {player:"Cristiano Ronaldo",team:"Al-Nassr",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Concourse",priceEur:16,priceMin:10,pricePrem:25,changeWeek:2,changeMonth:6},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Concourse",priceEur:14,priceMin:9,pricePrem:22,changeWeek:5,changeMonth:14},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Premier Level",priceEur:75,priceMin:52,pricePrem:108,changeWeek:12,changeMonth:38},
  {player:"Erling Haaland",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Concourse",priceEur:12,priceMin:8,pricePrem:19,changeWeek:4,changeMonth:10},
  {player:"Kylian Mbappé",team:"PSG",season:"2022-23",manufacturer:"Panini",collection:"Select",rarity:"Premier Level",priceEur:95,priceMin:68,pricePrem:135,changeWeek:3,changeMonth:8},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2023-24",manufacturer:"Panini",collection:"Select",rarity:"Concourse",priceEur:12,priceMin:8,pricePrem:19,changeWeek:5,changeMonth:14},

  // ── CROMOS CLÁSICOS ESPAÑOLES ────────────────────────────
  {player:"Ronaldo Nazário",team:"FC Barcelona",season:"1996-97",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:45,priceMin:30,pricePrem:65,changeWeek:2,changeMonth:5},
  {player:"Ronaldo Nazário",team:"Real Madrid",season:"2002-03",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:35,priceMin:22,pricePrem:52,changeWeek:1,changeMonth:4},
  {player:"Ronaldinho",team:"FC Barcelona",season:"2004-05",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:40,priceMin:28,pricePrem:58,changeWeek:2,changeMonth:6},
  {player:"Ronaldinho",team:"FC Barcelona",season:"2005-06",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:55,priceMin:38,pricePrem:78,changeWeek:2,changeMonth:5},
  {player:"Iker Casillas",team:"Real Madrid",season:"2010-11",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:1,changeMonth:3},
  {player:"Iker Casillas",team:"Real Madrid",season:"2012-13",manufacturer:"Panini",collection:"Megacracks",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:1,changeMonth:2},
  {player:"Xavi Hernández",team:"FC Barcelona",season:"2009-10",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:15,priceMin:10,pricePrem:24,changeWeek:1,changeMonth:3},
  {player:"Andrés Iniesta",team:"FC Barcelona",season:"2009-10",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:14,priceMin:9,pricePrem:22,changeWeek:1,changeMonth:3},
  {player:"Andrés Iniesta",team:"FC Barcelona",season:"2010-11",manufacturer:"Panini",collection:"Megacracks",rarity:"MegaCrack",priceEur:22,priceMin:15,pricePrem:34,changeWeek:1,changeMonth:4},
  {player:"Sergio Ramos",team:"Real Madrid",season:"2011-12",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:1,changeMonth:3},
  {player:"Fernando Torres",team:"Atlético Madrid",season:"2002-03",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:1,changeMonth:4},
  {player:"David Villa",team:"Valencia CF",season:"2005-06",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:10,priceMin:7,pricePrem:16,changeWeek:1,changeMonth:3},
  {player:"Raúl González",team:"Real Madrid",season:"2000-01",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:20,priceMin:14,pricePrem:30,changeWeek:1,changeMonth:3},
  {player:"Samuel Eto'o",team:"FC Barcelona",season:"2005-06",manufacturer:"Panini",collection:"Liga Este",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:1,changeMonth:3},

  // ── PANINI UEFA CHAMPIONS LEAGUE 2024-25 ─────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:8,changeMonth:25},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:5,changeMonth:14},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:4,changeMonth:12},
  {player:"Erling Haaland",team:"Manchester City",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:3,changeMonth:8},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:5,priceMin:3,pricePrem:9,changeWeek:4,changeMonth:12},
  {player:"Rodri",team:"Manchester City",season:"2023-24",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:6,changeMonth:18},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:8,changeMonth:24},
  {player:"Cole Palmer",team:"Chelsea",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:6,changeMonth:18},
  {player:"Phil Foden",team:"Manchester City",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:5,priceMin:3,pricePrem:9,changeWeek:3,changeMonth:8},
  {player:"Bukayo Saka",team:"Arsenal",season:"2024-25",manufacturer:"Panini",collection:"Champions League",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:4,changeMonth:12},

  // ── TOPPS UEFA CHAMPIONS LEAGUE 2024-25 ──────────────────
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:10,priceMin:6,pricePrem:16,changeWeek:8,changeMonth:25},
  {player:"Lamine Yamal",team:"FC Barcelona",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Gold",priceEur:45,priceMin:32,pricePrem:65,changeWeek:10,changeMonth:30},
  {player:"Jude Bellingham",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:8,priceMin:5,pricePrem:13,changeWeek:5,changeMonth:14},
  {player:"Kylian Mbappé",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:4,changeMonth:12},
  {player:"Erling Haaland",team:"Manchester City",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:3,changeMonth:8},
  {player:"Vinicius Jr.",team:"Real Madrid",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:6,priceMin:4,pricePrem:10,changeWeek:4,changeMonth:12},
  {player:"Florian Wirtz",team:"Bayer Leverkusen",season:"2024-25",manufacturer:"Topps",collection:"UCL",rarity:"Base",priceEur:7,priceMin:4,pricePrem:12,changeWeek:8,changeMonth:24},

  // ── PANINI WORLD CUP 2022 ────────────────────────────────
  {player:"Lionel Messi",team:"Argentina",season:"2022",manufacturer:"Panini",collection:"World Cup",rarity:"Base",priceEur:15,priceMin:10,pricePrem:24,changeWeek:3,changeMonth:8},
  {player:"Lionel Messi",team:"Argentina",season:"2022",manufacturer:"Panini",collection:"World Cup",rarity:"Gold",priceEur:120,priceMin:85,pricePrem:170,changeWeek:4,changeMonth:10},
  {player:"Kylian Mbappé",team:"France",season:"2022",manufacturer:"Panini",collection:"World Cup",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:3,changeMonth:7},
  {player:"Cristiano Ronaldo",team:"Portugal",season:"2022",manufacturer:"Panini",collection:"World Cup",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:2,changeMonth:5},
  {player:"Lamine Yamal",team:"Spain",season:"2024",manufacturer:"Panini",collection:"Euro",rarity:"Base",priceEur:18,priceMin:12,pricePrem:28,changeWeek:8,changeMonth:25},
  {player:"Jude Bellingham",team:"England",season:"2024",manufacturer:"Panini",collection:"Euro",rarity:"Base",priceEur:10,priceMin:6,pricePrem:16,changeWeek:4,changeMonth:12},
  {player:"Rodri",team:"Spain",season:"2024",manufacturer:"Panini",collection:"Euro",rarity:"Base",priceEur:12,priceMin:8,pricePrem:19,changeWeek:6,changeMonth:18},
  {player:"Florian Wirtz",team:"Germany",season:"2024",manufacturer:"Panini",collection:"Euro",rarity:"Base",priceEur:10,priceMin:6,pricePrem:16,changeWeek:7,changeMonth:22},
  {player:"Jamal Musiala",team:"Germany",season:"2024",manufacturer:"Panini",collection:"Euro",rarity:"Base",priceEur:9,priceMin:6,pricePrem:14,changeWeek:5,changeMonth:16},
];

function searchCards(query) {
  // Normaliza: minúsculas y quita acentos (mbappe == mbappé)
  const norm = (s) => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  const q = norm(query);
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const scored = CATALOG.map(card => {
    const playerN = norm(card.player);
    const otherN  = norm([card.team, card.season, card.manufacturer, card.collection, card.rarity, card.cardNumber||""].join(" "));

    let playerHits = 0, otherHits = 0;
    for (const w of words) {
      if (playerN.includes(w)) playerHits += w.length;
      else if (otherN.includes(w)) otherHits += w.length;
    }
    // El nombre del jugador pesa muchísimo más que los demás campos
    const score = playerHits * 100 + otherHits;
    return { card, score, playerHits };
  }).filter(x => x.score > 0);

  // Si ALGÚN cromo coincide por nombre de jugador, descartamos los que solo
  // coincidían por equipo/marca (para no mezclar jugadores distintos)
  const hasPlayerMatch = scored.some(x => x.playerHits > 0);
  let pool = hasPlayerMatch ? scored.filter(x => x.playerHits > 0) : scored;

  // Si no hay nada, búsqueda aproximada por nombre de jugador
  if (!pool.length) {
    for (const card of CATALOG) {
      const playerN = norm(card.player);
      if (words.some(w => w.length > 3 && playerN.includes(w.slice(0, 4)))) {
        pool.push({ card, score: 1, playerHits: 1 });
      }
    }
  }

  pool.sort((a, b) => b.score - a.score);

  // Hasta 6 resultados, sin repetir misma carta
  const seen = new Set();
  const results = [];
  for (const { card } of pool) {
    const key = `${card.player}|${card.collection}|${card.rarity}`;
    if (!seen.has(key) && results.length < 6) {
      seen.add(key);
      results.push({
        ...card,
        _uid: `s_${Date.now()}_${results.length}`,
        _priceSource: "Datos de mercado CardGoal",
        _needsRealPrice: false,
      });
    }
  }
  return results;
}

/* ─── PRICE — web search, called on demand ────────────────── */
const priceCache = {};
const PRICE_TTL = 23 * 60 * 60 * 1000; // 23h — precios estables durante el día
function lsPriceGet(key) {
  try { const d=JSON.parse(localStorage.getItem(`cg_px_${key.slice(0,80)}`)||"null"); return d&&Date.now()-d.ts<PRICE_TTL?d.v:null; } catch { return null; }
}
function lsPriceSet(key, val) {
  try { localStorage.setItem(`cg_px_${key.slice(0,80)}`,JSON.stringify({v:val,ts:Date.now()})); } catch {}
}
function lsPriceClear(key) {
  try { localStorage.removeItem(`cg_px_${key.slice(0,80)}`); } catch {}
}

/* Histórico de precios: clave normalizada del cromo + registro (1 vez al día por cromo) */
function cardKey(card){
  const n = s => (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  return [n(card.player),n(card.manufacturer),n(card.collection),n(card.rarity||"base"),n(card.season)].join("|");
}
function logPriceSnapshot(card, priceEur, source){
  try{
    if(priceEur==null) return;
    const key = cardKey(card);
    const today = new Date().toISOString().slice(0,10);
    const flag = `cg_snap_${key}_${today}`;
    if(localStorage.getItem(flag)) return;      // ya guardado hoy, no duplicamos
    localStorage.setItem(flag,"1");
    supa.saveSnapshot(key, priceEur, source);   // fire-and-forget
  }catch{}
}

// ¿Es este precio razonable para este tipo de carta? Evita valores desorbitados
function isPriceOk(eur, card) {
  if (!eur || eur <= 0) return false;
  const r = (card.rarity||card.serialNumber||"").toLowerCase();
  const serial = card.serialNumber && String(card.serialNumber)!=="null" ? card.serialNumber : null;
  if (serial)                                    return eur <= 8000; // numeradas: puede valer mucho
  if (/auto/.test(r))                            return eur <= 1500; // autos: hasta 1500€
  if (/prizm|refract|holo|silver|gold/.test(r)) return eur <= 500;  // parallels premium
  if (/rookie|\brc\b/.test(r))                   return eur <= 500;  // rookies
  return eur <= 400; // base — sube a 400€ para cubrir vintage (Euro 2004, WC 2002...) y leyendas
}

// Estimación conservadora y ESTABLE basada solo en la rareza — nunca da 1/2/3 ni 1000€
function rarityEstimate(card) {
  const r = (card.rarity||"").toLowerCase();
  const serial = card.serialNumber && String(card.serialNumber)!=="null" ? card.serialNumber : null;
  const src = "⚡ Estimación orientativa";
  if (serial) {
    const n = parseInt((serial||"").replace(/[^0-9]/g,"")) || 99;
    if (n <= 1)  return {priceEur:600, priceMin:300, pricePrem:1500, priceSource:src};
    if (n <= 5)  return {priceEur:250, priceMin:120, pricePrem:700,  priceSource:src};
    if (n <= 10) return {priceEur:130, priceMin:65,  pricePrem:350,  priceSource:src};
    if (n <= 25) return {priceEur:75,  priceMin:38,  pricePrem:200,  priceSource:src};
    if (n <= 50) return {priceEur:45,  priceMin:22,  pricePrem:120,  priceSource:src};
    return             {priceEur:25,  priceMin:12,  pricePrem:70,   priceSource:src};
  }
  if (/auto/.test(r))         return {priceEur:22, priceMin:10, pricePrem:65,  priceSource:src};
  if (/prizm|refract|silver/.test(r)) return {priceEur:10, priceMin:5, pricePrem:28, priceSource:src};
  if (/gold|holo/.test(r))    return {priceEur:14, priceMin:7, pricePrem:40,  priceSource:src};
  if (/rookie|\brc\b/.test(r)) return {priceEur:8, priceMin:4, pricePrem:22,  priceSource:src};
  return                       {priceEur:2,  priceMin:1,  pricePrem:6,   priceSource:src};
}
function parseEbayPrice(priceStr) {
  const s = String(priceStr || "");
  const n = parseFloat(s.replace(/[^0-9.,]/g,"").replace(",",".") || "0");
  if (!n || n <= 0) return null;
  if (s.includes("$")) return Math.round(n * 0.92 * 100) / 100;
  if (s.includes("£")) return Math.round(n * 1.17 * 100) / 100;
  return Math.round(n * 100) / 100;
}

// Precio MÍNIMO garantizado según rareza — nunca puede bajar de aquí
function priceFloor(card) {
  const serial = card.serialNumber && String(card.serialNumber)!=="null" ? String(card.serialNumber) : null;
  if(serial) {
    // Acepta "/5", "5/50", "05/50", "5" — cualquier formato de numeración
    const m = serial.match(/\/(\d+)/) ||   // "/5" o "14/25" → coge el denominador
              serial.match(/^(\d+)\//)  ||   // "5/" → coge el numerador
              serial.match(/^(\d+)$/);        // "5" solo → asume que es el total
    const n = m ? parseInt(m[1]) : null;
    if(n && n > 0) {
      if(n <= 1)   return 500;
      if(n <= 5)   return 200;
      if(n <= 10)  return 100;
      if(n <= 25)  return 50;
      if(n <= 50)  return 25;
      if(n <= 99)  return 15;
    }
  }
  if(/auto/i.test(card.rarity||"")) return 15;
  return 0;
}

// Comprueba si un precio nuevo es aceptable vs el precio existente
function isPriceChangeOk(newPrice, existingPrice) {
  if(!newPrice || newPrice <= 0) return false;
  if(!existingPrice || existingPrice <= 0) return true; // sin precio previo: siempre OK
  if(existingPrice > 30 && newPrice < existingPrice * 0.3) return false; // caída > 70%: rechazar
  return true;
}

async function fetchPrice(card, token = null) {
  const serial = card.serialNumber && String(card.serialNumber)!=="null" ? String(card.serialNumber) : null;
  const serialLabel = serial ? ` NUMERADA ${serial}` : "";
  const desc = card._ebayTitle
    ? card._ebayTitle
    : `${card.player} | ${card.manufacturer||"?"} | ${card.collection||"?"} | ${card.rarity||"Base"}${serialLabel} | ${card.season||"?"}`;
  const cacheKey = card._ebayTitle ? `ebay:${desc}` : `${card.player}|${card.manufacturer||""}|${card.collection||""}|${card.rarity||"Base"}|${serial||""}|${card.season||""}`;

  // ── Caché (memoria + localStorage 23h) ──
  if (priceCache[cacheKey]) return priceCache[cacheKey];
  const lsCached = lsPriceGet(cacheKey);
  if (lsCached && isPriceOk(lsCached.priceEur, card)) { priceCache[cacheKey]=lsCached; return lsCached; }

  const save = r => {
    // Aplicar precio mínimo garantizado según rareza
    const floor = priceFloor(card);
    if(floor > 0 && r.priceEur < floor) {
      r = {...r, priceEur: floor, priceMin: floor,
           priceSource: (r.priceSource||"") + " (mín. rareza)"};
    }
    priceCache[cacheKey] = r;
    lsPriceSet(cacheKey, r);
    logPriceSnapshot(card, r.priceEur, r.priceSource);
    if(card._dbId && token) {
      supa.updateCardPrice(card._dbId, token, r).catch(()=>{});
    }
    return r;
  };

  // ── PASO 1: precio ya en objeto (búsqueda eBay) → instantáneo ──
  if (card._fromEbay && isPriceOk(num(card.priceEur), card)) {
    const p = num(card.priceEur);
    return save({priceEur:p, priceMin:Math.round(p*.65), pricePrem:Math.round(p*1.5), priceSource:"eBay", changeWeek:0, changeMonth:0});
  }

  // ── PASO 2: eBay — fuente principal de precios ──
  try {
    const isAuto   = /auto/i.test(card.rarity||"");
    const isGraded = /\bpsa\b|\bbgs\b|\bsgc\b|\bcgc\b/i.test(card.rarity||"");

    const searchQ = [
      card.player,
      card.manufacturer && card.manufacturer!=="?" ? card.manufacturer : "",
      card.collection   && card.collection!=="?"   ? card.collection   : "",
      card.season       && card.season!=="?"        ? card.season      : "",
      isAuto ? "auto" : "",
      serial || "",
    ].filter(Boolean).join(" ").trim();

    const lastName = (card.player||"").split(" ").slice(-1)[0].toLowerCase();

    const r = await fetch(`/api/ebay?q=${encodeURIComponent(searchQ)}`);
    if(r.ok) {
      const data = await r.json();
      const prices = (data?.results||[])
        .filter(it => {
          if(!it.price) return false;
          if(EBAY_BAD_ALWAYS.test(it.title||"")) return false;
          if(!isAuto && EBAY_BAD_NONAUTO.test(it.title||"")) return false;
          if(!isGraded && GRADED_PAT.test(it.title||"")) return false;
          if(lastName.length>=3 && !(it.title||"").toLowerCase().includes(lastName)) return false;
          return true;
        })
        .map(it => parseEbayPrice(it.price))
        .filter(p => p && isPriceOk(p, card))
        .sort((a,b) => a-b);

      if(prices.length >= 1) {
        const floor  = priceFloor(card);
        const median = Math.max(prices[Math.floor(prices.length/2)], floor);
        const src    = isGraded
          ? `eBay · ${prices.length} resultados (gradeada)`
          : `eBay · ${prices.length} anuncio${prices.length>1?"s":""}`;
        return save({
          priceEur:  median,
          priceMin:  Math.max(prices[0], floor),
          pricePrem: prices[prices.length-1],
          priceSource: src,
          changeWeek:0, changeMonth:0
        });
      }
    }
  } catch(e){ console.error("fetchPrice eBay:", e.message); }

  // ── PASO 3: Sonnet solo si no hay datos de mercado ──
  try {
    const serialCtx = serial
      ? `CARTA NUMERADA ${serial} (solo ${serial.replace("/","")} copias en el mundo).`
      : `Sin gradear (RAW).`;
    const raw = await callAI([{role:"user",content:
`Experto en cartas de fútbol coleccionables. Precio EUR sin gradear.
Carta: ${desc} — ${serialCtx}
Endrick/Yamal/Vinicius/Bellingham: autos numerados valen 150-800€+ según rareza.
SOLO JSON: {"priceEur":X,"priceMin":Y,"pricePrem":Z,"priceSource":"Estimación"}`
    }], false, 150, "claude-sonnet-4-6");
    const p = jparse(raw);
    if(p && isPriceOk(num(p.priceEur), card)) {
      return save({priceEur:num(p.priceEur), priceMin:num(p.priceMin)||Math.round(num(p.priceEur)*.65),
        pricePrem:num(p.pricePrem)||Math.round(num(p.priceEur)*1.5),
        priceSource:"⚡ Estimación IA", changeWeek:0, changeMonth:0});
    }
  } catch {}

  // ── PASO 4: rareza como último recurso ──
  return save({...rarityEstimate(card), changeWeek:0, changeMonth:0, isEstimate:true});
}

/* ─── GENERATE CARD SVG ──────────────────────────────────────
   Uses Claude to create a realistic SVG card image for each card.
   Called on-demand when user opens a card detail.
   Cached in memory to avoid regenerating.
──────────────────────────────────────────────────────────────── */
const svgCache = {};

async function generateCardSVG(card) {
  const key = `${card.player}|${card.collection}|${card.rarity}`;
  if (svgCache[key]) return svgCache[key];

  const jersey    = jnum(card.player||"");
  const player    = card.player||"Player";
  const team      = card.team||"";
  const colName   = card.collection||card.manufacturer||"CARD";
  const rarity    = card.rarity||"Base";
  const isGold    = rarity.toLowerCase().includes("gold");
  const isPrizm   = rarity.toLowerCase().includes("prizm")||rarity.toLowerCase().includes("refractor");
  const isAuto    = rarity.toLowerCase().includes("auto");
  const isRC      = rarity.toLowerCase().includes("rookie")||rarity.toLowerCase().includes("rc");

  const raw = await callAI([{role:"user",content:
`You are a professional SVG card designer. Generate a realistic football trading card SVG for ${player}.

STRICT FORMAT: Return ONLY raw SVG. No markdown, no backticks, no explanation. Start directly with <svg.

Card specs:
- viewBox: 0 0 200 280
- Player: ${player}, Team: ${team}, Jersey: ${jersey}
- Series: ${colName}, Rarity: ${rarity}

Design rules:
1. BACKGROUND: Full card gradient. Use these exact colors based on series:
   - Prizm/Refractor: #1a0035 to #7c00ff with diagonal shine lines
   - Chrome: #1a1a2e to #4a4a6a with silver shimmer  
   - Adrenalyn XL: #cc0000 to #ff4400
   - Match Attax: #003399 to #0055cc
   - Gold: #1a1000 to #4a3000
   - Base/other: #0f1f40 to #1a3a6a

2. PLAYER SILHOUETTE (most important - fill upper 60% of card):
   Draw a detailed footballer silhouette using SVG paths. Dynamic pose - kicking or jumping.
   Head: ellipse at top. Body: filled path. Legs: paths showing kick motion. Arms: extended.
   Color: white at 80% opacity or team accent color. Add jersey number ${jersey} on chest area.
   Make figure 80px wide, centered at x=100, filling y=20 to y=165.

3. TEAM COLORS: Add team color accents based on team name:
   - Real Madrid: blue(#001489)+gold(#c8a71b)
   - Barcelona: blue(#004d98)+red(#a50044)  
   - Man City: light blue(#6cabdd)
   - Liverpool: red(#c8102e)
   - PSG: dark blue(#003f7f)+red(#ee1c25)
   - Other: use white+gold

4. TOP BAR: Rectangle y=0 to y=22, dark semi-transparent. Text: "${colName}" white bold 9px centered.

5. BOTTOM PANEL: Rectangle y=190 to y=280, dark semi-transparent fill.
   - "${player}" white bold 14px at y=210
   - "${team}" colored 10px at y=226  
   - Season text 8px at y=240
   - Rarity badge at bottom right

6. BORDER: 3px stroke around card.
   - Gold rarity: #f5c518 stroke + filter glow
   - Prizm: rainbow gradient stroke  
   - Auto: #00e5ff stroke
   - Base: rgba(255,255,255,0.3)

7. SHINE: Semi-transparent diagonal rectangle across full card, opacity 0.08.

8. RARITY EXTRAS:
   - Gold: add 3-4 small star shapes (★) in corners
   - Prizm: add diagonal holographic lines pattern
   - Auto: add signature line at bottom
   - RC: add "ROOKIE" badge top-right

Only include SVG elements. No JavaScript. Use gradients, paths, text, rect, ellipse, circle.`
  }], false, 3000);

  // Extract SVG
  let svg = raw.trim();
  if (!svg.startsWith('<svg')) {
    const m = svg.match(/<svg[\s\S]*<\/svg>/i);
    if (!m) return null;
    svg = m[0];
  }
  // Ensure correct viewBox
  if (!svg.includes('viewBox')) {
    svg = svg.replace('<svg', '<svg viewBox="0 0 200 280"');
  }
  // Add width/height for display
  svg = svg.replace('<svg', '<svg width="100%" height="100%"');

  svgCache[key] = svg;
  return svg;
}

/* ─── SCAN ────────────────────────────────────────────────── */
// Escanea el REVERSO de una carta para detectar numeración, auto, número de carta
async function scanCardBack(b64, mime, frontCard) {
  const raw = await callAI([{role:"user",content:[
    {type:"image",source:{type:"base64",media_type:mime,data:b64}},
    {type:"text",text:`This is the BACK of a trading card. Front identified as: ${frontCard.player||"?"} ${frontCard.manufacturer||""} ${frontCard.collection||""}.

CRITICAL DISTINCTION — serial number vs stats:
- SERIAL/PRINT RUN: a STAMPED or FOIL number showing total print run, e.g. "14/25" means card #14 of only 25 made. Usually bottom corner, isolated, often gold/silver foil. This is RARE.
- PLAYER STATS: numbers inside a stats table/grid (PACE 85, SHOOT 5/5, etc). These are NOT serial numbers. IGNORE them.
- If you see numbers like "5/5", "16/20", "85/100" inside a stats section → these are stats, NOT serial numbers → serialNumber: null

Look for:
1. Serial/print run: ONLY if stamped/foil number isolated at edge or corner, NOT inside a stats grid
2. Autograph/signature: actual ink signature or signed sticker on card

Return ONLY valid JSON:
{"serialNumber":"/25","hasAuto":true}
If no stamped serial number found: {"serialNumber":null,"hasAuto":false}`}
  ]}]);
  return jparse(raw);
}

const SCAN_P = [
`Expert football card identifier. IMPORTANT: look carefully for any serial/print-run number stamped on the card (e.g. "5/5", "24/99", "1/10" — usually bottom corner, often gold-foil stamped). This is CRITICAL for valuation.
Return ONLY valid JSON:
{"player":"Full name","team":"Club","season":"2023-24","manufacturer":"Panini/Topps/Upper Deck/Adrenalyn","collection":"Set name","serialNumber":"/5","rarity":"Numbered /5","condition":"Near Mint","confidence":0.9}
Rules: if you see X/Y stamped → serialNumber="/Y", rarity="Numbered /Y". If Auto → rarity="Auto /Y". If Patch/Relic → rarity="Patch Auto /Y". If no number → serialNumber=null, rarity="Base/Silver/Gold/Rookie/Refractor" as appropriate.
Not a card → {"player":"NO_CARD","confidence":0}`,
`Identify football card. Look for stamped serial number (X/Y format). Return ONLY JSON:
{"player":"name","team":"team","manufacturer":"brand","collection":"set","serialNumber":null,"rarity":"Base","season":"year","condition":"NM","confidence":0.7}
Not a card → {"player":"NO_CARD","confidence":0}`,
`Football card JSON: {"player":"name","team":"team","manufacturer":"brand","collection":"set","serialNumber":null,"rarity":"Base","season":"?","condition":"NM","confidence":0.5}`
];

async function scanCard(b64, mime) {
  let err;
  for (let i=0; i<3; i++) {
    try {
      const raw = await callAI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:SCAN_P[Math.min(i,2)]}]}]);
      const c = jparse(raw);
      if (!c) throw new Error("JSON_FAIL");
      if (c.player==="NO_CARD") throw new Error("NO_CARD");
      if (!c.player||c.player.trim().length<2) throw new Error("NO_PLAYER");
      return c;
    } catch(e) { err=e; if(i<2) await sleep(600*(i+1)); }
  }
  throw err;
}

/* ─── GRADE ───────────────────────────────────────────────── */
async function gradeCard(b64, mime, lang) {
  const isES = lang==="es";
  const raw = await callAI([{role:"user",content:[
    {type:"image",source:{type:"base64",media_type:mime,data:b64}},
    {type:"text",text: isES
      ? `Grader PSA/BGS profesional. Analiza esta carta de fútbol (4 criterios 1-10: centrado, esquinas, bordes, superficie). Grado PSA estimado.
SOLO JSON en español: {"centering":8.5,"corners":9,"edges":8,"surface":9,"predictedGrade":8,"gradeLabel":"NM-MT 8","worthGrading":true,"gradingCost":25,"centeringDetail":"desc","cornersDetail":"desc","edgesDetail":"desc","surfaceDetail":"desc","mainIssue":"issue","recommendation":"rec","rawValue":45,"gradedValue":120,"gradedValueLabel":"PSA 8"}`
      : `Professional PSA/BGS grader. Analyze this football card (4 criteria 1-10: centering, corners, edges, surface). Estimate PSA grade.
ONLY JSON in English: {"centering":8.5,"corners":9,"edges":8,"surface":9,"predictedGrade":8,"gradeLabel":"NM-MT 8","worthGrading":true,"gradingCost":25,"centeringDetail":"desc","cornersDetail":"desc","edgesDetail":"desc","surfaceDetail":"desc","mainIssue":"issue","recommendation":"rec","rawValue":45,"gradedValue":120,"gradedValueLabel":"PSA 8"}`
    }
  ]}], false, 800, "claude-sonnet-4-6");
  const g = jparse(raw);
  if (!g||!g.predictedGrade) throw new Error(isES?"No se pudo analizar":"Could not analyze");
  return g;
}

/* ─── CARD DESIGN ─────────────────────────────────────────── */
const SERIES = {
  prizm:     {bg:"linear-gradient(145deg,#1a0035,#6a00d9)",acc:"#e040fb",logo:"PRIZM"},
  select:    {bg:"linear-gradient(145deg,#003,#06c)",acc:"#fc0",logo:"SELECT"},
  chrome:    {bg:"linear-gradient(145deg,#222,#555)",acc:"#ddd",logo:"CHROME"},
  adrenalyn: {bg:"linear-gradient(145deg,#900,#f30)",acc:"#fd0",logo:"ADRENALYN XL"},
  matchattax:{bg:"linear-gradient(145deg,#039,#06f)",acc:"#fa0",logo:"MATCH ATTAX"},
  mosaic:    {bg:"linear-gradient(145deg,#060,#0a0)",acc:"#0f0",logo:"MOSAIC"},
  topps:     {bg:"linear-gradient(145deg,#09193a,#1a3a6e)",acc:"#d4af37",logo:"TOPPS"},
  panini:    {bg:"linear-gradient(145deg,#1a0800,#4a1500)",acc:"#f60",logo:"PANINI"},
  default:   {bg:"linear-gradient(145deg,#0f1f40,#1a3060)",acc:"#00C853",logo:"CARD"},
};
function getSeries(mfr="",col="") {
  const s=`${mfr} ${col}`.toLowerCase();
  if(s.includes("prizm")||s.includes("select"))return SERIES.prizm;
  if(s.includes("chrome"))return SERIES.chrome;
  if(s.includes("adrenalyn"))return SERIES.adrenalyn;
  if(s.includes("match attax"))return SERIES.matchattax;
  if(s.includes("mosaic"))return SERIES.mosaic;
  if(s.includes("topps"))return SERIES.topps;
  if(s.includes("panini"))return SERIES.panini;
  return SERIES.default;
}

const JN={"messi":10,"ronaldo":7,"neymar":10,"bellingham":5,"mbappe":7,"mbappé":7,"haaland":9,"pedri":8,"gavi":6,"yamal":19,"lamine":19,"vinicius":7,"modric":10,"benzema":9,"kane":9,"salah":11,"lewandowski":9,"griezmann":7};
function jnum(p=""){const l=p.toLowerCase();for(const[k,v]of Object.entries(JN))if(l.includes(k))return v;let h=0;for(const c of p)h=(h*31+c.charCodeAt(0))&0xff;return[6,7,8,9,10,11,17,21][h%8];}

const RARITY_STYLE = r => {
  const l=(r||"").toLowerCase();
  if(l.includes("1/1")||l.includes("1of1"))return{c:"#ff6b00",label:"🔥 1/1"};
  if(l.includes("auto")||l.includes("firma"))return{c:"#0099ff",label:"✍️ AUTO"};
  if(l.includes("gold")||l.includes("oro"))return{c:"#f5c518",label:"★ GOLD"};
  if(l.includes("refractor")||l.includes("prizm")||l.includes("holo"))return{c:"#00C853",label:"◆ REFRACTOR"};
  if(l.includes("silver")||l.includes("plata"))return{c:"#aaa",label:"◈ SILVER"};
  if(l.includes("rookie")||l.includes("rc"))return{c:"#ff8c00",label:"🌟 RC"};
  return null;
};

/* ─── TEAM COLORS ─────────────────────────────────────────── */
const TEAM_COLORS = {
  "real madrid":   ["#FFFFFF","#001489","#c8a71b"],
  "fc barcelona":  ["#A50044","#004D98","#FFED00"],
  "barcelona":     ["#A50044","#004D98","#FFED00"],
  "manchester city":["#6CABDD","#1C2C5B","#FFFFFF"],
  "man city":      ["#6CABDD","#1C2C5B","#FFFFFF"],
  "liverpool":     ["#C8102E","#00B2A9","#F6EB61"],
  "chelsea":       ["#034694","#DBA111","#FFFFFF"],
  "arsenal":       ["#EF0107","#063672","#FFFFFF"],
  "manchester united":["#DA291C","#FBE122","#FFFFFF"],
  "man united":    ["#DA291C","#FBE122","#FFFFFF"],
  "psg":           ["#003F7F","#EE1C25","#FFFFFF"],
  "paris saint-germain":["#003F7F","#EE1C25","#FFFFFF"],
  "atletico madrid":["#CB3524","#132257","#FFFFFF"],
  "atlético madrid":["#CB3524","#132257","#FFFFFF"],
  "juventus":      ["#FFFFFF","#000000","#FFFFFF"],
  "bayern munich": ["#DC052D","#0066B2","#FFFFFF"],
  "borussia dortmund":["#FFD700","#000000","#FFD700"],
  "inter miami":   ["#F7B5CD","#231F20","#00B5E2"],
  "al-nassr":      ["#FFD700","#002D62","#FFFFFF"],
  "al-ittihad":    ["#FFD700","#000000","#FFD700"],
  "al-hilal":      ["#1D4891","#FFFFFF","#1D4891"],
  "argentina":     ["#74ACDF","#FFFFFF","#F6B40E"],
  "brazil":        ["#009C3B","#FFDF00","#009C3B"],
  "brasil":        ["#009C3B","#FFDF00","#009C3B"],
  "france":        ["#002395","#ED2939","#FFFFFF"],
  "england":       ["#FFFFFF","#CF091F","#FFFFFF"],
  "portugal":      ["#006600","#FF0000","#FFFFFF"],
  "spain":         ["#AA151B","#F1BF00","#AA151B"],
  "españa":        ["#AA151B","#F1BF00","#AA151B"],
};
function teamColors(team="") {
  const l = team.toLowerCase();
  for (const [k,v] of Object.entries(TEAM_COLORS)) {
    if (l.includes(k)) return v;
  }
  return ["#1a3a6a","#0f1f40","#00C853"];
}

/* ─── EBAY REAL PHOTO ─────────────────────────────────────────
   Llama a /api/ebay (función serverless en Vercel) para traer la
   foto real del cromo desde eBay. Filtra camisetas, fotos firmadas,
   pósters, etc. Cachea por carta para no repetir llamadas.
──────────────────────────────────────────────────────────────── */
const ebayCache = {};
// Listings a descartar siempre (no son cartas o son artículos distintos)
// Siempre filtrar: esto nunca es una carta (camisetas, álbumes, sobres, pósters...)
const EBAY_BAD_ALWAYS = /camiseta|t-?shirt|shirt|jersey|enmarcad|framed|p[oó]ster|poster|funda|sleeve|figur|mug|taza|bal[oó]n|botas|boots|album completo|sobre cerrad|booster|caja|box set|lote de \d|bufanda|scarf/i;
// Solo filtrar para cartas BASE (auto/signed tienen precio distinto — no mezclar)
const EBAY_BAD_NONAUTO = /autograph|\bsigned\b/i;
// Alias para compatibilidad con código existente que usa EBAY_BAD
const EBAY_BAD = EBAY_BAD_ALWAYS;
// Cartas GRADEADAS (PSA/BGS/CGC en su cápsula) — valen 10-50x más que la raw sin gradear
// Se excluyen del precio porque las cartas de los usuarios son sin gradear por defecto
const GRADED_PAT = /\bpsa\s*\d|\bbgs\s*\d|\bcgc\s*\d|\bsgc\s*\d|beckett\s*\d|\bpsa\s*(gem|mint|nm|ex|vg)|\bslabbed\b|\bgraded\b/i;

const enorm = (s) => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
// Token más significativo (palabra más larga) de un texto
const bigToken = (s) => enorm(s).split(/\s+/).filter(w=>w.length>2).sort((a,b)=>b.length-a.length)[0] || "";

async function fetchEbayCard(card) {
  const key = `${card.player||""}|${card.manufacturer||""}|${card.collection||""}|${card.rarity||""}|${card.season||""}`;
  if (ebayCache[key] !== undefined) return ebayCache[key];

  // Búsqueda dirigida: jugador + colección + equipo (para acertar la variante)
  const q = [card.player, card.collection, card.team].filter(Boolean).join(" ").trim() || (card.player || "");
  if (!card.player) { ebayCache[key] = null; return null; }

  // Tokens para verificar que la foto encaja con ESTE cromo
  const playerLast = enorm(card.player).split(/\s+/).slice(-1)[0] || "";
  const manuf  = enorm(card.manufacturer);
  const collTk = bigToken(card.collection);
  const teamTk = bigToken(card.team);
  const yearTk = (card.season||"").match(/\d{4}/)?.[0] || "";

  try {
    const r = await fetch(`/api/ebay?q=${encodeURIComponent(q)}`);
    if (!r.ok) { ebayCache[key] = null; return null; }
    const data = await r.json();

    let best = null, bestScore = -1;
    for (const it of (data.results || [])) {
      if (!it.image) continue;
      if (EBAY_BAD.test(it.title||"")) continue;
      if (GRADED_PAT.test(it.title||"")) continue;   // excluir cartas gradeadas (PSA/BGS/CGC) — precio inflado
      const t = enorm(it.title);

      // Requisitos OBLIGATORIOS para aceptar la foto como "este cromo":
      const okPlayer = playerLast && t.includes(playerLast);
      const okTeam   = !teamTk || t.includes(teamTk);            // si el cromo tiene equipo, debe aparecer
      const okLine   = (!manuf && !collTk)                       // si no hay marca/colección, se ignora
                       || (manuf  && t.includes(manuf))
                       || (collTk && t.includes(collTk));
      if (!okPlayer || !okTeam || !okLine) continue;             // descarta si falla cualquiera

      // Entre las válidas, elige la que más datos comparte (mejor variante)
      let score = 0;
      if (manuf  && t.includes(manuf))  score += 1;
      if (collTk && t.includes(collTk)) score += 1;
      if (teamTk && t.includes(teamTk)) score += 2;
      if (yearTk && t.includes(yearTk)) score += 1;
      if (score > bestScore) { bestScore = score; best = it; }
    }

    const out = best
      ? { image: best.image, price: best.price, url: best.url, title: best.title }
      : null;
    ebayCache[key] = out;
    return out;
  } catch {
    ebayCache[key] = null;
    return null;
  }
}

/* Búsqueda directa en eBay cuando el catálogo no tiene el cromo.
   Devuelve los anuncios como tarjetas con foto y precio reales. */
const titleCase = (s) => (s||"").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

async function ebaySearchCards(query) {
  try {
    const r = await fetch(`/api/ebay?q=${encodeURIComponent(query)}`);
    if (!r.ok) return [];
    const data = await r.json();
    const list = (data.results || []).filter(it => it.image && !EBAY_BAD.test(it.title || "") && !GRADED_PAT.test(it.title || ""));
    return list.slice(0, 6).map((it, i) => {
      const T = (it.title || "").toLowerCase();
      let rarity = "Base";
      if (/auto|autograph|firmad/.test(T)) rarity = "Auto";
      else if (/relic|patch|jersey|worn|memorabilia/.test(T)) rarity = "Relic";
      else if (/\/\d{1,3}\b|numbered|numerad/.test(T)) rarity = "Numbered";
      else if (/rookie|\brc\b/.test(T)) rarity = "Rookie";
      else if (/refractor|prizm|holo|silver|gold|mosaic/.test(T)) rarity = "Parallel";
      const manufacturer = /topps/.test(T) ? "Topps" : /panini/.test(T) ? "Panini" : "";
      return {
        player: titleCase(query),
        team: "", season: "", manufacturer, collection: "", rarity,
        priceEur: it.price ?? null,
        price: it.price ?? null,
        _ebayImg: it.image,
        _ebayTitle: it.title,
        _ebayUrl: it.url,
        _priceSource: "eBay (anuncio activo)",
        _fromEbay: true,
        _uid: `ebay_${Date.now()}_${i}`,
      };
    });
  } catch {
    return [];
  }
}

/* ─── CARD VISUAL ─────────────────────────────────────────────
   Si hay foto de scanner -> la muestra.
   Si no, intenta la foto real de eBay.
   Si tampoco hay -> dibuja el cromo en SVG (fallback de siempre).
──────────────────────────────────────────────────────────────── */
function CardViz({ card={}, photo=null, sz="md", ebay=false, imgUrl=null }) {
  const [ebayImg, setEbayImg] = useState(null);

  useEffect(() => {
    let alive = true;
    setEbayImg(null);
    const isScan = photo && photo.startsWith("data:");
    if (!isScan && !imgUrl && ebay && card && card.player) {
      fetchEbayCard(card).then(r => { if (alive && r && r.image) setEbayImg(r.image); });
    }
    return () => { alive = false; };
  }, [card?.player, card?.manufacturer, card?.collection, card?.season, photo, ebay, imgUrl]);

  const series  = getSeries(card.manufacturer, card.collection);
  const rs      = RARITY_STYLE(card.rarity||"");
  const jersey  = jnum(card.player||"");
  const [c1,c2,c3] = teamColors(card.team||"");
  const isScan  = photo && photo.startsWith("data:");
  const img     = isScan ? photo : (imgUrl || ebayImg);   // foto scanner, listado eBay directo, o eBay autodetectado
  const imgFit  = isScan ? "cover" : "contain"; // eBay: mostrar cromo entero sin recortar
  const player  = card.player||"—";
  const initials= player.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase();

  const S = {
    sm:{w:72, h:101,r:6, fn:8,  ft:6,  fp:4,  sz:"sm"},
    md:{w:120,h:168,r:9, fn:11, ft:8,  fp:7,  sz:"md"},
    lg:{w:160,h:224,r:11,fn:13, ft:9,  fp:9,  sz:"lg"},
    xl:{w:190,h:266,r:13,fn:15, ft:10, fp:10, sz:"xl"},
  };
  const s = S[sz]||S.md;
  const uid = `${jersey}${sz}${(card.collection||"x")[0]}`;

  if (img) {
    // Scanner photo — fill entire card with real photo
    return (
      <div style={{width:s.w,height:s.h,borderRadius:s.r,border:rs?`2px solid ${rs.c}`:"1.5px solid rgba(255,255,255,0.15)",boxShadow:rs?`0 0 20px ${rs.c}55`:"0 4px 20px rgba(0,0,0,0.4)",position:"relative",overflow:"hidden",flexShrink:0,background:"#000"}}>
        {/* Full card photo — no white gaps */}
        <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:imgFit,objectPosition:"center",display:"block"}}/>
        {/* Gradient overlay for name readability */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"40%",background:"linear-gradient(transparent,rgba(0,0,0,0.85))"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:`${s.fp/2}px ${s.fp}px ${s.fp}px`}}>
          <div style={{fontSize:s.fn,fontWeight:800,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{player}</div>
          <div style={{fontSize:s.ft,color:series.acc,fontWeight:600,marginTop:1}}>{card.team||""}</div>
        </div>
        {rs&&<div style={{position:"absolute",top:s.fp/2,left:s.fp/2,background:"rgba(0,0,0,0.85)",borderRadius:4,padding:"2px 5px",fontSize:Math.max(5,s.ft-1),fontWeight:700,color:rs.c,border:`0.5px solid ${rs.c}`}}>{rs.label}</div>}
      </div>
    );
  }

  // Full illustrated card — SVG with player silhouette + team colors + series design
  const cardW = s.w;
  const cardH = s.h;

  return (
    <div style={{width:cardW,height:cardH,borderRadius:s.r,flexShrink:0,overflow:"hidden",boxShadow:rs?`0 0 20px ${rs.c}66,0 8px 24px rgba(0,0,0,0.5)`:"0 8px 24px rgba(0,0,0,0.4)",border:rs?`2px solid ${rs.c}`:"none"}}>
      <svg width={cardW} height={cardH} viewBox={`0 0 ${cardW} ${cardH}`} xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
        <defs>
          {/* Background gradient */}
          <linearGradient id={`bg${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c2}/>
            <stop offset="60%" stopColor={c2} stopOpacity="0.85"/>
            <stop offset="100%" stopColor={c1} stopOpacity="0.3"/>
          </linearGradient>
          {/* Player silhouette gradient */}
          <linearGradient id={`pl${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} stopOpacity="0.95"/>
            <stop offset="100%" stopColor={c3} stopOpacity="0.7"/>
          </linearGradient>
          {/* Accent gradient for series */}
          <linearGradient id={`ac${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={series.acc} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={series.acc} stopOpacity="0.3"/>
          </linearGradient>
          {/* Bottom overlay */}
          <linearGradient id={`bot${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.85)"/>
          </linearGradient>
          {rs && <filter id={`glow${uid}`}><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>}
        </defs>

        {/* Card background */}
        <rect width={cardW} height={cardH} fill={`url(#bg${uid})`}/>

        {/* Series color strip at top */}
        <rect width={cardW} height={cardH*0.08} fill={series.acc} opacity="0.85"/>

        {/* Diagonal design stripes */}
        <polygon points={`0,${cardH*0.08} ${cardW*0.7},${cardH*0.08} ${cardW*0.5},${cardH*0.22} 0,${cardH*0.22}`} fill={c1} opacity="0.2"/>
        <polygon points={`${cardW},${cardH*0.08} ${cardW},${cardH*0.25} ${cardW*0.3},${cardH*0.25} ${cardW*0.5},${cardH*0.08}`} fill={series.acc} opacity="0.15"/>

        {/* Player silhouette — detailed footballer in dynamic pose */}
        {/* Head */}
        <ellipse cx={cardW*0.5} cy={cardH*0.22} rx={cardW*0.1} ry={cardW*0.12} fill={`url(#pl${uid})`}/>
        {/* Neck */}
        <rect x={cardW*0.46} y={cardH*0.32} width={cardW*0.08} height={cardH*0.05} fill={`url(#pl${uid})`}/>
        {/* Torso / Jersey */}
        <path d={`M${cardW*0.28},${cardH*0.37} L${cardW*0.72},${cardH*0.37} L${cardW*0.68},${cardH*0.58} L${cardW*0.32},${cardH*0.58}Z`} fill={`url(#pl${uid})`}/>
        {/* Left arm reaching up */}
        <path d={`M${cardW*0.28},${cardH*0.37} Q${cardW*0.1},${cardH*0.32} ${cardW*0.08},${cardH*0.22}`} stroke={`url(#pl${uid})`} strokeWidth={cardW*0.07} fill="none" strokeLinecap="round"/>
        {/* Right arm down */}
        <path d={`M${cardW*0.72},${cardH*0.37} Q${cardW*0.85},${cardH*0.45} ${cardW*0.82},${cardH*0.57}`} stroke={`url(#pl${uid})`} strokeWidth={cardW*0.07} fill="none" strokeLinecap="round"/>
        {/* Left leg straight */}
        <path d={`M${cardW*0.38},${cardH*0.58} L${cardW*0.33},${cardH*0.78} L${cardW*0.28},${cardH*0.84}`} stroke={`url(#pl${uid})`} strokeWidth={cardW*0.08} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Right leg kicking */}
        <path d={`M${cardW*0.58},${cardH*0.58} Q${cardW*0.72},${cardH*0.72} ${cardW*0.82},${cardH*0.68}`} stroke={`url(#pl${uid})`} strokeWidth={cardW*0.08} fill="none" strokeLinecap="round"/>
        {/* Boot left */}
        <ellipse cx={cardW*0.27} cy={cardH*0.855} rx={cardW*0.07} ry={cardW*0.035} fill={c1} opacity="0.9"/>
        {/* Boot right / ball contact */}
        <ellipse cx={cardW*0.83} cy={cardH*0.675} rx={cardW*0.065} ry={cardW*0.032} fill={c1} opacity="0.9"/>
        {/* Ball */}
        <circle cx={cardW*0.87} cy={cardH*0.63} r={cardW*0.07} fill="white" opacity="0.9"/>
        <path d={`M${cardW*0.82},${cardH*0.61} L${cardW*0.87},${cardH*0.595} L${cardW*0.92},${cardH*0.615} M${cardW*0.87},${cardH*0.595} L${cardW*0.87},${cardH*0.665}`} stroke="#333" strokeWidth="1.2" fill="none"/>

        {/* Jersey number on chest */}
        <text x={cardW*0.5} y={cardH*0.52} textAnchor="middle" fontSize={cardW*0.14} fontWeight="900" fill="white" fontFamily="Arial Black,sans-serif" opacity="0.95">{jersey}</text>

        {/* Bottom gradient overlay */}
        <rect y={cardH*0.55} width={cardW} height={cardH*0.45} fill={`url(#bot${uid})`}/>

        {/* Series logo top strip */}
        <text x={cardW*0.5} y={cardH*0.065} textAnchor="middle" fontSize={Math.max(6,s.fp+1)} fontWeight="800" fill="white" fontFamily="Arial Black,sans-serif" letterSpacing="1">{series.logo}</text>

        {/* Card number top-right */}
        {card.cardNumber&&<>
          <rect x={cardW*0.72} y={cardH*0.01} width={cardW*0.27} height={cardH*0.07} rx="3" fill="rgba(0,0,0,0.5)"/>
          <text x={cardW*0.855} y={cardH*0.062} textAnchor="middle" fontSize={Math.max(5,s.fp-1)} fontWeight="700" fill="rgba(255,255,255,0.9)" fontFamily="Arial Black,sans-serif">{card.cardNumber}</text>
        </>}

        {/* Rarity badge */}
        {rs&&<>
          <rect x={cardW*0.02} y={cardH*0.1} width={cardW*0.45} height={cardH*0.065} rx="3" fill="rgba(0,0,0,0.75)"/>
          <text x={cardW*0.245} y={cardH*0.152} textAnchor="middle" fontSize={Math.max(5,s.fp-1)} fontWeight="700" fill={rs.c} fontFamily="Arial Black,sans-serif">{rs.label}</text>
        </>}

        {/* Shine / holographic overlay */}
        <rect width={cardW} height={cardH} fill="linear-gradient" opacity="0"/>
        <polygon points={`0,0 ${cardW*0.4},0 0,${cardH*0.5}`} fill="white" opacity="0.04"/>

        {/* Bottom name panel */}
        <rect y={cardH*0.78} width={cardW} height={cardH*0.22} fill="rgba(0,0,0,0.75)"/>
        <rect y={cardH*0.78} width={cardW} height="2" fill={series.acc} opacity="0.8"/>

        {/* Player name */}
        <text x={cardW*0.5} y={cardH*0.855} textAnchor="middle" fontSize={s.fn} fontWeight="800" fill="white" fontFamily="Arial Black,sans-serif">
          {player.length > 14 ? player.split(" ").map((w,i)=>i===0?w[0]+".":w).join(" ") : player}
        </text>
        {/* Team */}
        <text x={cardW*0.5} y={cardH*0.905} textAnchor="middle" fontSize={s.ft} fontWeight="600" fill={series.acc} fontFamily="Arial,sans-serif">
          {(card.team||"").toUpperCase()}
        </text>
        {/* Season */}
        <text x={cardW*0.5} y={cardH*0.945} textAnchor="middle" fontSize={Math.max(5,s.ft-1)} fontWeight="400" fill="rgba(255,255,255,0.5)" fontFamily="Arial,sans-serif">
          {card.season||""}
        </text>

        {/* Rarity glow border */}
        {rs&&<rect width={cardW} height={cardH} rx={s.r} fill="none" stroke={rs.c} strokeWidth="2.5" opacity="0.9" filter={`url(#glow${uid})`}/>}
      </svg>
    </div>
  );
}

/* ─── UI ATOMS ─────────────────────────────────────────────── */
function Spinner({color="#00C853"}) {
  return (
    <div style={{display:"flex",gap:5,justifyContent:"center",padding:"8px"}}>
      {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:color,animation:`sp 1s ${i*.15}s ease-in-out infinite`}}/>)}
      <style>{`@keyframes sp{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

function PriceTag({value, label, highlight=false}) {
  return (
    <div style={{flex:1,textAlign:"center",padding:"12px 8px",background:highlight?C.accentL:C.bg,borderRadius:12,border:highlight?`1.5px solid ${C.accent}`:`1px solid ${C.border}`}}>
      <div style={{fontSize:16,fontWeight:800,color:highlight?C.accent:C.text,fontFamily:FD}}>{eur(value)}</div>
      <div style={{fontSize:11,color:C.sub,marginTop:2}}>{label}</div>
    </div>
  );
}

function ChangePill({value, label}) {
  const v = num(value); if(v===null) return null;
  const up = v>=0;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 12px",background:up?C.accentL:C.redL,borderRadius:10,border:`1px solid ${up?C.accent:C.red}`}}>
      <span style={{fontSize:15,fontWeight:800,color:up?C.accent:C.red,fontFamily:FD}}>{up?"↑":"↓"}{Math.abs(v)}%</span>
      <span style={{fontSize:10,color:C.sub}}>{label}</span>
    </div>
  );
}

function MiniChart({price,changeMonth}) {
  const base=num(price)||50,ch=num(changeMonth)||0,n=10;
  const vals=[];let cur=base*(1-ch/100);
  for(let i=0;i<n;i++){vals.push(Math.max(0.01,cur));cur*=1+(ch/100)/n+(Math.random()-.48)*.03;}
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=Math.max(mx-mn,0.01);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:48}}>
      {vals.map((v,i)=>{
        const h=Math.round(((v-mn)/rng)*72+28);
        const active=i===n-1;
        return <div key={i} style={{flex:1,height:`${h}%`,borderRadius:"3px 3px 0 0",background:active?C.accent:`${C.accent}${Math.round((0.15+i/n*.4)*255).toString(16).padStart(2,"0")}`}}/>;
      })}
    </div>
  );
}

function LangBtn({lang,setLang}) {
  return (
    <div style={{display:"flex",background:C.bg,borderRadius:12,padding:3,gap:2,border:`1px solid ${C.border}`}}>
      {["es","en"].map(l=>(
        <button key={l} onClick={()=>setLang(l)} style={{padding:"5px 10px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:FD,fontSize:10,fontWeight:700,background:lang===l?C.dark:"transparent",color:lang===l?"#fff":C.hint,transition:"all .2s",boxShadow:lang===l?`0 2px 6px ${C.dark}33`:"none"}}>
          {l==="es"?"🇪🇸":"🇬🇧"} {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ─── CARD DETAIL SHEET ───────────────────────────────────────
   Slides up over the phone screen.
   Fetches price on mount — separate from search results.
──────────────────────────────────────────────────────────────── */
function CardSheet({card, onClose, onAdd, isAdded, onAddAlert, lang, onPriceUpdate}) {
  const isES = lang==="es";
  const [price,setPrice]         = useState(null);
  const [loading,setLoading]     = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [ebayOffer,setEbayOffer]   = useState(null);

  const handleRefreshPrice = async () => {
    setRefreshing(true); setEbayOffer(null);
    try {
      const isAuto = /auto/i.test(card.rarity||"");
      const serial = card.serialNumber&&String(card.serialNumber)!=="null"?card.serialNumber:null;
      const q = [card.player,
        card.manufacturer&&card.manufacturer!=="?"?card.manufacturer:"",
        card.collection&&card.collection!=="?"?card.collection:"",
        card.season&&card.season!=="?"?card.season:"",
        isAuto?"auto":"", serial||""
      ].filter(Boolean).join(" ").trim();
      const r = await fetch(`/api/ebay?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      const lastName=(card.player||"").split(" ").slice(-1)[0].toLowerCase();
      const prices=(data.results||[])
        .filter(it=>{
          if(!it.price) return false;
          if(EBAY_BAD_ALWAYS.test(it.title||"")) return false;
          if(!isAuto&&EBAY_BAD_NONAUTO.test(it.title||"")) return false;
          if(!GRADED_PAT.test(it.title||"")) {} else return false; // filtrar gradeadas
          if(lastName.length>=3&&!(it.title||"").toLowerCase().includes(lastName)) return false;
          return true;
        })
        .map(it=>parseEbayPrice(it.price)).filter(p=>p&&isPriceOk(p,card)).sort((a,b)=>a-b);
      const floor=priceFloor(card);
      if(prices.length>=1){
        const median=Math.max(prices[Math.floor(prices.length/2)],floor);
        setEbayOffer({count:prices.length,median,min:Math.max(prices[0],floor),max:prices[prices.length-1],q});
      } else { setEbayOffer({count:0,q}); }
    } catch { setEbayOffer({count:0,error:true}); }
    setRefreshing(false);
  };

  const applyEbayPrice = () => {
    if(!ebayOffer?.median) return;
    const np={priceEur:ebayOffer.median,priceMin:ebayOffer.min,pricePrem:ebayOffer.max,
      priceSource:`eBay · ${ebayOffer.count} anuncio${ebayOffer.count>1?"s":""}`};
    setPrice(np); onPriceUpdate&&onPriceUpdate(np); setEbayOffer(null);
  };

  const t = lang==="es" ? {
    price:"Precio de mercado", searching:"Buscando precio real…",
    noPrice:"Sin precio disponible en eBay ni Cardmarket.",
    min:"Mínimo", mid:"Precio medio", prem:"Premium",
    evo:"Evolución 30 días", ago:"Hace 30d", now:"Hoy",
    summary:"Resumen de mercado", lastWk:"Última semana", lastMo:"Último mes",
    details:"Detalles", add:"+ Añadir a colección", added:"✓ En tu colección",
    source:"Datos: eBay Sold Listings · Cardmarket"
  } : {
    price:"Market price", searching:"Searching real price…",
    noPrice:"No price found on eBay or Cardmarket.",
    min:"Minimum", mid:"Average", prem:"Premium",
    evo:"30-day evolution", ago:"30d ago", now:"Today",
    summary:"Market summary", lastWk:"Last week", lastMo:"Last month",
    details:"Details", add:"+ Add to collection", added:"✓ In collection",
    source:"Data: eBay Sold Listings · Cardmarket"
  };

  // Phase 1: show estimated price from card data immediately (instant)
  // Phase 2: fetch real eBay price in background and update
  const estimatedPrice = card.priceEur ? {
    priceEur: card.priceEur, priceMin: card.priceMin, pricePrem: card.pricePrem,
    priceSource: card._priceSource||"Estimación IA",
    changeWeek: card.changeWeek, changeMonth: card.changeMonth,
    _isEstimate: true,
  } : null;

  useEffect(()=>{
    let alive=true;
    // Si la carta ya tiene precio → mostrarlo directamente, sin buscar en eBay
    if(card.priceEur && card.priceEur > 0) {
      setPrice({
        priceEur: card.priceEur, priceMin: card.priceMin, pricePrem: card.pricePrem,
        priceSource: card.priceSource || card._priceSource || "Precio guardado",
        changeWeek: card.changeWeek, changeMonth: card.changeMonth,
      });
      setLoading(false);
    } else {
      // Sin precio → buscar en eBay automáticamente (primera vez)
      setLoading(true);
      fetchPrice(card)
        .then(p=>{ if(alive && p){ setPrice(p); setLoading(false); } })
        .catch(()=>{ if(alive) setLoading(false); });
    }
    return()=>{alive=false;};
  },[card._uid]);

  const p   = price?.priceEur;
  const mn  = price?.priceMin  ?? (p ? Math.round(p*.78) : null);
  const pr  = price?.pricePrem ?? (p ? Math.round(p*1.32): null);
  const wk  = price?.changeWeek;
  const mo  = price?.changeMonth;
  const pb7 = p&&wk!=null ? Math.round(p/(1+wk/100)) : null;
  const isEstimate = price?._isEstimate;

  const [added,setAdded] = useState(isAdded||false);
  const doAdd = () => {
    if(added)return;
    onAdd({...card,priceEur:p||null,priceMin:mn||null,pricePrem:pr||null,priceSource:price?.priceSource||null,changeWeek:wk,changeMonth:mo,_uid:card._uid||`uid_${Date.now()}`});
    setAdded(true);
  };

  const rs = RARITY_STYLE(card.rarity||"");

  return (
    <div style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column",overflow:"hidden",background:C.white}}>
      {/* Handle bar */}
      <div style={{flexShrink:0,paddingTop:12,display:"flex",justifyContent:"center"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2}}/>
      </div>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px 12px",flexShrink:0}}>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:C.bg2,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:C.sub}}>‹</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text,lineHeight:1.1}}>{card.player}</div>
          <div style={{fontSize:12,color:C.sub,marginTop:2}}>{card.team}{card.season?` · ${card.season}`:""}</div>
        </div>
        {rs&&<div style={{background:C.goldL,border:`1px solid ${C.gold}`,borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:C.gold}}>{rs.label}</div>}
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {/* Card + price hero */}
        <div style={{background:`linear-gradient(180deg,${C.bg},${C.white})`,padding:"16px 18px",display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flexShrink:0}}>
            <CardViz card={card} photo={card._thumb||null} sz="lg" imgUrl={card._fromEbay?card._ebayImg:null}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:C.sub,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{t.price}</div>
            {loading && !price ? (
              <div>
                <Spinner/>
                <div style={{fontSize:11,color:C.hint,textAlign:"center",marginTop:4}}>{t.searching}</div>
              </div>
            ) : p ? (
              <>
                <div style={{fontFamily:FD,fontSize:30,fontWeight:800,color:C.text,lineHeight:1}}>{eur(p)}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  {price?.priceSource&&<span style={{fontSize:10,color:isEstimate?"#f59e0b":C.accent,fontWeight:600}}>{isEstimate?"⏳ Estimación IA — actualizando…":"📊 "+price.priceSource}</span>}
                  {loading&&!isEstimate&&<span style={{fontSize:9,color:C.hint}}>Verificando en eBay…</span>}
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <ChangePill value={wk} label="7d"/>
                  <ChangePill value={mo} label="30d"/>
                </div>
              </>
            ) : (
              <div style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{t.noPrice}</div>
            )}
          </div>
        </div>

        <div style={{padding:"0 18px 24px"}}>
          {/* Price grid */}
          {p&&<div style={{display:"flex",gap:8,marginBottom:16}}>
            <PriceTag value={mn} label={t.min}/>
            <PriceTag value={p}  label={t.mid} highlight/>
            <PriceTag value={pr} label={t.prem}/>
          </div>}

          {/* Chart */}
          <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,color:C.sub,fontWeight:600}}>{t.evo}</span>
              {mo!=null&&<span style={{fontSize:12,fontWeight:800,color:mo>=0?C.accent:C.red,fontFamily:FD}}>{mo>=0?"↑":"↓"}{Math.abs(mo)}%</span>}
            </div>
            {(!price && loading) ? <div style={{height:48,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div> : <MiniChart price={p||50} changeMonth={mo}/>}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:C.hint}}>
              <span>{t.ago}</span><span>{t.now}</span>
            </div>
          </div>

          {/* Market summary */}
          {(wk!=null||mo!=null)&&(
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
              <div style={{fontSize:12,color:C.sub,fontWeight:600,marginBottom:10}}>{t.summary}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:pb7&&p?10:0}}>
                <ChangePill value={wk} label={t.lastWk}/>
                <ChangePill value={mo} label={t.lastMo}/>
              </div>
              {pb7&&p&&<div style={{fontSize:12,color:C.sub,textAlign:"center",lineHeight:1.7,background:C.bg,borderRadius:10,padding:"10px",marginTop:10}}>
                <div>Hace 7d: <strong style={{color:C.text}}>{eur(pb7)}</strong></div>
                <div>Variación: <strong style={{color:wk>=0?C.accent:C.red}}>{wk>=0?"+":""}{eur(Math.round(p-pb7))}</strong></div>
              </div>}
            </div>
          )}

          {/* Details */}
          <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
            <div style={{fontSize:12,color:C.sub,fontWeight:600,marginBottom:10}}>{t.details}</div>
            {[
              ["Jugador",card.player],["Equipo",card.team],["Temporada",card.season],
              ["Fabricante",card.manufacturer],["Colección",card.collection],
              ["Rareza",card.rarity||"Base"],["Número",card.cardNumber],["Condición",card.condition]
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.sub}}>{k}</span>
                <span style={{fontSize:13,color:C.text,fontWeight:600,textAlign:"right",maxWidth:"55%"}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Add button */}
          <button onClick={doAdd} disabled={added} style={{width:"100%",padding:"15px",background:added?C.accentL:C.accent,border:added?`1.5px solid ${C.accent}`:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:added?C.accent:"#fff",cursor:added?"default":"pointer",transition:"all .2s",marginBottom:8}}>
            {added?t.added:t.add}
          </button>
          {/* Ver en eBay (enlace de afiliado) */}
          <button onClick={()=>window.open(ebayLinkFor(card),"_blank","noopener")} style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#0064D2,#0053AE)",border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8,boxShadow:"0 6px 18px rgba(0,100,210,0.4)"}}>
            🛒 {lang==="es"?"Comprar en eBay":"Buy on eBay"}
          </button>
          <div style={{fontSize:10,color:C.hint,textAlign:"center",marginTop:6}}>{lang==="es"?"Enlace de afiliado · CardGoal puede recibir una comisión":"Affiliate link · CardGoal may earn a commission"}</div>
          {/* WhatsApp share */}
          <button onClick={()=>{
            const p2=price?.priceEur;
            const txt=`🃏 ${card.player}\n📦 ${card.collection||card.manufacturer||""} ${card.rarity||""}\n💶 ${p2?eur(p2):"Sin precio"}\n\nValorado con CardGoal ⚽\nhttps://cardgoal-hew7.vercel.app`;
            window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,"_blank");
          }} style={{width:"100%",padding:"12px",background:"#25D366",border:"none",borderRadius:14,fontFamily:FD,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
            📲 Compartir por WhatsApp
          </button>

          {/* Price alert */}
          {price?.priceEur&&(
            <button onClick={()=>{
              const target=window.prompt(`Alerta para ${card.player}\n\n¿Avisarte cuando baje de cuántos €?`);
              if(target&&!isNaN(target)){
                onAddAlert&&onAddAlert(card,parseFloat(target));
                window.alert(`✅ Alerta creada para ${card.player} por debajo de ${target}€`);
              }
            }} style={{width:"100%",padding:"12px",background:C.blueL,border:`1.5px solid ${C.blue}`,borderRadius:14,fontFamily:FD,fontSize:13,fontWeight:700,color:C.blue,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
              🔔 Alerta de precio
            </button>
          )}

          <div style={{fontSize:10,color:C.hint,textAlign:"center",marginTop:10}}>{t.source}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── GRADE SHEET ─────────────────────────────────────────── */
function GradeSheet({lang,setLang,userId,isPremium,onPaywall,gate,tally}) {
  const [ph,setPh]=useState("idle");
  const [durl,setDurl]=useState(null);
  const [res,setRes]=useState(null);
  const [err,setErr]=useState("");
  const fileRef=useRef();
  const reset=()=>{setPh("idle");setDurl(null);setRes(null);setErr("");if(fileRef.current)fileRef.current.value="";};
  const process=useCallback(async file=>{
    if(!file||!file.type.startsWith("image/"))return;
    if(gate && !gate("grade")) return;           // límite invitado (3) → registro
    const compressed = await compressImage(file);
    const d = compressed || await toDataURL(file);
    setDurl(d);setPh("grading");
    try{const g=await gradeCard(d.split(",")[1],"image/jpeg",lang);setRes(g);setPh("result");tally && tally("grade");}
    catch(e){setErr(e.message||"Error");setPh("error");}
  },[lang,gate,tally]);

  const isES=lang==="es";
  const T={
    title:isES?"Análisis de Grado PSA":"PSA Grade Analysis",
    sub:isES?"Analiza tu carta como un grader profesional":"Analyze your card like a professional grader",
    btn:isES?"🔬 Analizar mi carta":"🔬 Analyze my card",
    upload:isES?"Subir imagen":"Upload image",
    analyzing:isES?"Analizando con IA…":"Analyzing with AI…",
    grade:isES?"Grado predicho PSA":"Predicted PSA grade",
    worth:isES?"✓ Recomendado gradear":"✓ Recommended to grade",
    noWorth:isES?"✗ No recomendado":"✗ Not recommended",
    breakdown:isES?"Desglose":"Score breakdown",
    centering:isES?"📐 Centrado":"📐 Centering",
    corners:isES?"🔲 Esquinas":"🔲 Corners",
    edges:isES?"📏 Bordes":"📏 Edges",
    surface:isES?"✨ Superficie":"✨ Surface",
    detail:isES?"Análisis detallado":"Detailed analysis",
    factor:isES?"⚠️ Factor limitante":"⚠️ Limiting factor",
    value:isES?"Análisis de valor":"Value analysis",
    raw:isES?"Sin gradear":"Ungraded",
    cost:isES?"Coste:":"Cost:",
    profit:isES?"Beneficio neto:":"Net profit:",
    rec:isES?"Recomendación":"Recommendation",
    another:isES?"Analizar otra carta":"Analyze another card",
    note:isES?"Estimación orientativa ±0.5 puntos PSA":"Estimated ±0.5 PSA points",
    tryAgain:isES?"Intentar de nuevo":"Try again",
  };

  function Gauge({score,label}){
    const v=num(score)||0;const pct=Math.max(0,Math.min(1,v/10));
    const color=pct>=0.9?C.accent:pct>=0.7?C.gold:pct>=0.5?"#ff8c00":C.red;
    return(<div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.sub}}>{label}</span><span style={{fontFamily:FD,fontWeight:800,color,fontSize:13}}>{v.toFixed(1)}</span></div><div style={{height:7,background:C.bg,borderRadius:4,overflow:"hidden",border:`1px solid ${C.border}`}}><div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:4,transition:"width .6s ease"}}/></div></div>);
  }

  function GradeCircle({grade}){
    const g=num(grade)||0;
    const color=g>=9.5?C.accent:g>=9?"#22c55e":g>=8?C.gold:g>=7?"#ff8c00":g>=5?"#f97316":C.red;
    const lbl=g>=9.5?"GEM MT":g>=9?"MINT":g>=8?"NM-MT":g>=7?"NM":g>=6?"EX-MT":g>=5?"EX":"POOR";
    return(<div style={{textAlign:"center"}}><div style={{width:96,height:96,borderRadius:"50%",border:`4px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",background:C.white,margin:"0 auto",boxShadow:`0 0 0 4px ${color}22`}}><div style={{fontFamily:FD,fontSize:34,fontWeight:800,color,lineHeight:1}}>{g}</div></div><div style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:6}}>{lbl}</div></div>);
  }

  if(ph==="idle")return(
    <div style={{flex:1,overflowY:"auto"}}>
      <div style={{padding:"20px 18px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{T.title}</div>
          <div style={{fontSize:13,color:C.sub,marginTop:4}}>{T.sub}</div>
        </div>
        <LangBtn lang={lang} setLang={setLang}/>
      </div>
      <div style={{padding:"0 18px 24px",display:"flex",flexDirection:"column",gap:12}}>
        {[["📐","Centrado/Centering","¿La imagen está centrada en los bordes?"],["🔲","Esquinas/Corners","¿Las 4 esquinas sin desgaste?"],["📏","Bordes/Edges","¿Bordes limpios sin muescas?"],["✨","Superficie/Surface","¿Sin arañazos ni manchas?"]].map(([ic,k,v])=>(
          <div key={k} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:12,alignItems:"center",boxShadow:C.shadow}}>
            <span style={{fontSize:24,flexShrink:0}}>{ic}</span>
            <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{k}</div><div style={{fontSize:12,color:C.sub,marginTop:2}}>{v}</div></div>
          </div>
        ))}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files?.[0])}/>
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"16px",background:C.gold,border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:4}}>
          {T.btn}
        </button>
        <button onClick={()=>{if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();}}} style={{width:"100%",padding:"13px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,fontFamily:FD,fontSize:14,fontWeight:700,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          🖼️ {T.upload}
        </button>
      </div>
    </div>
  );

  if(ph==="grading")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:20}}>
      {durl&&<div style={{width:150,height:210,borderRadius:14,overflow:"hidden",border:`3px solid ${C.gold}`,boxShadow:`0 0 24px ${C.gold}44`}}><img src={durl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
      <Spinner color={C.gold}/>
      <div style={{fontSize:13,color:C.sub,textAlign:"center"}}>{T.analyzing}</div>
    </div>
  );

  if(ph==="error")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16,textAlign:"center"}}>
      <div style={{fontSize:48}}>😕</div>
      <div style={{fontSize:14,color:C.text,fontWeight:700}}>{err}</div>
      <button onClick={reset} style={{padding:"13px 28px",background:C.gold,border:"none",borderRadius:12,fontFamily:FD,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>{T.tryAgain}</button>
    </div>
  );

  if(ph==="result"&&res)return(
    <div style={{flex:1,overflowY:"auto"}}>
      <div style={{padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <button onClick={reset} style={{background:"none",border:"none",fontSize:13,color:C.sub,cursor:"pointer",fontFamily:FD}}>‹ {T.another}</button>
        <LangBtn lang={lang} setLang={setLang}/>
      </div>
      <div style={{padding:"20px 18px"}}>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20}}>
          {durl&&<div style={{width:100,height:140,borderRadius:10,overflow:"hidden",border:`2px solid ${C.gold}`,boxShadow:`0 0 16px ${C.gold}33`,flexShrink:0}}><img src={durl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <GradeCircle grade={res.predictedGrade}/>
            <div style={{fontSize:11,color:C.sub,textAlign:"center"}}>{T.grade}</div>
            {res.worthGrading!=null&&<div style={{background:res.worthGrading?C.accentL:C.redL,border:`1px solid ${res.worthGrading?C.accent:C.red}`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,color:res.worthGrading?C.accent:C.red}}>{res.worthGrading?T.worth:T.noWorth}</div>}
          </div>
        </div>

        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{T.breakdown}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Gauge score={res.centering} label={T.centering}/>
            <Gauge score={res.corners}   label={T.corners}/>
            <Gauge score={res.edges}     label={T.edges}/>
            <Gauge score={res.surface}   label={T.surface}/>
          </div>
        </div>

        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{T.detail}</div>
          {[[T.centering,res.centeringDetail],[T.corners,res.cornersDetail],[T.edges,res.edgesDetail],[T.surface,res.surfaceDetail]].filter(([,v])=>v).map(([k,v])=>(
            <div key={k} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>{k}</div>
              <div style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{v}</div>
            </div>
          ))}
          {res.mainIssue&&<div style={{background:C.redL,border:`1px solid ${C.red}44`,borderRadius:10,padding:"10px"}}><div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:3}}>{T.factor}</div><div style={{fontSize:12,color:C.sub}}>{res.mainIssue}</div></div>}
        </div>

        {(res.rawValue||res.gradedValue)&&<div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{T.value}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{background:C.bg,borderRadius:12,padding:"12px",textAlign:"center",border:`1px solid ${C.border}`}}><div style={{fontSize:11,color:C.sub,marginBottom:4}}>{T.raw}</div><div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:C.text}}>{eur(res.rawValue)}</div></div>
            <div style={{background:C.accentL,borderRadius:12,padding:"12px",textAlign:"center",border:`1px solid ${C.accent}`}}><div style={{fontSize:11,color:C.accent,marginBottom:4}}>{res.gradedValueLabel||"PSA"}</div><div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:C.accent}}>{eur(res.gradedValue)}</div></div>
          </div>
          {res.gradingCost&&<div style={{fontSize:12,color:C.sub,textAlign:"center"}}>{T.cost} <strong style={{color:C.text}}>{eur(res.gradingCost)}</strong>{res.rawValue&&res.gradedValue&&<> · {T.profit} <strong style={{color:res.gradedValue-res.rawValue-res.gradingCost>0?C.accent:C.red}}>{eur(res.gradedValue-res.rawValue-res.gradingCost)}</strong></>}</div>}
        </div>}

        {res.recommendation&&<div style={{background:res.worthGrading?C.accentL:C.redL,border:`1px solid ${res.worthGrading?C.accent:C.red}`,borderRadius:14,padding:"14px",marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:res.worthGrading?C.accent:C.red,textTransform:"uppercase",marginBottom:6}}>{T.rec}</div><div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>{res.recommendation}</div></div>}
        <div style={{background:C.bg,borderRadius:10,padding:"10px",fontSize:11,color:C.hint,textAlign:"center"}}>{T.note}</div>
      </div>
    </div>
  );
  return null;
}

/* ═══════════════════════════════════════════════════════════
   SCREENS
═══════════════════════════════════════════════════════════ */

/* HOME */
/* ═══════════════════════════════════════════════════════════
   AUTH SCREEN — Login / Register
═══════════════════════════════════════════════════════════ */
/* Modal con los Términos y la Política de Privacidad */
function LegalModal({ onClose, lang }){
  const S = ({title,children}) => (
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:FD,fontSize:14,fontWeight:800,color:C.text,marginBottom:5}}>{title}</div>
      <div style={{fontSize:13,color:C.sub,lineHeight:1.6}}>{children}</div>
    </div>
  );
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,width:"100%",maxWidth:480,maxHeight:"86vh",overflowY:"auto",borderRadius:20,padding:"22px 22px 28px",color:C.text}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,position:"sticky",top:0,background:C.white,paddingBottom:8}}>
          <div style={{fontFamily:FD,fontSize:18,fontWeight:800}}>Términos y Privacidad</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,color:C.sub,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        <S title="1. Quiénes somos">CardGoal (cardgoal.es) es una aplicación para valorar y llevar el control de tu colección de cromos de fútbol. Para cualquier cuestión puedes escribirnos a infocardgoal@gmail.com.</S>
        <S title="2. El servicio">CardGoal te permite buscar, escanear y guardar cromos, y ver una estimación de su valor de mercado. Los precios son <strong>orientativos</strong>, se basan en datos de mercado (como eBay) y no constituyen una garantía ni asesoramiento de inversión.</S>
        <S title="3. Datos que tratamos">Para crear tu cuenta tratamos tu <strong>email</strong> y tu <strong>contraseña</strong> (guardada cifrada). También guardamos los <strong>cromos y fotos</strong> que añades a tu colección. No pedimos más datos personales.</S>
        <S title="4. Para qué los usamos">Para crear y gestionar tu cuenta, guardar tu colección, enviarte el email de bienvenida y, <strong>solo si lo aceptas</strong>, enviarte emails con novedades, cambios de precio y ofertas.</S>
        <S title="5. Proveedores">Usamos servicios de terceros para funcionar: Supabase (cuentas y base de datos), Resend (envío de emails) y Anthropic (IA para identificar y valorar cromos). Tus datos se tratan conforme a sus políticas.</S>
        <S title="6. Emails comerciales">Solo te enviamos emails comerciales si marcaste la casilla correspondiente al registrarte. Puedes <strong>darte de baja en cualquier momento</strong> desde el enlace del propio email o escribiéndonos.</S>
        <S title="7. Enlaces de afiliado">Algunos enlaces a eBay son de afiliado: si compras a través de ellos, CardGoal puede recibir una pequeña comisión, <strong>sin ningún coste extra para ti</strong>.</S>
        <S title="8. Tus derechos">Puedes acceder, corregir o eliminar tus datos y tu cuenta cuando quieras escribiéndonos a infocardgoal@gmail.com. También puedes borrar cromos de tu colección directamente en la app.</S>
        <S title="9. Conservación">Conservamos tus datos mientras mantengas la cuenta. Si la eliminas, borramos los datos asociados.</S>
        <S title="10. Cambios">Podemos actualizar estos términos; te avisaremos de los cambios relevantes.</S>

        <div style={{fontSize:11,color:C.hint,marginTop:8}}>Última actualización: junio de 2026 · Contacto: infocardgoal@gmail.com</div>
      </div>
    </div>
  );
}

/* Pop-up que pide una propina (Ko-fi) a usuarios que usan mucho la app */
function TipModal({ lang, onClose }){
  const isES = lang==="es";
  const open=()=>{ window.open("https://ko-fi.com/cardgoal","_blank","noopener"); onClose(); };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:420,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,width:"100%",maxWidth:380,borderRadius:22,padding:"26px 24px 24px",color:C.text,textAlign:"center"}}>
        <div style={{fontSize:46,marginBottom:10}}>☕</div>
        <div style={{fontFamily:FD,fontSize:20,fontWeight:800,marginBottom:8}}>{isES?"¿Te gusta CardGoal?":"Enjoying CardGoal?"}</div>
        <div style={{fontSize:14,color:C.sub,lineHeight:1.6,marginBottom:20}}>{isES?"Es gratis y sin anuncios molestos. Si te está siendo útil, invítanos a un café y nos ayudas a mantenerla en marcha 🙏":"It's free and ad-free. If it's useful to you, buy us a coffee to help keep it running 🙏"}</div>
        <button onClick={open} style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#FF6B6B,#E8484A)",border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:"0 6px 18px rgba(232,72,74,0.4)",marginBottom:8}}>
          {isES?"Apoyar con una propina":"Support with a tip"}
        </button>
        <button onClick={onClose} style={{width:"100%",padding:"10px",background:"none",border:"none",fontSize:13,color:C.sub,cursor:"pointer",fontWeight:600}}>
          {isES?"Ahora no":"Not now"}
        </button>
      </div>
    </div>
  );
}

/* Colección cuando el usuario aún no tiene cuenta — invita a registrarse */
function UpdateModal({onClose}) {
  const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const steps = isIOS ? [
    ["1","Mantén pulsado el icono de CardGoal"],
    ["2","Toca «Eliminar app» → «Eliminar»"],
    ["3","Abre Safari y ve a cardgoal.es"],
    ["4","Toca Compartir → «Añadir a inicio»"],
  ] : isAndroid ? [
    ["1","Cierra la app completamente"],
    ["2","Abre Chrome y ve a cardgoal.es"],
    ["3","Toca los 3 puntos → «Añadir a pantalla inicio»"],
    ["4","Confirma y ya tienes la versión nueva"],
  ] : [
    ["1","Cierra la app y vuelve a abrirla"],
    ["2","O pulsa «Actualizar ahora» para recargar"],
  ];
  const platform = isIOS?"📱 iPhone":isAndroid?"🤖 Android":"💻 Navegador";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.bg2,border:`1px solid ${C.accent}`,borderRadius:20,padding:24,maxWidth:360,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:40,marginBottom:8}}>✨</div>
          <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>Nueva versión disponible</div>
          <div style={{fontSize:13,color:C.sub,marginTop:6}}>CardGoal ha sido actualizado</div>
        </div>
        <div style={{background:C.bg3,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:10}}>{platform} — cómo actualizar:</div>
          {steps.map(([n,txt])=>(
            <div key={n} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:11,fontWeight:800,color:"#000"}}>{n}</span>
              </div>
              <span style={{fontSize:12,color:C.text}}>{txt}</span>
            </div>
          ))}
        </div>
        <button onClick={()=>window.location.reload()}
          style={{width:"100%",padding:"13px",background:C.accent,border:"none",borderRadius:12,fontFamily:FD,fontSize:14,fontWeight:800,color:"#000",cursor:"pointer",marginBottom:8}}>
          🔄 Actualizar ahora
        </button>
        <button onClick={onClose}
          style={{width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,fontFamily:FD,fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer"}}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function GuestCollectionCTA({ lang, onRegister }){
  const isES = lang==="es";
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"40px 28px"}}>
      <div style={{width:84,height:84,borderRadius:24,background:C.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,marginBottom:16}}>🗂️</div>
      <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:C.text,marginBottom:8}}>{isES?"Guarda tu colección":"Save your collection"}</div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.6,maxWidth:330,marginBottom:20}}>{isES?"Crea una cuenta gratis para guardar tus cromos y ver el valor total de tu colección desde cualquier dispositivo.":"Create a free account to save your cards and see your collection's total value on any device."}</div>
      <button onClick={onRegister} style={{padding:"15px 30px",background:C.accent,border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:`0 6px 18px ${C.accent}55`}}>
        {isES?"Crear cuenta gratis":"Create free account"}
      </button>
    </div>
  );
}

function AuthScreen({onAuth, lang, onClose}) {
  const [mode,setMode]   = useState("login"); // login | register
  const [email,setEmail] = useState("");
  const [pass,setPass]   = useState("");
  const [err,setErr]     = useState("");
  const [loading,setLoading] = useState(false);
  const [terms,setTerms]   = useState(false);   // acepta términos (obligatorio)
  const [marketing,setMarketing] = useState(false); // acepta emails comerciales (opcional)
  const [showLegal,setShowLegal] = useState(false);
  const isES = lang==="es";

  const handle = async () => {
    const em = email.trim();
    const pw = pass.trim();
    if(!em||!pw) { setErr(isES?"Rellena email y contraseña":"Fill in email and password"); return; }
    if(pw.length < 6) { setErr(isES?"La contraseña debe tener al menos 6 caracteres":"Password must be at least 6 characters"); return; }
    if(mode==="register" && !terms) { setErr(isES?"Debes aceptar los términos para registrarte":"You must accept the terms to sign up"); return; }
    setLoading(true); setErr("");
    try {
      let res;
      if(mode==="register") {
        res = await supa.signUp(em, pw, { terms_accepted:true, marketing_consent:marketing, consent_at:new Date().toISOString() });
        if(res.error) {
          setErr(res.error.message||"Error al registrarse");
          setLoading(false); return;
        }
        // Email de bienvenida (no bloquea el registro si falla)
        try { fetch("/api/welcome",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em})}); } catch {}
        // If email confirmation required, just switch to login with success message
        if(res.user && !res.session) {
          setMode("login");
          setErr(isES?"✅ ¡Cuenta creada! Ya puedes entrar con tu email y contraseña.":"✅ Account created! You can now sign in.");
          setLoading(false); return;
        }
        // Auto login after register if no confirmation needed
        res = await supa.signIn(em, pw);
      } else {
        res = await supa.signIn(em, pw);
      }
      if(res.error) {
        const msg = res.error.message||"";
        if(msg.includes("Email not confirmed")) {
          setErr(isES?"Tu cuenta está pendiente de activación. Contacta con soporte en cardgoal.es":"Your account is pending activation. Contact support at cardgoal.es");
        } else if(msg.includes("Invalid login")) {
          setErr(isES?"Email o contraseña incorrectos":"Wrong email or password");
        } else {
          setErr(msg||"Error");
        }
        setLoading(false); return;
      }
      if(res.access_token) {
        onAuth({token: res.access_token, refreshToken: res.refresh_token, email: res.user?.email||em, id: res.user?.id});
      } else {
        setErr(isES?"No se pudo iniciar sesión. Inténtalo de nuevo.":"Could not sign in. Please try again.");
      }
    } catch(e) { setErr(e.message||"Error de conexión"); }
    setLoading(false);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",background:C.bg,position:"relative",minHeight:"100vh"}}>
      {onClose&&<button onClick={onClose} style={{position:"absolute",top:18,right:18,width:40,height:40,borderRadius:12,background:C.bg3,border:`1px solid ${C.border}`,color:C.sub,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>}
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${C.bg3},${C.bg2})`,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px",boxShadow:C.shadowM}}>⚽</div>
        <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:C.white,letterSpacing:"-0.02em"}}>CardGoal</div>
        <div style={{fontSize:13,color:C.sub,marginTop:6}}>{isES?"Crea tu cuenta gratis para guardar tu colección":"Create your free account to save your collection"}</div>
      </div>

      {/* Toggle */}
      <div style={{display:"flex",background:C.bg3,borderRadius:14,padding:4,gap:4,marginBottom:24,width:"100%",maxWidth:320}}>
        {[["login",isES?"Entrar":"Sign in"],["register",isES?"Registrarse":"Sign up"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:FD,fontSize:13,fontWeight:700,background:mode===m?C.accent:"transparent",color:mode===m?C.bg:C.sub,transition:"all .2s"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",gap:12}}>
        <input
          type="email" placeholder={isES?"tu@email.com":"your@email.com"}
          value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handle()}
          style={{width:"100%",padding:"14px 16px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,fontSize:14,color:C.white,outline:"none",fontFamily:FB,boxSizing:"border-box"}}
        />
        <input
          type="password" placeholder={isES?"Contraseña":"Password"}
          value={pass} onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handle()}
          style={{width:"100%",padding:"14px 16px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,fontSize:14,color:C.white,outline:"none",fontFamily:FB,boxSizing:"border-box"}}
        />

        {mode==="register"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:2}}>
            <label style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
              <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} style={{marginTop:2,width:18,height:18,accentColor:C.accent,flexShrink:0}}/>
              <span style={{fontSize:12,color:C.sub,lineHeight:1.5}}>
                {isES?"Acepto los ":"I accept the "}
                <span onClick={e=>{e.preventDefault();e.stopPropagation();setShowLegal(true);}} style={{color:C.accent,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>{isES?"términos y la política de privacidad":"terms and privacy policy"}</span>.
              </span>
            </label>
            <label style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
              <input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)} style={{marginTop:2,width:18,height:18,accentColor:C.accent,flexShrink:0}}/>
              <span style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{isES?"Quiero recibir emails con novedades, subidas de precio y ofertas. Puedo darme de baja cuando quiera.":"I want to receive emails with news, price alerts and offers. I can unsubscribe anytime."}</span>
            </label>
          </div>
        )}

        {err&&<div style={{
          background: err.startsWith("✅") ? "rgba(0,230,118,0.12)" : "rgba(255,82,82,0.12)",
          border: `1px solid ${err.startsWith("✅") ? C.accent+"66" : C.red+"44"}`,
          borderRadius:10,padding:"10px 14px",fontSize:12,
          color: err.startsWith("✅") ? C.accent : C.red
        }}>{err}</div>}

        <button onClick={handle} disabled={loading||!email.trim()||!pass.trim()||(mode==="register"&&!terms)} style={{width:"100%",padding:"15px",background:email.trim()&&pass.trim()&&(mode!=="register"||terms)?C.accent:C.bg3,border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:email.trim()&&pass.trim()&&(mode!=="register"||terms)?C.bg:C.hint,cursor:email.trim()&&pass.trim()&&(mode!=="register"||terms)?"pointer":"default",transition:"all .2s",marginTop:4}}>
          {loading?"...":(mode==="login"?(isES?"Entrar →":"Sign in →"):(isES?"Crear cuenta →":"Create account →"))}
        </button>

        {mode==="login"&&<div style={{textAlign:"center",fontSize:12,color:C.sub,marginTop:4}}>
          {isES?"¿No tienes cuenta? ":"No account? "}
          <span onClick={()=>setMode("register")} style={{color:C.accent,cursor:"pointer",fontWeight:600}}>{isES?"Regístrate":"Sign up"}</span>
        </div>}
      </div>

      <div style={{marginTop:32,fontSize:11,color:C.hint,textAlign:"center",maxWidth:280,lineHeight:1.6}}>
        {isES?"Al registrarte aceptas nuestros ":"By signing up you accept our "}
        <span onClick={()=>setShowLegal(true)} style={{color:C.sub,textDecoration:"underline",cursor:"pointer"}}>{isES?"términos y privacidad":"terms and privacy"}</span>.
        {isES?" Tu colección se guarda de forma segura en la nube.":" Your collection is securely saved in the cloud."}
      </div>

      {showLegal&&<LegalModal lang={lang} onClose={()=>setShowLegal(false)}/>}
    </div>
  );
}

/* Aviso para instalar la PWA en el móvil */
function InstallPrompt({ lang, deferred }){
  const isES = lang==="es";
  const [show,setShow]=useState(false);
  const [ios,setIos]=useState(false);
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const standalone = (window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
    if(standalone){ setShow(false); return; }            // ya instalada
    try{ if(localStorage.getItem("cg_install_dismiss")==="1"){ setShow(false); return; } }catch{}
    const ua = window.navigator.userAgent||"";
    const isIos = /iphone|ipad|ipod/i.test(ua);
    setIos(isIos);
    setShow(isIos || !!deferred);                          // iOS: instrucciones; Android: si hay evento
  },[deferred]);
  const dismiss=()=>{ setShow(false); try{localStorage.setItem("cg_install_dismiss","1");}catch{} };
  const install=async()=>{ if(!deferred) return; try{ deferred.prompt(); await deferred.userChoice; }catch{} dismiss(); };
  if(!show) return null;
  return (
    <div style={{margin:"10px 14px 0",background:C.accentL,border:`1px solid ${C.accent}55`,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:26}}>📲</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:FD,fontSize:13,fontWeight:800,color:C.text}}>{isES?"Instala CardGoal en tu móvil":"Install CardGoal on your phone"}</div>
        <div style={{fontSize:11,color:C.sub,marginTop:2,lineHeight:1.4}}>
          {ios
            ? (isES?"Pulsa Compartir ⬆️ abajo y luego \u201cAñadir a pantalla de inicio\u201d":"Tap Share ⬆️ then \u201cAdd to Home Screen\u201d")
            : (isES?"Tenla siempre a mano, sin ocupar espacio.":"Keep it handy, no storage needed.")}
        </div>
      </div>
      {!ios&&<button onClick={install} style={{padding:"8px 14px",background:C.accent,border:"none",borderRadius:10,fontFamily:FD,fontSize:12,fontWeight:800,color:"#fff",cursor:"pointer",whiteSpace:"nowrap"}}>{isES?"Instalar":"Install"}</button>}
      <button onClick={dismiss} aria-label="cerrar" style={{background:"none",border:"none",color:C.sub,fontSize:18,cursor:"pointer",lineHeight:1,padding:4}}>✕</button>
    </div>
  );
}

/* Pop-up con explicación de cómo instalar la app */
function InstallModal({ lang, deferred, onClose }){
  const isES = lang==="es";
  const install=async()=>{ if(!deferred) return; try{ deferred.prompt(); await deferred.userChoice; }catch{} onClose(); };
  const Step=({n,children})=>(
    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
      <div style={{flexShrink:0,width:22,height:22,borderRadius:"50%",background:C.accent,color:"#fff",fontFamily:FD,fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</div>
      <div style={{fontSize:14,color:C.text,lineHeight:1.5,paddingTop:1}}>{children}</div>
    </div>
  );
  const Section=({icon,title,children})=>(
    <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:24}}>{icon}</span>
        <span style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{title}</span>
      </div>
      {children}
    </div>
  );
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,width:"100%",maxWidth:440,maxHeight:"88vh",overflowY:"auto",borderRadius:22,padding:"24px 22px",color:C.text,boxShadow:"0 24px 70px rgba(0,0,0,0.45)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontFamily:FD,fontSize:21,fontWeight:800}}>📲 {isES?"Instala CardGoal":"Install CardGoal"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:26,color:C.sub,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{fontSize:14,color:C.sub,marginBottom:20,lineHeight:1.5}}>
          {isES?"Ténla en tu pantalla de inicio como una app normal, sin pasar por ninguna tienda. Elige tu móvil:":"Add it to your home screen like a normal app, no store needed. Pick your phone:"}
        </div>

        {deferred && (
          <button onClick={install} style={{width:"100%",padding:"15px",background:`linear-gradient(135deg,${C.accent},#04A857)`,border:"none",borderRadius:14,fontFamily:FD,fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",marginBottom:18,boxShadow:`0 6px 18px ${C.accent}55`}}>
            {isES?"⚡ Instalar ahora (Android)":"⚡ Install now (Android)"}
          </button>
        )}

        <Section icon="🤖" title="Android">
          {deferred
            ? <div style={{fontSize:14,color:C.text,lineHeight:1.5}}>{isES?<>Pulsa el botón verde <b>"Instalar ahora"</b> de arriba 👆</>:<>Tap the green <b>"Install now"</b> button above 👆</>}</div>
            : <>
                <Step n="1">{isES?<>Pulsa el menú <b>⋮</b> (arriba a la derecha del navegador Chrome).</>:<>Tap the <b>⋮</b> menu (top-right in Chrome).</>}</Step>
                <Step n="2">{isES?<>Pulsa <b>"Instalar aplicación"</b> o <b>"Añadir a pantalla de inicio"</b>.</>:<>Tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.</>}</Step>
              </>}
        </Section>

        <Section icon="🍎" title="iPhone (Safari)">
          <Step n="1">{isES?<>Pulsa el botón <b>Compartir</b> ⬆️ (en la barra de abajo de Safari).</>:<>Tap the <b>Share</b> button ⬆️ (Safari bottom bar).</>}</Step>
          <Step n="2">{isES?<>Desliza hacia abajo y pulsa <b>"Añadir a pantalla de inicio"</b>.</>:<>Scroll down and tap <b>"Add to Home Screen"</b>.</>}</Step>
          <Step n="3">{isES?<>Pulsa <b>"Añadir"</b> arriba a la derecha. ¡Ya está! 🎉</>:<>Tap <b>"Add"</b> top-right. Done! 🎉</>}</Step>
        </Section>
      </div>
    </div>
  );
}

function Home({col, nav, lang, isPremium, user, onInstallClick}) {
  const total = col.reduce((s,c)=>s+(num(c.priceEur)||num(c.price)||0),0);
  const raras = col.filter(c=>c.rarity&&!["base","Base","base card"].includes(c.rarity)).length;
  const isES = lang==="es";

  return (
    <div style={{flex:1,overflowY:"auto",background:C.bg,paddingBottom:24,color:C.text}}>

      {/* Hero portfolio card — dark premium */}
      <div style={{margin:"20px 16px 0",background:`linear-gradient(135deg,#1A2035 0%,#0D1525 100%)`,borderRadius:24,padding:"28px 24px",position:"relative",overflow:"hidden",boxShadow:C.shadowL}}>
        {/* Decorative circles */}
        <div style={{position:"absolute",right:-40,top:-40,width:180,height:180,borderRadius:"50%",background:"rgba(5,193,104,0.08)"}}/>
        <div style={{position:"absolute",right:20,bottom:-50,width:120,height:120,borderRadius:"50%",background:"rgba(5,193,104,0.05)"}}/>
        <div style={{position:"absolute",left:-20,bottom:-20,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.03)"}}/>

        {/* Label */}
        <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,marginBottom:8}}>{isES?"Valor total del portfolio":"Total portfolio value"}</div>

        {/* Amount */}
        <div style={{fontFamily:FD,fontSize:42,fontWeight:800,color:"#fff",lineHeight:1,letterSpacing:"-0.02em"}}>{eur(total)}</div>

        {/* Status */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,marginBottom:20}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.accent}}/>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>
            {col.length===0?(isES?"Sin cartas aún":"No cards yet"):(isES?"Sincronizado ahora":"Synced now")}
          </span>
        </div>

        {/* Stats row */}
        <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:16}}>
          {[[col.length,isES?"Cartas":"Cards"],[raras,isES?"Raras":"Rare"],[col.filter(c=>c.scanned).length,isES?"Escaneadas":"Scanned"]].map(([n,l],i,arr)=>(
            <div key={l} style={{flex:1,textAlign:"center",borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:"#fff"}}>{n}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{fontSize:11,color:C.hint,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:10}}>{isES?"Acciones rápidas":"Quick actions"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button onClick={()=>nav("search")} style={{padding:"16px 12px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:18,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,boxShadow:C.shadow,transition:"transform .15s,box-shadow .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=C.shadowM;}}
            onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=C.shadow;}}>
            <div style={{width:36,height:36,borderRadius:10,background:C.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔍</div>
            <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:C.text}}>{isES?"Buscar carta":"Search card"}</div>
            <div style={{fontSize:11,color:C.hint}}>{isES?"Precio en tiempo real":"Real-time price"}</div>
          </button>
          <button onClick={()=>nav("scanner")} style={{padding:"16px 12px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:18,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,boxShadow:C.shadow,transition:"transform .15s,box-shadow .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=C.shadowM;}}
            onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=C.shadow;}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#EEF3FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📷</div>
            <div style={{fontFamily:FD,fontSize:13,fontWeight:700,color:C.text}}>{isES?"Escanear carta":"Scan card"}</div>
            <div style={{fontSize:11,color:C.hint}}>{isES?"IA en segundos":"AI in seconds"}</div>
          </button>
        </div>
        <button onClick={()=>nav("grading")} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg,${C.goldL},#FFF3DC)`,border:`1px solid ${C.gold}44`,borderRadius:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:C.shadow,transition:"transform .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${C.gold},#F0901A)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 4px 12px ${C.gold}44`,flexShrink:0}}>🔬</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:FD,fontSize:14,fontWeight:700,color:C.text}}>{isES?"Análisis de Grado PSA":"PSA Grade Analysis"}</div>
            <div style={{fontSize:11,color:C.sub,marginTop:2}}>{isES?"IA como grader profesional":"AI like a professional grader"}</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:18,color:C.gold,flexShrink:0}}>›</div>
        </button>

        {/* Botón instalar app */}
        {onInstallClick && (()=>{
          const standalone = typeof window!=="undefined" && ((window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone);
          if(standalone) return null;
          return (
            <button onClick={onInstallClick} style={{width:"100%",marginTop:10,padding:"16px",background:`linear-gradient(135deg,${C.accent},#04A857)`,border:"none",borderRadius:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:`0 6px 18px ${C.accent}55`,transition:"transform .15s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
              <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📲</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff"}}>{isES?"Instalar app en el móvil":"Install app on phone"}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.9)",marginTop:2}}>{isES?"Tenla a un toque, como una app":"One tap away, like an app"}</div>
              </div>
              <div style={{marginLeft:"auto",fontSize:20,color:"#fff",flexShrink:0}}>›</div>
            </button>
          );
        })()}

        {/* Banner comprar cromos en eBay (afiliado) */}
        <button onClick={()=>window.open(ebayAffiliate("https://www.ebay.es/sch/i.html?_nkw="+encodeURIComponent("cromos fútbol")),"_blank","noopener")}
          style={{width:"100%",marginTop:10,padding:"16px",background:"linear-gradient(135deg,#0064D2,#0053AE)",border:"none",borderRadius:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:"0 6px 18px rgba(0,100,210,0.4)",transition:"transform .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🛒</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff"}}>{isES?"Comprar cromos en eBay":"Buy cards on eBay"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.9)",marginTop:2}}>{isES?"Miles de cromos de fútbol":"Thousands of football cards"}</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:20,color:"#fff",flexShrink:0}}>›</div>
        </button>

        {/* Apoyar el proyecto (Ko-fi) */}
        <button onClick={()=>window.open("https://ko-fi.com/cardgoal","_blank","noopener")}
          style={{width:"100%",marginTop:10,padding:"16px",background:"linear-gradient(135deg,#FF6B6B,#E8484A)",border:"none",borderRadius:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:"0 6px 18px rgba(232,72,74,0.4)",transition:"transform .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>☕</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff"}}>{isES?"Apoya el proyecto":"Support the project"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.9)",marginTop:2}}>{isES?"Invítanos a un café y mantén CardGoal gratis":"Buy us a coffee, keep CardGoal free"}</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:20,color:"#fff",flexShrink:0}}>›</div>
        </button>

        {!isPremium&&<button onClick={()=>startCheckout(user?.email||"")} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#1a0a2e,#2d1054)",border:`1px solid rgba(160,80,255,0.4)`,borderRadius:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 20px rgba(120,40,200,0.2)",transition:"transform .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#9b4dff,#6a1fd4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⭐</div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:FD,fontSize:14,fontWeight:700,color:"#fff"}}>{isES?"Hazte Premium":"Go Premium"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>{isES?"Escaneos ilimitados · Sin anuncios · 2,95€/mes":"Unlimited scans · No ads · €2.95/mo"}</div>
          </div>
          <div style={{flexShrink:0,background:"linear-gradient(135deg,#9b4dff,#6a1fd4)",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#fff"}}>→</div>
        </button>}
      </div>

      {/* Recent cards */}
      {col.length>0&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 18px 10px"}}>
          <span style={{fontFamily:FD,fontSize:14,fontWeight:700,color:C.text}}>{isES?"Añadidas recientemente":"Recently added"}</span>
          <span onClick={()=>nav("collection")} style={{fontSize:12,color:C.accent,fontWeight:600,cursor:"pointer"}}>{isES?"Ver todo →":"See all →"}</span>
        </div>
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
          {col.slice(-3).reverse().map((card,i)=>(
            <div key={card._uid||i}
              style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:12,boxShadow:C.shadow,cursor:"pointer",transition:"transform .1s,box-shadow .1s"}}
              onClick={()=>nav("collection")}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=C.shadowM;}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=C.shadow;}}>
              <CardViz card={card} photo={card._thumb||null} sz="sm"/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.player}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:3}}>{card.collection||card.manufacturer} · <span style={{color:card.rarity&&card.rarity!=="Base"?C.gold:C.hint}}>{card.rarity||"Base"}</span></div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:FD,fontSize:15,fontWeight:800,color:C.text}}>{eur(num(card.priceEur)||num(card.price))}</div>
                {num(card.changeWeek)!=null&&(
                  <div style={{fontSize:10,fontWeight:700,color:card.changeWeek>=0?C.accent:C.red,marginTop:3,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:2}}>
                    <span>{card.changeWeek>=0?"↑":"↓"}</span><span>{Math.abs(card.changeWeek)}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* Empty state */}
      {col.length===0&&(
        <div style={{padding:"32px 24px",textAlign:"center"}}>
          <div style={{width:72,height:72,borderRadius:20,background:C.accentL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px"}}>⚽</div>
          <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:C.text,marginBottom:8}}>{isES?"Empieza tu colección":"Start your collection"}</div>
          <div style={{fontSize:13,color:C.sub,lineHeight:1.7}}>{isES?"Busca o escanea tu primera carta para ver su valor de mercado.":"Search or scan your first card to see its market value."}</div>
        </div>
      )}
    </div>
  );
}

/* SEARCH */
function Search({onAdd, addedIds, onTap, lang, tally}) {
  const [q,setQ]       = useState("");
  const [cards,setCards] = useState([]);
  const [st,setSt]     = useState("idle");
  const ref = useRef();
  const isES = lang==="es";
  useEffect(()=>{ setTimeout(()=>ref.current?.focus(),80); },[]);

  const go = async () => {
    const query=q.trim(); if(!query) return;
    tally && tally("search");
    setSt("loading"); setCards([]);
    // 1) Catálogo interno (instantáneo)
    const local = searchCards(query);
    if(local.length){ setCards(local); setSt("done"); return; }
    // 2) Si no está en el catálogo, buscar en eBay
    const eb = await ebaySearchCards(query);
    if(eb.length){ setCards(eb); setSt("done"); return; }
    setSt("empty");
  };

  const CHIPS = ["Yamal 2024","Bellingham Prizm","Mbappé Chrome","Pedri Adrenalyn","Haaland auto","Vinicius /25","Messi Topps","Ronaldo Panini"];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg,overflow:"hidden",color:C.text}}>
      {/* Search bar */}
      <div style={{padding:"12px 16px 10px",background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{fontSize:18,fontFamily:FD,fontWeight:800,color:C.text,marginBottom:10}}>{isES?"Buscar carta":"Search card"}</div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:"0 12px",transition:"border-color .15s"}}>
            <span style={{fontSize:16,flexShrink:0,color:C.hint}}>🔍</span>
            <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}
              placeholder={isES?"Jugador, colección, rareza…":"Player, collection, rarity…"}
              style={{flex:1,background:"none",border:"none",outline:"none",fontSize:13,color:C.text,padding:"11px 0",fontFamily:FB}}/>
            {q&&<span onClick={()=>{setQ("");setCards([]);setSt("idle");}} style={{fontSize:14,color:C.hint,cursor:"pointer",flexShrink:0}}>✕</span>}
          </div>
          <button onClick={go} disabled={!q.trim()||st==="loading"} style={{padding:"0 16px",flexShrink:0,background:q.trim()&&st!=="loading"?C.accent:C.bg,border:`1.5px solid ${q.trim()?C.accent:C.border}`,borderRadius:12,fontFamily:FD,fontSize:13,fontWeight:700,color:q.trim()&&st!=="loading"?"#fff":C.hint,cursor:q.trim()&&st!=="loading"?"pointer":"default",transition:"all .15s"}}>
            "OK"
          </button>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
          {CHIPS.map(s=><div key={s} onClick={()=>setQ(s)} style={{padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`,cursor:"pointer",whiteSpace:"nowrap"}}>{s}</div>)}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
        {st==="idle"&&(
          <div style={{textAlign:"center",padding:"32px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>🃏</div>
            <div style={{fontSize:14,color:C.sub,lineHeight:1.7}}>
              {isES?"Busca cualquier carta de fútbol.":"Search any football card."}<br/>
              <span style={{color:C.accent,fontWeight:700}}>{isES?"Resultados en 2-3 segundos.":"Results in 2-3 seconds."}</span><br/>
              <span style={{fontSize:12}}>{isES?"Toca la carta para ver precio y estadísticas.":"Tap card for price and stats."}</span>
            </div>
          </div>
        )}

        {st==="loading"&&(
          <div style={{textAlign:"center",padding:"32px"}}>
            <Spinner/>
            <div style={{fontSize:13,color:C.sub,marginTop:8}}>{isES?"Buscando cartas…":"Searching cards…"}</div>
          </div>
        )}

        {st==="empty"&&<div style={{textAlign:"center",padding:"32px"}}><div style={{fontSize:40,marginBottom:10}}>🔎</div><div style={{fontSize:14,color:C.sub}}>{isES?"Sin resultados para":"No results for"} "<strong style={{color:C.text}}>{q}</strong>"</div></div>}
        {st==="error"&&<div style={{textAlign:"center",padding:"32px"}}><div style={{fontSize:40,marginBottom:10}}>⚠️</div><div style={{fontSize:13,color:C.sub,marginBottom:12}}>{err}</div><button onClick={go} style={{padding:"10px 22px",background:C.accent,border:"none",borderRadius:10,fontFamily:FD,fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>{isES?"Reintentar":"Retry"}</button></div>}

        {st==="done"&&cards.map(card=>{
          const isAdded=addedIds.has(card._uid);
          return(
            <div key={card._uid} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:18,overflow:"hidden",marginBottom:14,boxShadow:C.shadow}}>
              {/* Card visual */}
              <div onClick={()=>onTap({...card})} style={{display:"flex",justifyContent:"center",padding:"20px 16px 14px",background:`linear-gradient(180deg,${C.bg},${C.white})`,cursor:"pointer"}}>
                <CardViz card={card} sz="xl" ebay={!card._fromEbay} imgUrl={card._fromEbay?card._ebayImg:null}/>
              </div>
              {/* Info — toda el área es clicable para ver el precio real */}
              <div onClick={()=>onTap({...card})} style={{padding:"10px 16px 0",cursor:"pointer"}}>
                <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{card.player}</div>
                {card._fromEbay
                  ? <div style={{fontSize:11,color:C.sub,marginTop:2,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{card._ebayTitle}</div>
                  : <div style={{fontSize:13,color:C.sub,marginTop:2}}>{card.team}{card.season?` · ${card.season}`:""}</div>}
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  {card._fromEbay&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.blueL,color:C.blue,border:`1px solid ${C.blue}44`}}>eBay</span>}
                  {card.manufacturer&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.manufacturer}</span>}
                  {card.collection&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.collection}</span>}
                  {card.rarity&&card.rarity!=="Base"&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.goldL,color:C.gold,border:`1px solid ${C.gold}44`}}>★ {card.rarity}</span>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,marginBottom:4}}>
                  <div style={{fontSize:11,color:C.accent,fontWeight:700,background:C.accentL,padding:"4px 10px",borderRadius:8,border:`1px solid ${C.accent}33`}}>
                    👆 {isES?"Ver precio real":"See real price"}
                  </div>
                  {card._fromEbay
                    ? (card.priceEur!=null&&<div style={{fontSize:11,color:C.sub,fontWeight:600}}>{isES?"Anuncio eBay":"eBay listing"}: {eur(card.priceEur)}</div>)
                    : (card.priceEur&&<div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{eur(card.priceEur)}</div>)}
                </div>
              </div>
              {/* Botones: Añadir + Comprar en eBay (para todas las cartas) */}
              <div style={{padding:"10px 16px 14px", display:"flex", flexDirection:"column", gap:8}}>
                <button onClick={()=>onAdd({...card})} disabled={isAdded} style={{width:"100%",padding:"12px",background:isAdded?C.accentL:C.accent,border:isAdded?`1.5px solid ${C.accent}`:"none",borderRadius:12,fontFamily:FD,fontSize:13,fontWeight:700,color:isAdded?C.accent:"#fff",cursor:isAdded?"default":"pointer",transition:"all .2s"}}>
                  {isAdded?(isES?"✓ En tu colección":"✓ In collection"):(isES?"+ Añadir a colección":"+ Add to collection")}
                </button>
                <button onClick={()=>window.open(ebayLinkFor(card),"_blank","noopener")} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#0064D2,#0053AE)",border:"none",borderRadius:12,fontFamily:FD,fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  🛒 {isES?"Comprar en eBay":"Buy on eBay"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* SCANNER */
function Scanner({onAdd, lang, userId, isPremium, onPaywall, gate, tally}) {
  // DIAGNOSTICO v14-CLEAN - borrar después
  console.log("Scanner v14-CLEAN cargado correctamente");
  const [ph,setPh]=useState("idle");
  const [durl,setDurl]=useState(null);
  const [card,setCard]=useState(null);
  const [price,setPrice]=useState(null);
  const [err,setErr]=useState("");
  const [added,setAdded]=useState(false);
  const [backScanning,setBackScanning]=useState(false);
  const [backDone,setBackDone]=useState(false);
  const fileRef=useRef();
  const backRef=useRef();
  const galleryRef=useRef();
  const isES=lang==="es";
  const reset=()=>{setPh("idle");setDurl(null);setCard(null);setPrice(null);setErr("");setAdded(false);setBackDone(false);setBackScanning(false);if(fileRef.current)fileRef.current.value="";if(backRef.current)backRef.current.value="";};
  const process=useCallback(async file=>{
    if(!file||!file.type.startsWith("image/"))return;
    if(gate && !gate("scan")) return;
    if(!canScan(userId, isPremium)) { onPaywall&&onPaywall(); return; }
    const compressed = await compressImage(file);
    const d = compressed || await toDataURL(file);
    setDurl(d);setPh("scanning");setAdded(false);setBackDone(false);
    try{
      const b64=d.split(",")[1];
      const c=await scanCard(b64,"image/jpeg");
      setCard(c);
      incrementScan(userId);
      tally && tally("scan");
      // Tracking: escaneo completado (se completa en addCard con acceso a user)
      setPh("back_prompt");
    }catch(e){setErr(e.message==="NO_CARD"?(isES?"No parece ser una carta de fútbol.":"Doesn't look like a football card."):(isES?"No pude identificarla. Prueba con más luz.":"Couldn't identify it. Try better lighting."));setPh("error");}
  },[lang,gate,tally]);

  // Procesa el reverso y luego busca el precio
  const processBack=useCallback(async file=>{
    if(!file||!file.type.startsWith("image/")||!card) return;
    setPh("back_scanning");
    try{
      const compressed = await compressImage(file);
      const d = compressed || await toDataURL(file);
      const backData = await scanCardBack(d.split(",")[1],"image/jpeg",card);
      let finalCard = card;
      if(backData && (backData.serialNumber || backData.hasAuto)){
        finalCard = {
          ...card,
          serialNumber: backData.serialNumber || card.serialNumber || null,
          rarity: backData.rarity || (backData.serialNumber
            ? (backData.hasAuto ? `Auto Numbered ${backData.serialNumber}` : `Numbered ${backData.serialNumber}`)
            : card.rarity),
        };
        setCard(finalCard);
      }
      setBackDone(true);
      setPh("pricing");
      let p=null;try{p=await fetchPrice(finalCard);}catch{}
      setPrice(p);setPh("result");
    }catch(e){
      console.error("back scan error",e);
      // Si falla el reverso, seguimos con los datos del frente
      setPh("pricing");
      let p=null;try{p=await fetchPrice(card);}catch{}
      setPrice(p);setPh("result");
    }
  },[card]);

  const skipBack=useCallback(async ()=>{
    // Sin numeración en el reverso — busca precio solo con datos del frente
    setBackDone(true);
    setPh("pricing");
    let p=null;try{p=await fetchPrice(card);}catch{}
    setPrice(p);setPh("result");
  },[card]);

  if(ph==="idle")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28,gap:16,background:C.bg2}}>
      <div style={{fontSize:64}}>📷</div>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{isES?"Scanner IA":"AI Scanner"}</div>
        <div style={{fontSize:13,color:C.sub,marginTop:6,lineHeight:1.6,maxWidth:260}}>{isES?"Haz foto a tu carta. La IA la identifica y busca el precio real en eBay y Cardmarket.":"Take a photo. AI identifies it and finds the real price on eBay and Cardmarket."}</div>
      </div>
      {/* Usage counter */}
      {!isPremium&&userId&&(()=>{
        const u=getUsage(userId);
        const left=Math.max(0,LIMITS.scans-u.scans);
        if(left>0) return <div style={{background:C.accentL,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"8px 16px",fontSize:12,color:C.accent,fontWeight:600}}>
          {isES?`${left} escaneos gratuitos restantes este mes`:`${left} free scans left this month`}
        </div>;
        // No scans left — show upgrade block
        return <div style={{background:"rgba(255,82,82,0.08)",border:`1px solid ${C.red}44`,borderRadius:14,padding:"16px",textAlign:"center",width:"100%",maxWidth:280}}>
          <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:4}}>
            {isES?"Has agotado tus escaneos gratuitos":"You've used all free scans"}
          </div>
          <div style={{fontSize:11,color:C.sub,marginBottom:12}}>
            {isES?"Activa Premium para escaneos ilimitados":"Activate Premium for unlimited scans"}
          </div>
          <button onClick={()=>startCheckout(window._cgUserEmail||"")} style={{width:"100%",padding:"12px",background:C.accent,border:"none",borderRadius:12,fontFamily:FD,fontSize:14,fontWeight:800,color:C.bg,cursor:"pointer"}}>
            💳 {isES?"Activar Premium — 2,95€/mes":"Activate Premium — €2.95/mo"}
          </button>
        </div>;
      })()}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files?.[0])}/>
      <button onClick={()=>{
        if(!canScan(userId, isPremium)){ onPaywall&&onPaywall(); return; }
        fileRef.current?.click();
      }} style={{width:"100%",maxWidth:280,padding:"16px",background:C.accent,border:"none",borderRadius:16,fontFamily:FD,fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:`0 4px 16px ${C.accent}44`}}>
        📷 {isES?"Usar cámara":"Use camera"}
      </button>
      <button onClick={()=>{
        if(!canScan(userId, isPremium)){ onPaywall&&onPaywall(); return; }
        if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();}
      }} style={{width:"100%",maxWidth:280,padding:"13px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:16,fontFamily:FD,fontSize:14,fontWeight:700,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:C.shadow}}>
        🖼️ {isES?"Subir imagen":"Upload image"}
      </button>
    </div>
  );

  if(ph==="scanning"||ph==="pricing"||ph==="back_scanning")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:20,background:C.bg}}>
      {durl&&<div style={{width:160,height:224,borderRadius:14,overflow:"hidden",border:`3px solid ${C.accent}`,boxShadow:`0 0 24px ${C.accent}44`}}>
        <img src={durl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>}
      <Spinner/>
      <div style={{fontSize:13,color:C.sub,textAlign:"center"}}>
        {ph==="scanning"?(isES?"Analizando cara delantera…":"Analyzing front…"):
         ph==="back_scanning"?(isES?"Analizando reverso…":"Analyzing back…"):
         (isES?"Buscando precio real…":"Searching real price…")}
      </div>
    </div>
  );

  // Pantalla intermedia: cara delantera identificada → pedir reverso (OBLIGATORIO)
  if(ph==="back_prompt"&&card)return(
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg}}>
      {/* Input cámara */}
      <input ref={backRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
        onChange={e=>{ const f=e.target.files?.[0]; if(f) processBack(f); if(backRef.current) backRef.current.value=""; }}/>
      {/* Input galería */}
      <input ref={galleryRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ const f=e.target.files?.[0]; if(f) processBack(f); if(galleryRef.current) galleryRef.current.value=""; }}/>
      {/* Confirmación del frente */}
      <div style={{background:C.bg2,padding:"16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`}}>
        <div style={{width:56,height:78,borderRadius:8,overflow:"hidden",border:`2px solid ${C.accent}`,flexShrink:0}}>
          <img src={durl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        </div>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:18}}>✅</span>
            <span style={{fontSize:12,fontWeight:700,color:C.accent}}>{isES?"Cara delantera identificada":"Front identified"}</span>
          </div>
          <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{card.player}</div>
          <div style={{fontSize:12,color:C.sub}}>{card.manufacturer}{card.collection?` · ${card.collection}`:""}</div>
        </div>
      </div>
      {/* Instrucción reverso */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"28px 24px",gap:16,textAlign:"center"}}>
        <div style={{fontSize:56}}>🔄</div>
        <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:C.text,lineHeight:1.2}}>
          {isES?"Ahora escanea el reverso":"Now scan the back"}
        </div>
        <div style={{fontSize:13,color:C.sub,lineHeight:1.6,maxWidth:300}}>
          {isES
            ? "Da la vuelta a la carta y fotografía el reverso. Así detectamos la numeración, autógrafo y número de colección para darte el precio más preciso."
            : "Flip the card and photograph the back. This detects the serial number, autograph and card number for the most accurate price."}
        </div>
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 16px",width:"100%",maxWidth:320}}>
          <div style={{fontSize:11,color:C.sub,fontWeight:600,textAlign:"left"}}>
            {isES?"¿Qué buscamos en el reverso?":"What are we looking for on the back?"}
          </div>
          <div style={{fontSize:12,color:C.text,marginTop:6,lineHeight:1.8,textAlign:"left"}}>
            🔢 Número de tirada (ej. 14/25, /99)<br/>
            ✍️ Autógrafo o firma<br/>
            🏷️ Número de carta del set
          </div>
        </div>
      </div>
      {/* Botones */}
      <div style={{padding:"16px 20px 32px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>backRef.current?.click()} style={{flex:1,padding:"16px",background:C.accent,border:"none",borderRadius:16,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 16px ${C.accent}44`}}>
            📷 {isES?"Cámara":"Camera"}
          </button>
          <button onClick={()=>galleryRef.current?.click()} style={{flex:1,padding:"16px",background:C.bg3,border:`1.5px solid ${C.accent}`,borderRadius:16,fontFamily:FD,fontSize:15,fontWeight:800,color:C.accent,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🖼️ {isES?"Galería":"Gallery"}
          </button>
        </div>
        <button onClick={skipBack} style={{width:"100%",padding:"12px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:14,fontFamily:FD,fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer"}}>
          {isES?"No tiene numeración ni auto en el reverso":"No serial number or auto on back"}
        </button>
      </div>
    </div>
  );

  if(ph==="error")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16,background:C.bg,textAlign:"center"}}>
      <div style={{fontSize:48}}>😕</div>
      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{isES?"No pude identificarla":"Couldn't identify it"}</div>
      <div style={{fontSize:13,color:C.sub,maxWidth:250,lineHeight:1.5}}>{err}</div>
      <button onClick={reset} style={{padding:"13px 28px",background:C.accent,border:"none",borderRadius:12,fontFamily:FD,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>{isES?"Intentar de nuevo":"Try again"}</button>
    </div>
  );

  if(ph==="result"&&card){
    const p=num(price?.priceEur);
    const doAdd=()=>{if(added)return;onAdd({...card,...(price||{}),priceEur:p??null,price:p??null,scanned:true,_thumb:durl,_uid:`scan_${Date.now()}`});setAdded(true);};
    return(
      <div style={{flex:1,overflowY:"auto",background:C.bg,color:C.text}}>
        <div style={{background:C.bg2,padding:"20px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`}}>
          <CardViz card={card} photo={durl} sz="xl"/>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{card.player}</div>
            <div style={{fontSize:13,color:C.sub,marginTop:3}}>{card.team}{card.season?` · ${card.season}`:""}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
            {card.manufacturer&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.manufacturer}</span>}
            {card.rarity&&card.rarity!=="Base"&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.goldL,color:C.gold,border:`1px solid ${C.gold}44`}}>★ {card.rarity}</span>}
            {card.serialNumber&&card.serialNumber!=="null"&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:"#7c3aed22",color:"#a78bfa",border:"1px solid #7c3aed44"}}>🔢 {card.serialNumber}</span>}
            {backDone&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.accentL,color:C.accent,border:`1px solid ${C.accent}44`}}>✓ Reverso escaneado</span>}
          </div>
          <span style={{padding:"3px 10px",borderRadius:8,fontSize:10,fontWeight:600,background:C.accentL,color:C.accent,border:`1px solid ${C.accent}44`}}>🤖 IA · {Math.round((num(card.confidence)||0.7)*100)}%</span>
        </div>
        <div style={{padding:"16px"}}>
          {p!=null?<>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:12,boxShadow:C.shadow}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div style={{fontSize:11,color:C.sub,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                  {price?.isEstimate?(isES?"Estimación orientativa":"Estimate"):(isES?"Precio de mercado":"Market price")}
                </div>
                {price?.isEstimate
                  ? <span style={{fontSize:10,fontWeight:600,color:"#f59e0b"}}>⚡ IA estimate</span>
                  : <span style={{fontSize:10,fontWeight:600,color:C.accent}}>🛒 {isES?"Verifica en eBay":"Check on eBay"}</span>}
              </div>
              <div style={{fontFamily:FD,fontSize:36,fontWeight:800,color:C.text,margin:"2px 0 4px"}}>{eur(p)}</div>
              {price?.isEstimate&&<div style={{fontSize:10,color:C.sub,marginTop:2}}>
                {isES?"Sin datos en eBay — estimación por rareza":"No eBay data — rarity estimate"}
              </div>}
            </div>
            {num(price?.priceMin)!=null&&<div style={{display:"flex",gap:8,marginBottom:12}}>
              <PriceTag value={price.priceMin} label={isES?"Mínimo":"Low"}/>
              <PriceTag value={p} label={isES?"Mediana":"Median"} highlight/>
              <PriceTag value={price.pricePrem} label={isES?"Máximo":"High"}/>
            </div>}
          </>:<div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:12,textAlign:"center",boxShadow:C.shadow}}>
            <div style={{fontSize:13,color:C.sub}}>{isES?"No encontré precio de mercado.":"No market price found."}</div>
          </div>}
          <button onClick={doAdd} disabled={added} style={{width:"100%",padding:"15px",background:added?C.accentL:C.accent,border:added?`1.5px solid ${C.accent}`:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:added?C.accent:"#fff",cursor:added?"default":"pointer",transition:"all .2s",marginBottom:10,boxShadow:added?"none":`0 4px 14px ${C.accent}44`}}>
            {added?(isES?"✓ En tu colección":"✓ In collection"):(isES?"+ Añadir a mi colección":"+ Add to my collection")}
          </button>

          <button onClick={reset} style={{width:"100%",padding:"13px",background:"transparent",border:`1.5px solid ${C.border}`,borderRadius:14,fontFamily:FD,fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer"}}>
            {isES?"Escanear otra carta":"Scan another card"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/* COLLECTION */
function Collection({col, nav, onTap, onRemove, lang, onUpdatePrices, isUpdating, isGuest, onRegister, onRefreshCard}) {
  const [filt,setFilt]=useState("all");
  const [refreshingUid, setRefreshingUid] = useState(null);
  const [refreshedUid, setRefreshedUid]   = useState(null);
  const isES=lang==="es";
  const total=col.reduce((s,c)=>s+(num(c.priceEur)||num(c.price)||0),0);
  const filtered=col.filter(c=>{
    if(filt==="rare")return c.rarity&&!["base","Base","base card"].includes(c.rarity);
    if(filt==="scan")return c.scanned;
    return true;
  });

  if(!col.length)return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16,textAlign:"center",background:C.bg}}>
      <div style={{fontSize:56}}>🗂️</div>
      <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{isES?"Colección vacía":"Empty collection"}</div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.6}}>{isES?"Busca o escanea una carta para empezar.":"Search or scan a card to get started."}</div>
      <button onClick={()=>nav("search")} style={{padding:"14px 28px",background:C.accent,border:"none",borderRadius:14,fontFamily:FD,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>
        {isES?"Buscar primera carta":"Search first card"}
      </button>
    </div>
  );

  const FILTERS=[[isES?"Todas":"All","all"],[isES?"Raras":"Rare","rare"],[isES?"Escaneadas":"Scanned","scan"]];

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}}>
      {/* Header */}
      <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,flexShrink:0,padding:"14px 18px 10px"}}>
        <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.white}}>{isES?"Mi Colección":"My Collection"}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontFamily:FD,fontSize:28,fontWeight:800,color:C.accent}}>{eur(total)}</span>
              <span style={{fontSize:13,color:C.sub}}>{col.length} {isES?"cartas":"cards"}</span>
            </div>
            <div style={{fontSize:10,color:C.sub,marginTop:2}}>
              {isES?"Valor orientativo · precios de anuncios eBay":"Approximate value · eBay listing prices"}
            </div>
          </div>
        </div>

        {/* Aviso para invitados: regístrate para guardar de verdad */}
        {isGuest&&(
          <button onClick={onRegister} style={{width:"100%",marginTop:12,padding:"12px 14px",background:`${C.accent}1A`,border:`1px solid ${C.accent}55`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
            <span style={{fontSize:18}}>💾</span>
            <div>
              <div style={{fontFamily:FD,fontSize:12,fontWeight:800,color:C.accent}}>{isES?"Estás probando como invitado":"You're trying as a guest"}</div>
              <div style={{fontSize:10,color:C.sub,marginTop:1}}>{isES?"Crea una cuenta gratis para guardar tu colección de verdad":"Create a free account to save your collection"}</div>
            </div>
          </button>
        )}

        <div style={{display:"flex",gap:6,marginTop:10}}>
          {FILTERS.map(([l,v])=>(
            <div key={v} onClick={()=>setFilt(v)} style={{padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",background:filt===v?C.accent:C.bg,color:filt===v?"#fff":C.sub,border:`1px solid ${filt===v?C.accent:C.border}`,transition:"all .15s"}}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {!filtered.length&&<div style={{textAlign:"center",padding:"32px",fontSize:13,color:C.hint}}>—</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,padding:"12px 16px"}}>
          {filtered.slice().reverse().map((card,i)=>{
            const p=num(card.priceEur)||num(card.price);
            const wk=num(card.changeWeek);
            return(
              <div key={card._uid||i} onClick={()=>onTap({...card})}
                style={{position:"relative",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer",boxShadow:C.shadow,transition:"box-shadow .15s,transform .1s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=C.shadowM;e.currentTarget.style.transform="scale(1.02)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=C.shadow;e.currentTarget.style.transform="scale(1)";}}>
                {onRemove&&<button
                  onClick={(e)=>{
                    e.stopPropagation();
                    if(window.confirm(isES?`¿Quitar "${card.player||"esta carta"}" de tu colección?`:`Remove "${card.player||"this card"}" from your collection?`)){
                      onRemove(card._uid);
                    }
                  }}
                  title={isES?"Quitar de la colección":"Remove from collection"}
                  style={{position:"absolute",top:6,right:6,zIndex:5,width:26,height:26,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.6)",color:C.red,fontSize:14,fontWeight:800,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
                  ✕
                </button>}
                {onRefreshCard&&<button
                  onClick={async (e)=>{
                    e.stopPropagation();
                    setRefreshingUid(card._uid);
                    setRefreshedUid(null);
                    await onRefreshCard(card);
                    setRefreshingUid(null);
                    setRefreshedUid(card._uid);
                    setTimeout(()=>setRefreshedUid(null), 2000);
                  }}
                  disabled={refreshingUid===card._uid}
                  title={isES?"Actualizar precio desde eBay":"Refresh price from eBay"}
                  style={{position:"absolute",top:6,left:6,zIndex:5,width:26,height:26,borderRadius:"50%",border:"none",
                    background:refreshedUid===card._uid?"rgba(0,230,118,0.9)":refreshingUid===card._uid?"rgba(0,0,0,0.4)":"rgba(0,0,0,0.6)",
                    color:refreshedUid===card._uid?"#fff":C.accent,fontSize:13,lineHeight:1,
                    cursor:refreshingUid===card._uid?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
                  {refreshingUid===card._uid?"⏳":refreshedUid===card._uid?"✓":"🔄"}
                </button>}
                <div style={{display:"flex",justifyContent:"center",padding:"12px 10px 8px",background:`linear-gradient(180deg,${C.bg},${C.white})`}}>
                  <CardViz card={card} photo={card._thumb||null} sz="md" imgUrl={card._fromEbay?card._ebayImg:null}/>
                </div>
                <div style={{padding:"8px 10px 12px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.player||"—"}</div>
                  <div style={{fontSize:10,color:C.sub,marginTop:1}}>{card.rarity||"Base"}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                    <div style={{fontFamily:FD,fontSize:14,fontWeight:800,color:C.text}}>{eur(p)}</div>
                    {wk!=null&&<div style={{fontSize:10,fontWeight:700,color:wk>=0?C.accent:C.red}}>{wk>=0?"↑":"↓"}{Math.abs(wk)}%</div>}
                  </div>
                  <div style={{fontSize:9,color:C.accent,marginTop:4,fontWeight:600}}>{isES?"Toca para estadísticas →":"Tap for stats →"}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════ */
export default function CardGoal() {
  const [screen,setScreen] = useState("home");


  // Analytics: registra cada sección como una "página" en Google Analytics
  useEffect(()=>{
    if(typeof window==="undefined" || !window.gtag) return;
    const names = { home:"Inicio", search:"Buscar", scanner:"Scanner", collection:"Colección" };
    window.gtag("event","page_view",{
      page_title: "CardGoal — "+(names[screen]||screen),
      page_path: "/"+screen,
      page_location: window.location.origin+"/"+screen,
    });
  },[screen]);
  // Check if returning from Stripe payment
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("premium")==="success") {
      // Reload user to check premium status
      setTimeout(()=>window.location.href="https://cardgoal.es",1000);
    }
  },[]);
  // ── Auth state ──
  const [user,setUser] = useState(()=>{
    try { const s=localStorage.getItem("cardgoal_user"); return s?JSON.parse(s):null; } catch { return null; }
  });
  // ── Collection ──
  const [col,setCol] = useState([]);
  const [addedIds,setAdded] = useState(new Set());
  const [modal,setModal]   = useState(null);
  const [paywall,setPaywall] = useState(null); // null | "scan" | "grade" | "collection"
  // Instalación PWA: capturamos el evento de Android para poder ofrecer el botón
  const [deferredInstall,setDeferredInstall] = useState(null);
  const [showInstallModal,setShowInstallModal] = useState(false);
  const [showAuth,setShowAuth] = useState(false); // modo invitado: registro solo cuando hace falta
  const [showTip,setShowTip] = useState(false);   // pop-up de propina (Ko-fi) para registrados
  useEffect(()=>{
    const h=(e)=>{ e.preventDefault(); setDeferredInstall(e); };
    const done=()=>{ setDeferredInstall(null); setShowInstallModal(false); };
    window.addEventListener("beforeinstallprompt",h);
    window.addEventListener("appinstalled",done);
    return ()=>{ window.removeEventListener("beforeinstallprompt",h); window.removeEventListener("appinstalled",done); };
  },[]);
  // FASE GRATIS: todo desbloqueado para todos mientras validamos el interés.
  // Para reactivar el pago en el futuro: volver a poner  user?.isPremium||false
  const isPremium = true;
  const [lang,setLang]     = useState(()=>{ try{return localStorage.getItem("cardgoal_lang")||"es";}catch{return "es";} });
  const [priceAlerts,setPriceAlerts] = useState([]);

  useEffect(()=>{ try{localStorage.setItem("cardgoal_lang",lang);}catch{} },[lang]);

  // ── Load collection from Supabase when user logs in ──
  useEffect(()=>{
    if(!user?.token) return;
    supa.loadCards(user.token).then(cards=>{
      if(!Array.isArray(cards)) return;
      const mapped = cards.map(c=>{
        const isData = typeof c.image==="string" && c.image.startsWith("data:");
        const isUrl  = typeof c.image==="string" && c.image.startsWith("http");
        return {
          _uid: c.id, player:c.player, team:c.team, season:c.season,
          manufacturer:c.manufacturer, collection:c.collection,
          cardNumber:c.card_number, rarity:c.rarity, condition:c.condition,
          priceEur:c.price_eur, priceMin:c.price_min, pricePrem:c.price_prem,
          priceSource:c.price_source, changeWeek:c.change_week, changeMonth:c.change_month,
          scanned:c.scanned, _dbId:c.id,
          _thumb: isData ? c.image : null,                 // foto escaneada
          _ebayImg: isUrl ? c.image : null,                // foto de eBay
          _fromEbay: isUrl || !!c.ebay_title,
          _ebayTitle: c.ebay_title || null,
        };
      });
      setCol(mapped);
      setAdded(new Set(mapped.map(c=>c._uid)));
    }).catch(()=>{});
  },[user]);

  const handleAuth = useCallback(async userData => {
    // Check if user has active Stripe subscription
    const isPremium = await checkPremium(userData.email).catch(()=>false);
    const fullUser = {...userData, isPremium};
    setUser(fullUser);
    setShowAuth(false);
    window._cgUserEmail = userData.email; // for Stripe checkout
    try { localStorage.setItem("cardgoal_user", JSON.stringify(fullUser)); } catch {}
  },[]);

  // Verify token on startup and refresh if needed
  useEffect(()=>{
    if(!user?.token) return;
    supa.verifyToken(user.token).then(valid => {
      if(!valid && user.refreshToken) {
        supa.refreshToken(user.refreshToken).then(res => {
          if(res.access_token) {
            const updated = {...user, token: res.access_token, refreshToken: res.refresh_token};
            setUser(updated);
            try { localStorage.setItem("cardgoal_user", JSON.stringify(updated)); } catch {}
          } else {
            // Token expired, logout
            setUser(null);
            try { localStorage.removeItem("cardgoal_user"); } catch {}
          }
        }).catch(()=>{});
      }
    }).catch(()=>{});
  },[]);

  const handleLogout = useCallback(async () => {
    if(user?.token) await supa.signOut(user.token).catch(()=>{});
    setUser(null); setCol([]); setAdded(new Set());
    try { localStorage.removeItem("cardgoal_user"); } catch {}
  },[user]);

  // Límites para invitados (protege la API y empuja registro) y cadencia de propina
  const gate = useCallback((kind)=>{
    if(user) return true;                       // registrados: sin límite de invitado
    const lim = {scan:5, grade:3, save:2}[kind];
    if(lim==null) return true;                  // p.ej. búsqueda: sin límite
    let n=0; try{ n=Number(localStorage.getItem(`cg_g_${kind}`)||0); }catch{}
    if(n>=lim){ setShowAuth(true); return false; }
    try{ localStorage.setItem(`cg_g_${kind}`,String(n+1)); }catch{}
    return true;
  },[user]);

  const tally = useCallback((kind)=>{
    if(!user) return;                           // propina solo a registrados
    const every = {search:4, scan:4, save:4, grade:3}[kind];
    if(!every) return;
    let n=0; try{ n=Number(sessionStorage.getItem(`cg_t_${kind}`)||0); }catch{}
    n+=1;
    try{ sessionStorage.setItem(`cg_t_${kind}`,String(n)); }catch{}
    if(n%every===0) setShowTip(true);
  },[user]);

  const addCard = useCallback(async card => {
    if(!gate("save")) return;
    const uid = card._uid||`uid_${Date.now()}`;
    const newCard = {...card, _uid:uid};
    setCol(prev=>[...prev,newCard]);
    setAdded(prev=>new Set([...prev,uid]));
    if(user?.token && user?.id) {
      try {
        const res = await supa.saveCard(newCard, user.token, user.id);
        if(res && res[0]?.id) setCol(prev=>prev.map(c=>c._uid===uid?{...c,_dbId:res[0].id}:c));
      } catch(e) { console.error('saveCard error:', e); }
      // Tracking: carta añadida a colección
      supa.trackEvent(user.id, user.token, {type:'add_card', player:card.player, manufacturer:card.manufacturer, collection:card.collection, rarity:card.rarity, priceEur:card.priceEur});
    }
    tally("save");
  },[user, gate, tally]);

  const removeCard = useCallback(async uid => {
    const card = col.find(c=>c._uid===uid);
    setCol(prev=>prev.filter(c=>c._uid!==uid));
    setAdded(prev=>{ const n=new Set(prev); n.delete(uid); return n; });
    if(user?.token && card?._dbId) {
      try { await supa.deleteCard(card._dbId, user.token); } catch {}
      // Tracking: carta eliminada
      supa.trackEvent(user.id, user.token, {type:'remove_card', player:card.player});
    }
  },[user,col]);

  const [updatingPrices, setUpdatingPrices] = useState(false);

  // Actualiza el precio de una carta concreta desde eBay y guarda en Supabase
  const handleRefreshCard = useCallback(async (card) => {
    try {
      const isAuto   = /auto/i.test(card.rarity||"");
      const isGraded = /\bpsa\b|\bbgs\b|\bsgc\b|\bcgc\b/i.test(card.rarity||"");
      const serial   = card.serialNumber&&String(card.serialNumber)!=="null"?card.serialNumber:null;
      const searchQ  = [
        card.player,
        card.manufacturer&&card.manufacturer!=="?"?card.manufacturer:"",
        card.collection&&card.collection!=="?"?card.collection:"",
        card.cardNumber&&card.cardNumber!=="null"?card.cardNumber:"",
        card.season&&card.season!=="?"?card.season:"",
        isAuto?"auto":"", serial||""
      ].filter(Boolean).join(" ").trim();

      const r = await fetch(`/api/ebay?q=${encodeURIComponent(searchQ)}`);
      if(!r.ok) return;
      const data = await r.json();
      const lastName=(card.player||"").split(" ").slice(-1)[0].toLowerCase();

      const prices = (data.results||[])
        .filter(it=>{
          if(!it.price) return false;
          if(EBAY_BAD_ALWAYS.test(it.title||"")) return false;
          if(!isAuto&&EBAY_BAD_NONAUTO.test(it.title||"")) return false;
          if(!isGraded&&GRADED_PAT.test(it.title||"")) return false;
          if(lastName.length>=3&&!(it.title||"").toLowerCase().includes(lastName)) return false;
          return true;
        })
        .map(it=>parseEbayPrice(it.price))
        .filter(p=>p&&isPriceOk(p,card)).sort((a,b)=>a-b);

      if(!prices.length) return;
      const floor  = priceFloor(card);
      const median = Math.max(prices[Math.floor(prices.length/2)], floor);
      if(card.priceEur&&card.priceEur>20&&median<card.priceEur*0.4) return; // protección caída
      const np = {priceEur:median, priceMin:Math.max(prices[0],floor),
                  pricePrem:prices[prices.length-1],
                  priceSource:`eBay · ${prices.length} anuncio${prices.length>1?"s":""}`};
      setCol(prev=>prev.map(c=>c._uid===card._uid?{...c,...np}:c));
      if(card._dbId&&user?.token) supa.updateCardPrice(card._dbId,user.token,np).catch(()=>{});
    } catch(e){ console.error("refreshCard",e); }
  },[user]);

  const handleUpdatePrices = useCallback(async () => {
    if(updatingPrices || col.length === 0) return;
    setUpdatingPrices(true);
    try {
      const toUpdate = col.map((c,i)=>({c,i})).filter(({c})=>{
        if(c.priceEur && c.priceEur > 0) return false; // ya tiene precio → NO TOCAR
        return true; // sin precio → actualizar
      });
      if(toUpdate.length===0){ setUpdatingPrices(false); return; }
      const updated = [...col];

      // FASE 1: eBay + Wallapop en paralelo para todas las cartas
      const marketResults = await Promise.allSettled(toUpdate.map(async ({c})=>{
        const isAuto = /auto/i.test(c.rarity||"");
        const q = [c.player,
          c.manufacturer&&c.manufacturer!=="?"?c.manufacturer:"",
          c.collection&&c.collection!=="?"?c.collection:"",
          c.season&&c.season!=="?"?c.season:"",
          isAuto?"auto":"",
          c.serialNumber&&String(c.serialNumber)!=="null"?c.serialNumber:""
        ].filter(Boolean).join(" ").trim();
        const lastName=(c.player||"").split(" ").slice(-1)[0].toLowerCase();
        const hasAuto=isAuto;
        const [eR,wR]=await Promise.allSettled([
          fetch(`/api/ebay?q=${encodeURIComponent(q)}`).then(r=>r.ok?r.json():null),
          Promise.resolve(null),
        ]);
        const ePrices=((eR.status==="fulfilled"?eR.value:null)?.results||[])
          .filter(it=>it.price&&!GRADED_PAT.test(it.title||"")&&!EBAY_BAD.test(it.title||"")&&
            (hasAuto||!/\bauto\b|\bautograph\b/i.test(it.title||""))&&
            (lastName.length<3||(it.title||"").toLowerCase().includes(lastName)))
          .map(it=>parseEbayPrice(it.price)).filter(p=>p&&isPriceOk(p,c)).sort((a,b)=>a-b);
        if(!ePrices.length) return null;
        const median=ePrices[Math.floor(ePrices.length/2)];
        return {priceEur:median,priceMin:ePrices[0],pricePrem:ePrices[ePrices.length-1],
          priceSource:`eBay · ${ePrices.length} anuncios`};
      }));

      const needSonnet=[];
      marketResults.forEach((res,n)=>{
        const {c,i}=toUpdate[n];
        const p=res.status==="fulfilled"?res.value:null;
        if(p&&isPriceOk(p.priceEur,c)&&isPriceChangeOk(p.priceEur,c.priceEur)){
          const floor=priceFloor(c);
          const finalPrice=Math.max(p.priceEur, floor);
          const finalResult={...p, priceEur:finalPrice, priceMin:Math.max(p.priceMin||0,floor)};
          updated[i]={...updated[i],...finalResult};
          const key=`${c.player}|${c.manufacturer||""}|${c.collection||""}|${c.rarity||"Base"}|${c.serialNumber||""}|${c.season||""}`;
          lsPriceSet(key,finalResult);
          if(c._dbId&&user?.token) supa.updateCardPrice(c._dbId,user.token,finalResult).catch(()=>{});
        } else { needSonnet.push(toUpdate[n]); }
      });

      // FASE 2: Sonnet para cartas sin datos de mercado
      if(needSonnet.length>0){
        const cardList=needSonnet.map(({c},n)=>{
          const serial=c.serialNumber&&String(c.serialNumber)!=="null"?` NUMERADA ${c.serialNumber}`:"";
          return `${n+1}. ${c.player} | ${c.manufacturer||"?"} | ${c.collection||"?"} | ${c.rarity||"Base"}${serial} | ${c.season||"?"}`;
        }).join("\n");
        const raw=await callAI([{role:"user",content:
`Experto tasador de cartas de fútbol. Valora estas ${needSonnet.length} cartas en EUR (SIN GRADEAR, raw):

${cardList}

RANGOS: Base común=0.5-3€ | Base top=5-25€ | Prizm=5-60€ | Auto=20-500€ | Auto /50=100-350€ | Auto /25=150-600€ | Auto /10=300-1500€ | Auto /5=600-3000€
Endrick/Yamal/Vinicius/Bellingham: ×2-3 sobre rangos.
SOLO JSON: [{"priceEur":8,"priceMin":4,"pricePrem":20},...]`
        }],false,600,"claude-sonnet-4-6");
        try{
          const match=(raw.replace(/\`\`\`json|\`\`\`/g,"").trim()).match(/\[\s\S]*\]/);
          if(match){
            const prices=JSON.parse(match[0]);
            needSonnet.forEach(({c,i},n)=>{
              const p=prices[n]; const np=num(p?.priceEur);
              if(!np||!isPriceOk(np,c)||!isPriceChangeOk(np,c.priceEur)) return;
              const floor=priceFloor(c);
              const finalPrice=Math.max(np,floor);
              const result={priceEur:finalPrice,priceMin:Math.max(num(p.priceMin)||Math.round(finalPrice*.65),floor),
                pricePrem:num(p.pricePrem)||Math.round(finalPrice*1.5),priceSource:"Estimación IA"};
              updated[i]={...updated[i],...result};
              const key=`${c.player}|${c.manufacturer||""}|${c.collection||""}|${c.rarity||"Base"}|${c.serialNumber||""}|${c.season||""}`;
              lsPriceSet(key,result);
              if(c._dbId&&user?.token) supa.updateCardPrice(c._dbId,user.token,result).catch(()=>{});
            });
          }
        }catch(e){console.error("Sonnet parse:",e);}
      }
      setCol(updated);
    } catch(e){ console.error("handleUpdatePrices:",e); }
    setUpdatingPrices(false);
  },[col,updatingPrices,user]);

  const addAlert = useCallback((card, targetPrice) => {
    setPriceAlerts(prev=>[...prev, {card, targetPrice, _uid:`alert_${Date.now()}`}]);
  },[]);

  const total = col.reduce((s,c)=>s+(num(c.priceEur)||num(c.price)||0),0);
  const isES = lang==="es";

  const NAV = [
    {id:"home",       i:"🏠", l:isES?"Inicio":"Home"},
    {id:"search",     i:"🔍", l:isES?"Buscar":"Search"},
    {id:"scanner",    i:"📷", l:"Scanner"},
    {id:"collection", i:"🗂️", l:isES?"Colección":"Collection"},
    {id:"grading",    i:"🔬", l:isES?"Gradear":"Grade"},
  ];

  return (
    <div style={{fontFamily:FB,background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { display:none; }
        input::placeholder { color:rgba(255,255,255,0.6); background:{C.bg2}; }
        body { margin:0; padding:0; }
      `}</style>

      {/* Top header bar — premium */}
      <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(0,0,0,0.06)"}}>
        <div onClick={()=>{setModal(null);setScreen("home");}} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1A2035,#0D1525)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>⚽</div>
          <div>
            <div style={{fontFamily:FD,fontSize:17,fontWeight:800,color:C.white,letterSpacing:"-0.01em",lineHeight:1}}>CardGoal</div>
            {user&&<div style={{fontSize:10,color:C.accent,marginTop:2}}>{user.email}</div>}
            {!user&&<div style={{fontSize:10,color:C.hint,marginTop:2}}>{isES?"Tu portfolio de cromos":"Your card portfolio"}</div>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <LangBtn lang={lang} setLang={setLang}/>
          {user&&<button onClick={handleLogout} style={{padding:"6px 12px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,fontSize:11,fontWeight:600,color:C.sub,cursor:"pointer",fontFamily:FD}}>
            {isES?"Salir":"Logout"}
          </button>}
          {!user&&<button onClick={()=>setShowAuth(true)} style={{padding:"7px 16px",background:C.accent,border:"none",borderRadius:10,fontSize:12,fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:FD}}>
            {isES?"Entrar":"Sign in"}
          </button>}
        </div>
      </div>


      {/* Main content — full width */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",maxWidth:600,width:"100%",margin:"0 auto",background:C.bg,minHeight:"calc(100vh - 120px)"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
          {user&&(window._cgUserEmail=user.email,null)}
          <>
            <InstallPrompt lang={lang} deferred={deferredInstall}/>
            {screen==="home"       &&<Home       col={col} nav={setScreen} lang={lang} isPremium={isPremium} user={user} onInstallClick={()=>setShowInstallModal(true)}/>}
            {screen==="search"     &&<Search     onAdd={addCard} addedIds={addedIds} onTap={c=>setModal(c)} lang={lang} tally={tally}/>}
            {screen==="scanner"    &&<Scanner    onAdd={addCard} lang={lang} userId={user?.id} isPremium={isPremium} onPaywall={()=>setPaywall("scan")} gate={gate} tally={tally}/>}
            {screen==="collection" &&((user||col.length>0)
              ? <Collection col={col} nav={setScreen} onTap={c=>setModal(c)} onRemove={removeCard} lang={lang} onUpdatePrices={handleUpdatePrices} isUpdating={updatingPrices} isGuest={!user} onRegister={()=>setShowAuth(true)} onRefreshCard={user?handleRefreshCard:null}/>
              : <GuestCollectionCTA lang={lang} onRegister={()=>setShowAuth(true)}/>)}
            {screen==="grading"    &&<GradeSheet lang={lang} setLang={setLang} userId={user?.id} isPremium={isPremium} onPaywall={()=>setPaywall("grade")} gate={gate} tally={tally}/>}
          </>
        </div>

        {/* Registro como pantalla superpuesta (solo cuando hace falta) */}
        {showAuth && !user && (
          <div style={{position:"fixed",inset:0,zIndex:350,background:C.bg,overflowY:"auto",maxWidth:600,margin:"0 auto",left:"50%",transform:"translateX(-50%)",width:"100%"}}>
            <AuthScreen onAuth={handleAuth} lang={lang} onClose={()=>setShowAuth(false)}/>
          </div>
        )}

        {/* CARD DETAIL SHEET */}
        {modal&&<div style={{position:"fixed",inset:0,zIndex:300,background:C.white,display:"flex",flexDirection:"column",maxWidth:600,margin:"0 auto",left:"50%",transform:"translateX(-50%)",width:"100%"}}>
          <CardSheet card={modal} onClose={()=>setModal(null)} onAdd={addCard} isAdded={addedIds.has(modal._uid)} onAddAlert={addAlert} lang={lang}
            onPriceUpdate={(newPrice)=>{
              if(modal?._dbId&&user?.token) supa.updateCardPrice(modal._dbId,user.token,newPrice).catch(()=>{});
              setCol(prev=>prev.map(c=>c._uid===modal._uid?{...c,...newPrice}:c));
            }}/>
        </div>}
      </div>

      {/* Bottom nav bar — premium */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(13,15,20,0.98)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:`2px solid ${C.accent}`,display:"flex",zIndex:200,boxShadow:"0 -6px 24px rgba(0,0,0,0.35)"}}>
        <div style={{display:"flex",width:"100%",maxWidth:600,margin:"0 auto",padding:"8px 0 10px"}}>
          {NAV.map(item=>{
            const active=screen===item.id;
            const activeColor=item.id==="grading"?C.gold:C.accent;
            return(
              <button key={item.id} onClick={()=>{setModal(null);setScreen(item.id);}}
                style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"6px 0",position:"relative",transition:"all .15s"}}>
                {/* Active background pill */}
                {active&&<div style={{position:"absolute",top:2,left:"50%",transform:"translateX(-50%)",width:46,height:32,borderRadius:11,background:item.id==="grading"?"rgba(255,215,64,0.22)":"rgba(0,230,118,0.22)"}}/>}
                <span style={{fontSize:23,position:"relative",zIndex:1,opacity:active?1:0.75,transition:"all .15s"}}>{item.i}</span>
                <span style={{fontSize:10,fontWeight:active?800:600,color:active?activeColor:"#9AA3B2",letterSpacing:"0.02em",transition:"color .15s",position:"relative",zIndex:1}}>{item.l}</span>
                {item.id==="collection"&&col.length>0&&(
                  <div style={{position:"absolute",top:0,right:"calc(50% - 24px)",minWidth:16,height:16,background:C.accent,borderRadius:8,fontSize:8,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",boxShadow:`0 2px 6px ${C.accent}66`}}>{col.length}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom padding so content doesn't hide under nav */}
      <div style={{height:78}}/>

      {/* Paywall modal — outside everything, always on top */}
      {paywall&&<PaywallModal type={paywall} onClose={()=>setPaywall(null)} lang={lang}/>}

      {/* Pop-up de instalación */}
      {showInstallModal&&<InstallModal lang={lang} deferred={deferredInstall} onClose={()=>setShowInstallModal(false)}/>}

      {/* Pop-up de propina (Ko-fi) para usuarios registrados */}
      {showTip&&<TipModal lang={lang} onClose={()=>setShowTip(false)}/>}
    </div>
  );
}
