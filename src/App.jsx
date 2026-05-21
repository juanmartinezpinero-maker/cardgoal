import { useState, useRef, useCallback, useEffect } from "react";

/* ─── DESIGN SYSTEM (MonPrice inspired) ─────────────────────
   Clean, white, minimal. One accent color. No dark glass.
──────────────────────────────────────────────────────────────── */
const C = {
  bg:      "#F5F6FA",      // app background
  white:   "#FFFFFF",      // cards, panels
  border:  "#E8EAF0",      // subtle borders
  accent:  "#00C853",      // green — action color
  accentL: "#E8F8EE",      // green light — badges, bg
  accentD: "#009940",      // green dark — hover
  blue:    "#2563EB",      // info
  blueL:   "#EFF6FF",
  red:     "#EF4444",
  redL:    "#FEF2F2",
  gold:    "#F59E0B",
  goldL:   "#FFFBEB",
  text:    "#111827",      // primary text
  sub:     "#6B7280",      // secondary text
  hint:    "#9CA3AF",      // placeholder
  shadow:  "0 2px 12px rgba(0,0,0,0.08)",
  shadowM: "0 4px 24px rgba(0,0,0,0.12)",
};
const FD = "'Syne','Arial Black',sans-serif";
const FB = "'DM Sans','Segoe UI',sans-serif";

/* ─── HELPERS ─────────────────────────────────────────────── */
const eur = n => { const v=parseFloat(n); if(!isFinite(v)) return "—"; return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v); };
const num = v => { const n=parseFloat(v); return isFinite(n)?n:null; };
const toDataURL = f => new Promise((ok,ko) => { const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=ko; r.readAsDataURL(f); });
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
async function callAI(msgs, search=false, maxTok=800) {
  const body = { model:"claude-3-5-sonnet-20241022", max_tokens:maxTok, messages:msgs };
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
];

function searchCards(query) {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  // Score each card against query words
  const scored = CATALOG.map(card => {
    const fields = [
      card.player, card.team, card.season, card.manufacturer,
      card.collection, card.rarity, card.cardNumber||""
    ].join(" ").toLowerCase();

    let score = 0;
    for (const w of words) {
      if (fields.includes(w)) score += w.length; // longer word match = higher score
    }
    return {card, score};
  }).filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score);

  // If no exact matches, find by player name similarity
  if (!scored.length) {
    for (const card of CATALOG) {
      const playerL = card.player.toLowerCase();
      if (words.some(w => w.length > 3 && playerL.includes(w.slice(0,4)))) {
        scored.push({card, score:1});
      }
    }
  }

  // Take top 4, deduplicate by collection
  const seen = new Set();
  const results = [];
  for (const {card} of scored) {
    const key = `${card.player}|${card.collection}|${card.rarity}`;
    if (!seen.has(key) && results.length < 4) {
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
async function fetchPrice(card) {
  // Web search for real eBay price — updates the estimate shown initially
  const raw = await callAI([{role:"user",content:
`eBay sold price in EUR for: ${card.player} ${card.manufacturer||""} ${card.collection||""} ${card.rarity||"Base"} ${card.season||""}
Search eBay SOLD listings last 60 days. USD×0.92=EUR.
JSON only: {"priceEur":25,"priceMin":18,"pricePrem":38,"priceSource":"eBay sold (N sales)","changeWeek":8,"changeMonth":15}`
  }], true, 350);
  const p = jparse(raw);
  if (!p || !p.priceEur) return null;
  return { priceEur:num(p.priceEur), priceMin:num(p.priceMin), pricePrem:num(p.pricePrem), priceSource:p.priceSource||"eBay Sold Listings", changeWeek:num(p.changeWeek), changeMonth:num(p.changeMonth) };
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
const SCAN_P = [
`Expert football card identifier. Return ONLY valid JSON:
{"player":"Full name","team":"Club","season":"2023-24","manufacturer":"Panini/Topps/Upper Deck/Adrenalyn/Match Attax","collection":"Set","cardNumber":"/99 or null","rarity":"Base/Silver/Gold/Rookie/Auto/Refractor","condition":"Near Mint","confidence":0.9}
Not a card: {"player":"NO_CARD","confidence":0}`,
`Identify football card. Return ONLY JSON: {"player":"name","team":"team","manufacturer":"brand","collection":"set","rarity":"Base","season":"year","cardNumber":null,"condition":"NM","confidence":0.7} Not a card: {"player":"NO_CARD","confidence":0}`,
`Football card JSON: {"player":"name","team":"team","manufacturer":"brand","collection":"set","rarity":"Base","season":"?","cardNumber":null,"condition":"NM","confidence":0.5}`
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
  ]}], false, 800);
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

