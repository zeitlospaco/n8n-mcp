/**
 * n8n-MCP - Model Context Protocol Server for n8n
 * Copyright (c) 2024 AiAdvisors Romuald Czlonkowski
 * Licensed under the Sustainable Use License v1.0
 */

// Engine exports for service integration
export { N8NMCPEngine, EngineHealth, EngineOptions } from './mcp-engine';
export { SingleSessionHTTPServer } from './http-server-single-session';
export { ConsoleManager } from './utils/console-manager';
export { N8NDocumentationMCPServer } from './mcp/server';

// Default export for convenience
import N8NMCPEngine from './mcp-engine';
export default N8NMCPEngine;

// Legacy CLI functionality - moved to ./mcp/index.ts
// This file now serves as the main entry point for library usage

// -----------------------------------------------------
// ✅ AUTH Middleware hinzufügen (Token-Schutz)
// -----------------------------------------------------
import express from "express";

const app = express();
const AUTH_TOKEN = process.env.AUTH_TOKEN;

app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!AUTH_TOKEN) {
    res.status(500).send("Server missing AUTH_TOKEN");
    return; // ✅ return hinzugefügt
  }
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    res.status(401).send("Unauthorized");
    return; // ✅ return hinzugefügt
  }
  next();
});


app.get("/health", (_, res) => {
  res.send("OK");
});

app.listen(process.env.PORT || 8080, () => {
  console.log("✅ MCP Server is running with auth enabled");
});

// -----------------------------------------------------
// 🧠 Simulierter OAuth-Flow für ChatGPT-MCP
// -----------------------------------------------------

/**
 * 1️⃣ OAuth-Discovery (ChatGPT ruft das zuerst auf)
 * Liefert die "Auth-Konfiguration" zurück, damit ChatGPT versteht:
 *   - welcher Flow genutzt wird
 *   - wo es sich authentifizieren soll
 */
app.get("/.well-known/oauth-authorization-server", (_, res) => {
  res.json({
    issuer: process.env.PUBLIC_URL || "https://n8n-mcp-production-ae6c.up.railway.app",
    authorization_endpoint: "/oauth/authorize",
    token_endpoint: "/oauth/token",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
  });
});

/**
 * 2️⃣ OAuth-Autorisierungs-Endpunkt (simuliert)
 * Gibt einfach "OK" zurück – ChatGPT will nur prüfen, ob's existiert.
 */
app.get("/oauth/authorize", (_, res) => {
  res.send("OAuth authorization simulated OK");
});

/**
 * 3️⃣ OAuth-Token-Endpunkt (wird bei ChatGPT im Hintergrund aufgerufen)
 * Antwortet mit einem gefälschten Access Token, das deinem AUTH_TOKEN entspricht.
 */
app.post("/oauth/token", express.json(), (req, res) => {
  const { client_id, client_secret } = req.body;

  // Optionaler Sicherheits-Check:
  if (process.env.CLIENT_ID && client_id !== process.env.CLIENT_ID) {
    return res.status(401).json({ error: "invalid_client_id" });
  }
  if (process.env.CLIENT_SECRET && client_secret !== process.env.CLIENT_SECRET) {
    return res.status(401).json({ error: "invalid_client_secret" });
  }

  // Gib gefälschtes Token zurück (eigentlich dein AUTH_TOKEN)
  res.json({
    access_token: process.env.AUTH_TOKEN || "dev-token",
    token_type: "Bearer",
    expires_in: 3600,
  });
});
