/**
 * n8n-MCP - Model Context Protocol Server for n8n
 * Secure + ChatGPT-OAuth compatible version (TypeScript-safe)
 */

import express, { Request, Response, NextFunction } from "express";
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "dev-token";
const PUBLIC_URL =
  process.env.PUBLIC_URL || "https://n8n-mcp-production-ae6c.up.railway.app";

/* -----------------------------------------------------
   1️⃣ Fake-OAuth endpoints (must come BEFORE auth middleware)
----------------------------------------------------- */

// Discovery endpoint (ChatGPT checks this first)
app.get(
  "/.well-known/oauth-authorization-server",
  (_: Request, res: Response): void => {
    res.json({
      issuer: PUBLIC_URL,
      authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
      token_endpoint: `${PUBLIC_URL}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
    });
  }
);

// Simulated authorize step
app.get("/oauth/authorize", (_: Request, res: Response): void => {
  res.send("OAuth authorization simulated OK");
});

// Token exchange step
app.post("/oauth/token", (req: Request, res: Response): void => {
  const { client_id, client_secret } = req.body || {};

  try {
    // Optional check
    if (process.env.CLIENT_ID && client_id !== process.env.CLIENT_ID) {
      res.status(401).json({ error: "invalid_client_id" });
      return;
    }
    if (process.env.CLIENT_SECRET && client_secret !== process.env.CLIENT_SECRET) {
      res.status(401).json({ error: "invalid_client_secret" });
      return;
    }

    // Always return a response (TS fix)
    res.status(200).json({
      access_token: AUTH_TOKEN,
      token_type: "Bearer",
      expires_in: 3600,
    });
    return;
  } catch (err) {
    // ✅ Explicit return ensures all code paths return
    res.status(500).json({ error: "server_error", details: (err as Error).message });
    return;
  }
});

/* -----------------------------------------------------
   2️⃣ Auth middleware (protects everything below)
----------------------------------------------------- */
app.use((req: Request, res: Response, next: NextFunction): void => {
  // Allow OAuth + health routes
  if (
    req.path.startsWith("/.well-known/") ||
    req.path.startsWith("/oauth") ||
    req.path === "/health"
  ) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!AUTH_TOKEN) {
    res.status(500).send("Server missing AUTH_TOKEN");
    return;
  }
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    res.status(401).send("Unauthorized");
    return;
  }

  next();
});

/* -----------------------------------------------------
   3️⃣ Health endpoint
----------------------------------------------------- */
app.get("/health", (_: Request, res: Response): void => {
  res.send("OK");
});

/* -----------------------------------------------------
   4️⃣ Start server
----------------------------------------------------- */
app.listen(PORT, (): void => {
  console.log(`✅ MCP Server running on port ${PORT}`);
});
