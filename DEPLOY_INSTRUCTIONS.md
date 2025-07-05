# Deployment Instructions for n8n-mcp

## 1. Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository:
   - Repository name: `n8n-mcp`
   - Description: "n8n MCP Server - Documentation and tools for n8n nodes via Model Context Protocol"
   - Keep it PUBLIC (required for Railway deployment from GitHub)
   - DO NOT initialize with README (we already have one)

## 2. Push to Your GitHub

Once the repository is created, run:

```bash
cd /Volumes/vredrick2/N8N\ Worflows/n8n-mcp
git push -u origin main
```

## 3. Deploy to Railway from GitHub

1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub if needed
5. Select `vredrick/n8n-mcp` repository
6. Railway will auto-detect and start deployment

## 4. Configure Environment Variables in Railway

Add these in the Railway dashboard:

```
MCP_MODE=http
USE_FIXED_HTTP=true
SSE_ENABLED=true
NODE_ENV=production
AUTH_TOKEN=[generate with: openssl rand -base64 32]
```

## 5. Get Your Deployment URL

After deployment:
- Railway will provide a URL like: `https://n8n-mcp-production.up.railway.app`
- Test health: `https://your-app.up.railway.app/health`
- SSE endpoint: `https://your-app.up.railway.app/mcp/sse`

## 6. Configure n8n MCP Client

In your n8n workflow:
- SSE Endpoint: `https://your-app.up.railway.app/mcp/sse`
- Authentication: Bearer Token
- Token: [Your AUTH_TOKEN from Railway]

## Features Included

✅ SSE support for n8n MCP Client compatibility
✅ 22 documentation tools (48 with n8n API configured)
✅ Bearer token authentication
✅ Docker deployment ready
✅ Health check endpoint
✅ Auto-reconnect with heartbeat

## Testing

```bash
# Test health
curl https://your-app.up.railway.app/health

# Test SSE (replace YOUR_TOKEN)
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.up.railway.app/mcp/sse
```