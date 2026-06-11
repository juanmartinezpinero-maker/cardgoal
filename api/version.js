// api/version.js — devuelve la versión actual del deploy
// Vercel actualiza VERCEL_GIT_COMMIT_SHA automáticamente en cada deploy
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || Date.now().toString()
  });
}
