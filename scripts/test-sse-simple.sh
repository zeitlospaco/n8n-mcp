#!/bin/bash

# Simple SSE test script

echo "🔍 Testing SSE endpoint..."
echo "📍 URL: http://localhost:3000/mcp/sse"
echo ""

# Test with curl - timeout after 5 seconds
timeout 5 curl -N \
  -H "Authorization: Bearer test-token" \
  -H "Accept: text/event-stream" \
  http://localhost:3000/mcp/sse

echo ""
echo "✅ SSE test completed"