/* ─── CARD VISUAL ─────────────────────────────────────────────
   Full SVG card with player silhouette, team colors, series design.
   Instant — no API calls, no external images needed.
──────────────────────────────────────────────────────────────── */
function CardViz({ card={}, photo=null, sz="md" }) {
  const series  = getSeries(card.manufacturer, card.collection);
  const rs      = RARITY_STYLE(card.rarity||"");
  const jersey  = jnum(card.player||"");
  const [c1,c2,c3] = teamColors(card.team||"");
  const img     = photo && photo.startsWith("data:") ? photo : null;
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
    // Scanner photo — show real image
    return (
      <div style={{width:s.w,height:s.h,borderRadius:s.r,background:series.bg,border:rs?`2px solid ${rs.c}`:"1.5px solid rgba(255,255,255,0.2)",boxShadow:rs?`0 0 20px ${rs.c}55`:"0 4px 20px rgba(0,0,0,0.4)",position:"relative",overflow:"hidden",flexShrink:0}}>
        <img src={img} alt="" style={{width:"100%",height:"75%",objectFit:"cover",objectPosition:"top",display:"block"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.8)",padding:`${s.fp/2}px ${s.fp}px ${s.fp}px`}}>
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
    <div style={{display:"flex",background:C.bg,borderRadius:20,padding:2,gap:1,border:`1px solid ${C.border}`}}>
      {["es","en"].map(l=>(
        <button key={l} onClick={()=>setLang(l)} style={{padding:"4px 10px",borderRadius:18,border:"none",cursor:"pointer",fontFamily:FD,fontSize:10,fontWeight:700,background:lang===l?C.accent:"transparent",color:lang===l?"#fff":C.sub,transition:"all .15s"}}>
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
function CardSheet({card, onClose, onAdd, isAdded, lang}) {
  const [price,setPrice]     = useState(null);
  const [loading,setLoading] = useState(true);

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
    // If we have an estimate, show it immediately (no loading state)
    if(estimatedPrice) setPrice(estimatedPrice);
    setLoading(!estimatedPrice); // only show loading if no estimate

    // Always fetch real price from eBay in background
    fetchPrice(card)
      .then(p=>{ if(alive && p){ setPrice({...p,_isEstimate:false}); setLoading(false); } })
      .catch(()=>{ if(alive) setLoading(false); });
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
    <div style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column",overflow:"hidden",borderRadius:44,background:C.white}}>
      {/* Handle bar */}
      <div style={{flexShrink:0,paddingTop:12,display:"flex",justifyContent:"center"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2}}/>
      </div>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px 12px",flexShrink:0}}>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:C.sub}}>‹</button>
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
            <CardViz card={card} photo={card._thumb||null} sz="lg"/>
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
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
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
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
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
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
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
          <div style={{fontSize:10,color:C.hint,textAlign:"center"}}>{t.source}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── GRADE SHEET ─────────────────────────────────────────── */
function GradeSheet({lang,setLang}) {
  const [ph,setPh]=useState("idle");
  const [durl,setDurl]=useState(null);
  const [res,setRes]=useState(null);
  const [err,setErr]=useState("");
  const fileRef=useRef();
  const reset=()=>{setPh("idle");setDurl(null);setRes(null);setErr("");if(fileRef.current)fileRef.current.value="";};
  const process=useCallback(async file=>{
    if(!file||!file.type.startsWith("image/"))return;
    const d=await toDataURL(file);setDurl(d);setPh("grading");
    try{const g=await gradeCard(d.split(",")[1],file.type,lang);setRes(g);setPh("result");}
    catch(e){setErr(e.message||"Error");setPh("error");}
  },[lang]);

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
          <div key={k} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:12,alignItems:"center",boxShadow:C.shadow}}>
            <span style={{fontSize:24,flexShrink:0}}>{ic}</span>
            <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{k}</div><div style={{fontSize:12,color:C.sub,marginTop:2}}>{v}</div></div>
          </div>
        ))}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files?.[0])}/>
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"16px",background:C.gold,border:"none",borderRadius:14,fontFamily:FD,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:4}}>
          {T.btn}
        </button>
        <button onClick={()=>{if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();}}} style={{width:"100%",padding:"13px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:14,fontFamily:FD,fontSize:14,fontWeight:700,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
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

        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{T.breakdown}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Gauge score={res.centering} label={T.centering}/>
            <Gauge score={res.corners}   label={T.corners}/>
            <Gauge score={res.edges}     label={T.edges}/>
            <Gauge score={res.surface}   label={T.surface}/>
          </div>
        </div>

        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>{T.detail}</div>
          {[[T.centering,res.centeringDetail],[T.corners,res.cornersDetail],[T.edges,res.edgesDetail],[T.surface,res.surfaceDetail]].filter(([,v])=>v).map(([k,v])=>(
            <div key={k} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>{k}</div>
              <div style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{v}</div>
            </div>
          ))}
          {res.mainIssue&&<div style={{background:C.redL,border:`1px solid ${C.red}44`,borderRadius:10,padding:"10px"}}><div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:3}}>{T.factor}</div><div style={{fontSize:12,color:C.sub}}>{res.mainIssue}</div></div>}
        </div>

        {(res.rawValue||res.gradedValue)&&<div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:14,boxShadow:C.shadow}}>
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
function Home({col, nav, lang}) {
  const total = col.reduce((s,c)=>s+(num(c.priceEur)||num(c.price)||0),0);
  const raras = col.filter(c=>c.rarity&&!["base","Base","base card"].includes(c.rarity)).length;
  const isES = lang==="es";

  return (
    <div style={{flex:1,overflowY:"auto",background:C.bg}}>
      {/* Portfolio banner */}
      <div style={{margin:"16px 16px 0",background:C.accent,borderRadius:20,padding:"20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:110,height:110,borderRadius:"50%",background:"rgba(255,255,255,0.1)"}}/>
        <div style={{position:"absolute",right:30,bottom:-30,width:70,height:70,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{isES?"Valor total":"Total value"}</div>
        <div style={{fontFamily:FD,fontSize:36,fontWeight:800,color:"#fff",lineHeight:1,margin:"5px 0 4px"}}>{eur(total)}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:14}}>{col.length===0?(isES?"Añade tu primera carta":"Add your first card"):(isES?"Actualizado automáticamente":"Updated automatically")}</div>
        <div style={{display:"flex",gap:20}}>
          {[[col.length,isES?"cartas":"cards"],[raras,isES?"raras":"rare"],[col.filter(c=>c.scanned).length,isES?"escaneadas":"scanned"]].map(([n,l])=>(
            <div key={l}><div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:"#fff"}}>{n}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.65)"}}>{l}</div></div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"12px 16px 0"}}>
        <button onClick={()=>nav("search")} style={{padding:"14px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,fontFamily:FD,fontSize:13,fontWeight:700,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:C.shadow}}>
          🔍 {isES?"Buscar":"Search"}
        </button>
        <button onClick={()=>nav("scanner")} style={{padding:"14px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,fontFamily:FD,fontSize:13,fontWeight:700,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:C.shadow}}>
          📷 {isES?"Escanear":"Scan"}
        </button>
      </div>
      <button onClick={()=>nav("grading")} style={{margin:"10px 16px 0",width:"calc(100% - 32px)",padding:"13px",background:C.white,border:`1.5px solid ${C.gold}`,borderRadius:16,fontFamily:FD,fontSize:13,fontWeight:700,color:C.gold,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:C.shadow}}>
        🔬 {isES?"Analizar grado PSA":"Analyze PSA grade"}
      </button>

      {/* Recent cards */}
      {col.length>0&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 10px"}}>
          <span style={{fontSize:13,fontWeight:700,color:C.text}}>{isES?"Recientes":"Recent"}</span>
          <span onClick={()=>nav("collection")} style={{fontSize:12,color:C.accent,fontWeight:600,cursor:"pointer"}}>{isES?"Ver todo →":"See all →"}</span>
        </div>
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
          {col.slice(-3).reverse().map((card,i)=>(
            <div key={card._uid||i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:C.shadow,cursor:"pointer"}} onClick={()=>nav("collection")}>
              <CardViz card={card} photo={card._thumb||null} sz="sm"/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.player}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:2}}>{card.collection||card.manufacturer} · {card.rarity||"Base"}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:FD,fontSize:14,fontWeight:800,color:C.text}}>{eur(num(card.priceEur)||num(card.price))}</div>
                {num(card.changeWeek)!=null&&<div style={{fontSize:10,fontWeight:700,color:card.changeWeek>=0?C.accent:C.red,marginTop:2}}>{card.changeWeek>=0?"↑":"↓"}{Math.abs(card.changeWeek)}%</div>}
              </div>
            </div>
          ))}
        </div>
      </>}
      <div style={{height:20}}/>
    </div>
  );
}

