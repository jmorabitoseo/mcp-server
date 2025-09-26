#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DataForSEOClient, DataForSEOConfig } from '../core/client/dataforseo.client.js';
import { SerpApiModule } from '../core/modules/serp/serp-api.module.js';
import { KeywordsDataApiModule } from '../core/modules/keywords-data/keywords-data-api.module.js';
import { OnPageApiModule } from '../core/modules/onpage/onpage-api.module.js';
import { DataForSEOLabsApi } from '../core/modules/dataforseo-labs/dataforseo-labs-api.module.js';
import { EnabledModulesSchema, isModuleEnabled, defaultEnabledModules } from '../core/config/modules.config.js';
import { BaseModule, ToolDefinition } from '../core/modules/base.module.js';
import { z } from 'zod';
import { BacklinksApiModule } from "../core/modules/backlinks/backlinks-api.module.js";
import { BusinessDataApiModule } from "../core/modules/business-data-api/business-data-api.module.js";
import { DomainAnalyticsApiModule } from "../core/modules/domain-analytics/domain-analytics-api.module.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request as ExpressRequest, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { GetPromptResult, isInitializeRequest, ReadResourceResult, ServerNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import { name, version } from '../core/utils/version.js';
import { ModuleLoaderService } from "../core/utils/module-loader.js";
import { initializeFieldConfiguration } from '../core/config/field-configuration.js';
import { initMcpServer } from "./init-mcp-server.js";

// Initialize field configuration if provided
initializeFieldConfiguration();

// Extended request interface to include auth properties
interface Request extends ExpressRequest {
  username?: string;
  password?: string;
}

console.error('Starting DataForSEO MCP Server...');
console.error(`Server name: ${name}, version: ${version}`);

function getSessionId() {
  return randomUUID().toString();
}

