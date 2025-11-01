import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import httpProxy from "http-proxy";

const {
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  GATEWAY_BASE_URL,
  AUTH0_AUDIENCE,
  MCP_TARGET_BASE_URL,
} = process.env;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Auth0 Redirect (/authorize) ---
app.get("/authorize", (req, res) => {
  const params = new URLSearchParams({
    client_id: AUTH0_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${GATEWAY_BASE_URL}/token`,
    scope: "openid profile email",
    ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
    state: req.query.state || "",
  });
  res.redirect(`https://${AUTH0_DOMAIN}/authorize?${params.toString()}`);
});

// --- OAuth: /authorize -> Redirect zu Auth0 ---
app.get("/authorize", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.AUTH0_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.GATEWAY_BASE_URL}/token`,
    scope: "openid profile email",
    state: req.query.state || ""
  });
  res.redirect(`https://${process.env.AUTH0_DOMAIN}/authorize?${params.toString()}`);
});

// --- Token Endpoint (/token) ---
app.all("/token", async (req, res) => {
  const code = req.method === "POST" ? req.body.code : req.query.code;
  if (!code) return res.status(400).json({ error: "missing_code" });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: AUTH0_CLIENT_ID,
    client_secret: AUTH0_CLIENT_SECRET,
    code,
    redirect_uri: `${GATEWAY_BASE_URL}/token`,
  });

  const r = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await r.json();
  return res.status(r.status).json(data);
});

// --- JWT Validierung ---
const client = jwksClient({ jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json` });
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_bearer" });

  jwt.verify(
    token,
    getKey,
    { audience: AUTH0_AUDIENCE || undefined, issuer: `https://${AUTH0_DOMAIN}/`, algorithms: ["RS256"] },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: "invalid_token", details: err.message });
      req.user = decoded;
      next();
    }
  );
}

// --- Proxy zu n8n-MCP ---
const proxy = httpProxy.createProxyServer({ changeOrigin: true });
app.all("/mcp/*", requireAuth, (req, res) => {
  proxy.web(req, res, { target: MCP_TARGET_BASE_URL }, (e) => {
    res.status(502).json({ error: "proxy_error", details: e?.message });
  });
});

app.get("/", (_, res) => res.send("MCP OAuth Gateway up ✅"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Gateway läuft auf Port ${port}`));


// Healthcheck endpoint für Railway
app.get("/health", (_, res) => res.status(200).send("OK"));

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ MCP OAuth Gateway läuft auf Port ${port}`));