/* SEARCH */
function Search({onAdd, addedIds, onTap, lang}) {
  const [q,setQ]       = useState("");
  const [cards,setCards] = useState([]);
  const [st,setSt]     = useState("idle");
  const ref = useRef();
  const isES = lang==="es";
  useEffect(()=>{ setTimeout(()=>ref.current?.focus(),80); },[]);

  const go = () => {
    const query=q.trim(); if(!query) return;
    setSt("loading"); setCards([]);
    setTimeout(() => {
      const r = searchCards(query);
      if(!r.length) { setSt("empty"); return; }
      setCards(r); setSt("done");
    }, 0);
  };

  const CHIPS = ["Yamal 2024","Bellingham Prizm","Mbappé Chrome","Pedri Adrenalyn","Haaland auto","Vinicius /25","Messi Topps","Ronaldo Panini"];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg,overflow:"hidden"}}>
      {/* Search bar */}
      <div style={{padding:"12px 16px 10px",background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{fontSize:18,fontFamily:FD,fontWeight:800,color:C.text,marginBottom:10}}>{isES?"Buscar carta":"Search card"}</div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"0 12px",transition:"border-color .15s"}}>
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
            <div key={card._uid} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:18,overflow:"hidden",marginBottom:14,boxShadow:C.shadow}}>
              {/* Card visual */}
              <div onClick={()=>onTap({...card})} style={{display:"flex",justifyContent:"center",padding:"20px 16px 14px",background:`linear-gradient(180deg,${C.bg},${C.white})`,cursor:"pointer"}}>
                <CardViz card={card} sz="xl"/>
              </div>
              {/* Info */}
              <div style={{padding:"10px 16px 0"}}>
                <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{card.player}</div>
                <div style={{fontSize:13,color:C.sub,marginTop:2}}>{card.team}{card.season?` · ${card.season}`:""}</div>
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  {card.manufacturer&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.manufacturer}</span>}
                  {card.collection&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.collection}</span>}
                  {card.rarity&&card.rarity!=="Base"&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:C.goldL,color:C.gold,border:`1px solid ${C.gold}44`}}>★ {card.rarity}</span>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <div style={{fontSize:11,color:C.accent,fontWeight:600}}>👆 {isES?"Toca para estadísticas":"Tap for stats"}</div>
                  {card.priceEur&&<div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:C.text}}>{eur(card.priceEur)}</div>}
                </div>
              </div>
              {/* Add */}
              <div style={{padding:"10px 16px 14px"}}>
                <button onClick={()=>onAdd({...card})} disabled={isAdded} style={{width:"100%",padding:"12px",background:isAdded?C.accentL:C.accent,border:isAdded?`1.5px solid ${C.accent}`:"none",borderRadius:12,fontFamily:FD,fontSize:13,fontWeight:700,color:isAdded?C.accent:"#fff",cursor:isAdded?"default":"pointer",transition:"all .2s"}}>
                  {isAdded?(isES?"✓ En tu colección":"✓ In collection"):(isES?"+ Añadir a colección":"+ Add to collection")}
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
function Scanner({onAdd, lang}) {
  const [ph,setPh]=useState("idle");
  const [durl,setDurl]=useState(null);
  const [card,setCard]=useState(null);
  const [price,setPrice]=useState(null);
  const [err,setErr]=useState("");
  const [added,setAdded]=useState(false);
  const fileRef=useRef();
  const isES=lang==="es";
  const reset=()=>{setPh("idle");setDurl(null);setCard(null);setPrice(null);setErr("");setAdded(false);if(fileRef.current)fileRef.current.value="";};
  const process=useCallback(async file=>{
    if(!file||!file.type.startsWith("image/"))return;
    const d=await toDataURL(file);setDurl(d);setPh("scanning");setAdded(false);
    try{
      const b64=d.split(",")[1];
      const c=await scanCard(b64,file.type);setCard(c);setPh("pricing");
      let p=null;try{p=await fetchPrice(c);}catch{}
      setPrice(p);setPh("result");
    }catch(e){setErr(e.message==="NO_CARD"?(isES?"No parece ser una carta de fútbol.":"Doesn't look like a football card."):(isES?"No pude identificarla. Prueba con más luz.":"Couldn't identify it. Try better lighting."));setPh("error");}
  },[lang]);

  if(ph==="idle")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28,gap:16,background:C.bg}}>
      <div style={{fontSize:64}}>📷</div>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{isES?"Scanner IA":"AI Scanner"}</div>
        <div style={{fontSize:13,color:C.sub,marginTop:6,lineHeight:1.6,maxWidth:260}}>{isES?"Haz foto a tu carta. La IA la identifica y busca el precio real en eBay y Cardmarket.":"Take a photo. AI identifies it and finds the real price on eBay and Cardmarket."}</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files?.[0])}/>
      <button onClick={()=>fileRef.current?.click()} style={{width:"100%",maxWidth:280,padding:"16px",background:C.accent,border:"none",borderRadius:16,fontFamily:FD,fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:`0 4px 16px ${C.accent}44`}}>
        📷 {isES?"Usar cámara":"Use camera"}
      </button>
      <button onClick={()=>{if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();}}} style={{width:"100%",maxWidth:280,padding:"13px",background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,fontFamily:FD,fontSize:14,fontWeight:700,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:C.shadow}}>
        🖼️ {isES?"Subir imagen":"Upload image"}
      </button>
    </div>
  );

  if(ph==="scanning"||ph==="pricing")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:20,background:C.bg}}>
      {durl&&<div style={{width:160,height:224,borderRadius:14,overflow:"hidden",border:`3px solid ${C.accent}`,boxShadow:`0 0 24px ${C.accent}44`}}>
        <img src={durl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>}
      <Spinner/>
      <div style={{fontSize:13,color:C.sub,textAlign:"center"}}>{ph==="scanning"?(isES?"Analizando carta con IA…":"Analyzing with AI…"):(isES?"Buscando precio real…":"Searching real price…")}</div>
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
      <div style={{flex:1,overflowY:"auto",background:C.bg}}>
        <div style={{background:C.white,padding:"20px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`}}>
          <CardViz card={card} photo={durl} sz="xl"/>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{card.player}</div>
            <div style={{fontSize:13,color:C.sub,marginTop:3}}>{card.team}{card.season?` · ${card.season}`:""}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
            {card.manufacturer&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.bg,color:C.sub,border:`1px solid ${C.border}`}}>{card.manufacturer}</span>}
            {card.rarity&&card.rarity!=="Base"&&<span style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.goldL,color:C.gold,border:`1px solid ${C.gold}44`}}>★ {card.rarity}</span>}
          </div>
          <span style={{padding:"3px 10px",borderRadius:8,fontSize:10,fontWeight:600,background:C.accentL,color:C.accent,border:`1px solid ${C.accent}44`}}>🤖 IA · {Math.round((num(card.confidence)||0.7)*100)}%</span>
        </div>
        <div style={{padding:"16px"}}>
          {p!=null?<>
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:12,boxShadow:C.shadow}}>
              <div style={{fontSize:11,color:C.sub,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{isES?"Precio de mercado":"Market price"}</div>
              <div style={{fontFamily:FD,fontSize:32,fontWeight:800,color:C.text,margin:"4px 0"}}>{eur(p)}</div>
              {price?.priceSource&&<div style={{fontSize:10,color:C.accent,fontWeight:600}}>📊 {price.priceSource}</div>}
            </div>
            {num(price?.priceMin)!=null&&<div style={{display:"flex",gap:8,marginBottom:12}}>
              <PriceTag value={price.priceMin} label={isES?"Mínimo":"Minimum"}/>
              <PriceTag value={p} label={isES?"Medio":"Average"} highlight/>
              <PriceTag value={price.pricePrem} label={isES?"Premium":"Premium"}/>
            </div>}
          </>:<div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:12,textAlign:"center",boxShadow:C.shadow}}>
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
function Collection({col, nav, onTap, lang}) {
  const [filt,setFilt]=useState("all");
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
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0,padding:"14px 18px 10px"}}>
        <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>{isES?"Mi Colección":"My Collection"}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
          <span style={{fontFamily:FD,fontSize:28,fontWeight:800,color:C.accent}}>{eur(total)}</span>
          <span style={{fontSize:13,color:C.sub}}>{col.length} {isES?"cartas":"cards"}</span>
        </div>
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
                style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer",boxShadow:C.shadow,transition:"box-shadow .15s,transform .1s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=C.shadowM;e.currentTarget.style.transform="scale(1.02)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=C.shadow;e.currentTarget.style.transform="scale(1)";}}>
                <div style={{display:"flex",justifyContent:"center",padding:"12px 10px 8px",background:`linear-gradient(180deg,${C.bg},${C.white})`}}>
                  <CardViz card={card} photo={card._thumb||null} sz="md"/>
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
  const [col,setCol]       = useState([]);
  const [addedIds,setAdded]= useState(new Set());
  const [modal,setModal]   = useState(null);
  const [lang,setLang]     = useState("es");

  const addCard = useCallback(card => {
    const uid = card._uid||`uid_${Date.now()}`;
    setCol(prev=>[...prev,{...card,_uid:uid}]);
    setAdded(prev=>new Set([...prev,uid]));
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
    <div style={{fontFamily:FB,background:"#E8EBF5",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { display:none; }
        input::placeholder { color:${C.hint}; }
      `}</style>

      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
        {/* Top bar */}
        <div style={{width:"100%",maxWidth:345,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:C.text}}>CardGoal ⚽</div>
            {col.length>0&&<div style={{fontSize:11,color:C.sub,marginTop:1}}>{eur(total)} · {col.length} {isES?"cartas":"cards"}</div>}
          </div>
          <LangBtn lang={lang} setLang={setLang}/>
        </div>

        {/* Phone frame — clean white */}
        <div style={{
          width:345, height:700,
          background:C.bg,
          borderRadius:44,
          border:"2px solid rgba(0,0,0,0.08)",
          overflow:"hidden",
          display:"flex",
          flexDirection:"column",
          boxShadow:"0 0 0 6px rgba(255,255,255,0.8),0 20px 60px rgba(0,0,0,0.15)",
          position:"relative",
        }}>
          {/* Notch */}
          <div style={{width:90,height:6,background:"rgba(0,0,0,0.12)",borderRadius:3,margin:"10px auto 0",flexShrink:0}}/>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 22px 4px",fontSize:11,color:C.hint,flexShrink:0}}>
            <span style={{fontWeight:600}}>9:41</span><span>●●● 100%</span>
          </div>

          {/* Screens */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
            {screen==="home"       &&<Home       col={col} nav={setScreen} lang={lang}/>}
            {screen==="search"     &&<Search     onAdd={addCard} addedIds={addedIds} onTap={c=>setModal(c)} lang={lang}/>}
            {screen==="scanner"    &&<Scanner    onAdd={addCard} lang={lang}/>}
            {screen==="collection" &&<Collection col={col} nav={setScreen} onTap={c=>setModal(c)} lang={lang}/>}
            {screen==="grading"    &&<GradeSheet lang={lang} setLang={setLang}/>}
          </div>

          {/* Nav bar — clean white */}
          <div style={{display:"flex",background:C.white,borderTop:`1px solid ${C.border}`,padding:"8px 0 10px",flexShrink:0}}>
            {NAV.map(item=>{
              const active=screen===item.id;
              return(
                <button key={item.id} onClick={()=>{setModal(null);setScreen(item.id);}}
                  style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"2px 0",position:"relative",transition:"opacity .15s"}}>
                  <span style={{fontSize:16,opacity:active?1:0.4}}>{item.i}</span>
                  <span style={{fontSize:9,fontWeight:700,color:active?(item.id==="grading"?C.gold:C.accent):C.hint,letterSpacing:"0.02em"}}>{item.l}</span>
                  {active&&<div style={{width:18,height:2.5,background:item.id==="grading"?C.gold:C.accent,borderRadius:2,marginTop:1}}/>}
                  {item.id==="collection"&&col.length>0&&(
                    <div style={{position:"absolute",top:0,right:"calc(50% - 20px)",minWidth:15,height:15,background:C.accent,borderRadius:8,fontSize:8,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{col.length}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* CARD DETAIL SHEET — slides over everything */}
          {modal&&<CardSheet card={modal} onClose={()=>setModal(null)} onAdd={addCard} isAdded={addedIds.has(modal._uid)} lang={lang}/>}
        </div>
      </div>
    </div>
  );
}