async function main() {
  const app = express();
  app.use(express.json());

  // Simple UI page for quick manual testing
  app.get('/', (_req, res) => {
    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DataForSEO MCP - Quick Tester</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    input, select, button, textarea { font: inherit; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; }
    button { background: #111827; color: white; cursor: pointer; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    label { font-size: 12px; color: #374151; display:block; margin-bottom: 4px; }
    .field { display:flex; flex-direction:column; min-width: 220px; }
    #out { white-space: pre-wrap; background: #0b1020; color: #e5e7eb; padding: 12px; border-radius: 8px; min-height: 160px; }
    .note { color:#6b7280; font-size:12px; }
  </style>
  <script>
    const serviceUrl = location.origin + '/mcp';

    async function sendRpc(method, params) {
      setBusy(true);
      try {
        const headers = {
          'Accept': 'application/json, text/event-stream',
          'Content-Type': 'application/json'
        };
        const body = JSON.stringify({ jsonrpc: '2.0', id: String(Date.now()), method, params });
        const res = await fetch(serviceUrl, { method: 'POST', headers, body });
        const text = await res.text();
        // Try JSON first
        try {
          const json = JSON.parse(text);
          show(json);
          return;
        } catch (_) {}
        // Fallback: try to parse event-stream data lines
        const dataLines = text.split('\\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6));
        if (dataLines.length) {
          try { show(JSON.parse(dataLines[dataLines.length - 1])); return; } catch (_) {}
        }
        show(text);
      } catch (e) {
        show({ error: String(e) });
      } finally {
        setBusy(false);
      }
    }

    function show(val) {
      const out = document.getElementById('out');
      out.textContent = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    }

    function setBusy(on){
      document.querySelectorAll('button').forEach(b => b.disabled = !!on);
    }

    // Presets
    async function doInitialize(){
      await sendRpc('initialize', { protocolVersion: '2025-03-26', capabilities: {} });
    }
    async function listTools(){
      await sendRpc('tools/list', {});
    }
    async function runSerp(){
      const keyword = document.getElementById('kw').value || 'espresso machine';
      const location = parseInt(document.getElementById('loc').value || '2840', 10);
      const lang = document.getElementById('lang').value || 'en';
      await sendRpc('tools/call', { name: 'serp_organic_live_advanced', arguments: { keyword, location_code: location, language_code: lang } });
    }
    async function runSearchVolume(){
      const kw = document.getElementById('kw').value || 'espresso machine';
      const location = parseInt(document.getElementById('loc').value || '2840', 10);
      const lang = document.getElementById('lang').value || 'en';
      await sendRpc('tools/call', { name: 'keywords_data_google_ads_search_volume', arguments: { keywords: [kw], location_code: location, language_code: lang } });
    }

    // Wire up buttons without inline handlers (no optional chaining for compatibility)
    addEventListener('DOMContentLoaded', () => {
      const byId = function(id) { return document.getElementById(id); };
      const b1 = byId('btnInit'); if (b1) b1.addEventListener('click', doInitialize);
      const b2 = byId('btnList'); if (b2) b2.addEventListener('click', listTools);
      const b3 = byId('btnSerp'); if (b3) b3.addEventListener('click', runSerp);
      const b4 = byId('btnVolume'); if (b4) b4.addEventListener('click', runSearchVolume);
    });
  </script>
</head>
<body>
  <h1>DataForSEO MCP - Quick Tester</h1>
  
  <div class="row">
    <button id="btnInit">Initialize</button>
    <button id="btnList">List Tools</button>
  </div>
  <div class="row">
    <div class="field"><label>Keyword</label><input id="kw" value="espresso machine" /></div>
    <div class="field"><label>Location Code</label><input id="loc" value="2840" /></div>
    <div class="field"><label>Language Code</label><input id="lang" value="en" /></div>
  </div>
  <div class="row">
    <button id="btnSerp">Run SERP: Organic Live Advanced</button>
    <button id="btnVolume">Run Keywords: Google Ads Search Volume</button>
  </div>
  <p class="note">Note: Authentication is handled by the service configuration (environment variables). No credentials are required in the browser.</p>
  <pre id="out"></pre>
</body>
</html>`);
  });

  // Basic Auth Middleware
  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    console.error(authHeader)
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      next();
      return;
    }

    // Extract credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      console.error('Invalid credentials');
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001, 
          message: "Invalid credentials"
        },
        id: null
      });
      return;
    }

    // Add credentials to request
    req.username = username;
    req.password = password;
    next();
  };

  const handleMcpRequest = async (req: Request, res: Response) => {
    // In stateless mode, create a new instance of transport and server for each request
    // to ensure complete isolation. A single instance would cause request ID collisions
    // when multiple clients connect concurrently.
    
    try {
      
      // Check if we have valid credentials
      if (!req.username && !req.password) {
        // If no request auth, check environment variables
        const envUsername = process.env.DATAFORSEO_USERNAME;
        const envPassword = process.env.DATAFORSEO_PASSWORD;
        if (!envUsername || !envPassword) {
          console.error('No DataForSEO credentials provided');
          res.status(401).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Authentication required. Provide DataForSEO credentials."
            },
            id: null
          });
          return;
        }
        // Use environment variables
        req.username = envUsername;
        req.password = envPassword;
      }
      
      const server = initMcpServer(req.username, req.password); 
      console.error(Date.now().toLocaleString())

      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      await server.connect(transport);
      console.error('handle request');
      await transport.handleRequest(req , res, req.body);
      console.error('end handle request');
      req.on('close', () => {
        console.error('Request closed');
        transport.close();
        server.close();
      });

    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  };

  const handleNotAllowed = (method: string) => async (req: Request, res: Response) => {
    console.error(`Received ${method} request`);
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  };

  // Apply basic auth and shared handler to both endpoints
  app.post('/http', basicAuth, handleMcpRequest);
  app.post('/mcp', basicAuth, handleMcpRequest);

  app.get('/http', handleNotAllowed('GET HTTP'));
  app.get('/mcp', handleNotAllowed('GET MCP'));

  app.delete('/http', handleNotAllowed('DELETE HTTP'));
  app.delete('/mcp', handleNotAllowed('DELETE MCP'));

  // Start the server
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, () => {
    console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
