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
