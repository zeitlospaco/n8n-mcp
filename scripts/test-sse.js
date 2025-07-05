#!/usr/bin/env node
/**
 * Test script for SSE (Server-Sent Events) connection
 * Tests the SSE bridge endpoint for n8n MCP Client compatibility
 */

const EventSource = require('eventsource');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-token';
const SSE_URL = `${BASE_URL}/mcp/sse?token=${AUTH_TOKEN}`;

console.log('🔄 Testing SSE connection to n8n-mcp...');
console.log(`📍 SSE URL: ${SSE_URL}`);

// Create SSE connection
const eventSource = new EventSource(SSE_URL, {
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

let clientId = null;

// Handle connection open
eventSource.onopen = () => {
  console.log('✅ SSE connection established');
};

// Handle messages
eventSource.onmessage = (event) => {
  console.log('📨 Received message:', event.data);
};

// Handle specific events
eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  clientId = data.clientId;
  console.log('🔗 Connected with client ID:', clientId);
  console.log('📦 Server capabilities:', data.capabilities);
  
  // Test tool call after connection
  setTimeout(() => testToolCall(), 1000);
});

eventSource.addEventListener('tools', (event) => {
  const data = JSON.parse(event.data);
  console.log(`🛠️  Available tools: ${data.tools.length}`);
  console.log('📝 First 5 tools:', data.tools.slice(0, 5).map(t => t.name));
});

eventSource.addEventListener('heartbeat', (event) => {
  const data = JSON.parse(event.data);
  console.log('💓 Heartbeat:', data.timestamp);
});

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('💬 Message response:', JSON.stringify(data, null, 2));
});

// Handle errors
eventSource.onerror = (error) => {
  console.error('❌ SSE error:', error);
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('🔌 Connection closed');
  }
};

// Test tool call via POST endpoint
async function testToolCall() {
  if (!clientId) {
    console.log('⚠️  No client ID, skipping tool call test');
    return;
  }
  
  console.log('\n🧪 Testing tool call via POST endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/mcp/sse/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-Client-ID': clientId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Tool call response received via POST');
    console.log(`📊 Tools count: ${result.result?.tools?.length || 0}`);
    
    // Test actual tool execution
    await testToolExecution();
    
  } catch (error) {
    console.error('❌ Tool call failed:', error);
  }
}

// Test actual tool execution
async function testToolExecution() {
  console.log('\n🧪 Testing tool execution...');
  
  try {
    const response = await fetch(`${BASE_URL}/mcp/sse/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-Client-ID': clientId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_nodes',
          arguments: {
            query: 'webhook',
            limit: 3
          }
        },
        id: 2
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Tool execution response received');
    console.log('📋 Result preview:', JSON.stringify(result.result?.content?.[0]?.text?.substring(0, 200) || 'No content', null, 2));
    
  } catch (error) {
    console.error('❌ Tool execution failed:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing SSE connection...');
  eventSource.close();
  process.exit(0);
});

// Exit after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Test completed, closing connection...');
  eventSource.close();
  process.exit(0);
}, 30000);

console.log('🎯 SSE test started. Press Ctrl+C to stop.');
console.log('⏱️  Test will automatically end in 30 seconds...\n');