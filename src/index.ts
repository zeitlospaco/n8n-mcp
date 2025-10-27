/**
 * n8n-MCP - Model Context Protocol Server for n8n
 * Secure + ChatGPT-OAuth compatible version
 */

import express from "express";
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "dev-token";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://n8n-mcp-production-ae6c.up.railway.app";

/* -----------------------------------------------------
   1️⃣ Fake-OAuth endpoints (must come BEFORE auth middleware)
----------------------------------------------------- */

// Discovery endpoint (ChatGPT checks this first)
app.get("/.well-known/oauth-authorization-server", (_, res) => {
  res.json({
    issuer: PUBLIC_URL,
    authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
    token_endpoint: `${PUBLIC_URL}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
  });
});

// Simulated authorize step
app.get("/oauth/authorize", (_, res) => {
  res.send("OAuth authorization simulated OK");
});

// Token exchange step
app.post("/oauth/token", (req, res) => {
  const { client_id, client_secret } = req.body || {};

  // Optional check – can be skipped if not needed
  if (process.env.CLIENT_ID && client_id !== process.env.CLIENT_ID)
    return res.status(401).json({ error: "invalid_client_id" });
  if (process.env.CLIENT_SECRET && client_secret !== process.env.CLIENT_SECRET)
    return res.status(401).json({ error: "invalid_client_secret" });

  // Return a fake access token (same as AUTH_TOKEN)
  res.json({
    access_token: AUTH_TOKEN,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

/* -----------------------------------------------------
   2️⃣ Auth middleware (protects everything below)
----------------------------------------------------- */
app.use((req, res, next) => {
  // Allow OAuth and health endpoints to skip auth
  if (
    req.path.startsWith("/.well-known/") ||
    req.path.startsWith("/oauth") ||
    req.path === "/health"
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!AUTH_TOKEN) return res.status(500).send("Server missing AUTH_TOKEN");
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`)
    return res.status(401).send("Unauthorized");

  next();
});

/* -----------------------------------------------------
   3️⃣ Health endpoint
----------------------------------------------------- */
app.get("/health", (_, res) => {
  res.send("OK");
});

/* -----------------------------------------------------
   4️⃣ Start server
----------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ MCP Server running on port ${PORT}`);
});
