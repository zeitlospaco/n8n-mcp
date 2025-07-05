/**
 * SSE Bridge for n8n-MCP
 * Provides Server-Sent Events transport for compatibility with n8n MCP Client node
 */
import { Request, Response } from 'express';
import { N8NDocumentationMCPServer } from './mcp/server';
import { logger } from './utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { n8nDocumentationToolsFinal } from './mcp/tools';
import { n8nManagementTools } from './mcp/tools-n8n-manager';
import { isN8nApiConfigured } from './config/n8n-api';

interface SSEClient {
  id: string;
  response: Response;
  server: N8NDocumentationMCPServer;
  heartbeatInterval?: NodeJS.Timeout;
}

export class SSEBridge {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: number = 30000; // 30 seconds

  constructor() {
    // Clean up stale connections periodically
    setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  /**
   * Handle SSE connection request
   */
  async handleSSEConnection(req: Request, res: Response): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    
    // CORS headers (already set by main server, but reinforcing)
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    
    // Generate client ID
    const clientId = uuidv4();
    
    try {
      // Create MCP server instance for this client
      const server = new N8NDocumentationMCPServer();
      
      // Create client entry
      const client: SSEClient = {
        id: clientId,
        response: res,
        server,
      };
      
      this.clients.set(clientId, client);
      logger.info('SSE client connected', { clientId });
      
      // Send initial connection message
      this.sendEvent(res, 'connected', { 
        clientId,
        version: '2.7.4',
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
        }
      });
      
      // Start heartbeat
      client.heartbeatInterval = setInterval(() => {
        this.sendEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
      }, this.heartbeatInterval);
      
      // Handle client disconnect
      req.on('close', () => {
        this.handleDisconnect(clientId);
      });
      
      // Send initial tools list
      await this.sendToolsList(client);
      
    } catch (error) {
      logger.error('Failed to establish SSE connection', { clientId, error });
      res.status(500).end();
      this.handleDisconnect(clientId);
    }
  }

  /**
   * Handle incoming messages from client (via POST endpoint)
   */
  async handleMessage(req: Request, res: Response): Promise<void> {
    const clientId = req.headers['x-client-id'] as string;
    
    if (!clientId || !this.clients.has(clientId)) {
      res.status(400).json({ error: 'Invalid or missing client ID' });
      return;
    }
    
    const client = this.clients.get(clientId)!;
    const message = req.body;
    
    try {
      logger.debug('SSE message received', { clientId, method: message.method });
      
      // Handle JSON-RPC request
      const result = await this.processJsonRpcRequest(client, message);
      
      // Send response via SSE
      this.sendEvent(client.response, 'message', result);
      
      // Also return in POST response for compatibility
      res.json(result);
      
    } catch (error) {
      logger.error('Error processing SSE message', { clientId, error });
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: message.id || null
      };
      
      this.sendEvent(client.response, 'message', errorResponse);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Process JSON-RPC request
   */
  private async processJsonRpcRequest(client: SSEClient, request: any): Promise<any> {
    const { method, params, id } = request;
    
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: 'n8n-documentation-mcp',
              version: '2.7.4',
            },
          },
          id,
        };
        
      case 'tools/list':
        // Get the tools list directly
        const tools = [...n8nDocumentationToolsFinal];
        
        // Add management tools if n8n API is configured
        if (isN8nApiConfigured()) {
          tools.push(...n8nManagementTools);
        }
        
        return {
          jsonrpc: '2.0',
          result: { tools },
          id,
        };
        
      case 'tools/call':
        const result = await client.server.executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          result,
          id,
        };
        
      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id,
        };
    }
  }

  /**
   * Send event to SSE client
   */
  private sendEvent(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      res.flushHeaders();
    } catch (error) {
      logger.error('Failed to send SSE event', { error });
    }
  }

  /**
   * Send initial tools list
   */
  private async sendToolsList(client: SSEClient): Promise<void> {
    try {
      // Get the tools list directly
      const tools = [...n8nDocumentationToolsFinal];
      
      // Add management tools if n8n API is configured
      if (isN8nApiConfigured()) {
        tools.push(...n8nManagementTools);
      }
      
      this.sendEvent(client.response, 'tools', { tools });
    } catch (error) {
      logger.error('Failed to send tools list', { clientId: client.id, error });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.heartbeatInterval) {
        clearInterval(client.heartbeatInterval);
      }
      this.clients.delete(clientId);
      logger.info('SSE client disconnected', { clientId });
    }
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    for (const [clientId, client] of this.clients) {
      if (client.response.destroyed || client.response.writableEnded) {
        this.handleDisconnect(clientId);
      }
    }
  }

  /**
   * Get active client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const sseBridge = new SSEBridge();