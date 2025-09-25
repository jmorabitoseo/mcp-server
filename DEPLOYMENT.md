## DataForSEO MCP Server — Deployment and Usage (Cloud Run)

This document explains how to use the deployed MCP backend service and how to verify it is working. This server is an MCP backend (no UI). Clients (e.g., Claude/OpenAI MCP/Cursor) should POST JSON-RPC requests to the MCP endpoint.

### Service URL

- Base URL: `https://dataforseo-mcp-882392377775.us-central1.run.app`
- Endpoint: `POST /mcp`

### Required headers

- `Accept: application/json, text/event-stream`
- `Content-Type: application/json`
- Authentication (one of):
  - `Authorization: Basic <base64(username:password)>`, or
  - Configure `DATAFORSEO_USERNAME` and `DATAFORSEO_PASSWORD` as environment variables on the service and omit the header.

### Authentication

If using Basic Auth on the request, encode `username:password` as base64 and pass in the `Authorization` header. Example credentials mapping:

- `DATAFORSEO_USERNAME` → your DataForSEO API login (email)
- `DATAFORSEO_PASSWORD` → your DataForSEO API password or API key

### Quick tests

- Health probe (GET should return 405 — Method Not Allowed):

```bash
curl -i https://dataforseo-mcp-882392377775.us-central1.run.app/mcp
```

- Initialize (curl):

```bash
curl -i -X POST https://dataforseo-mcp-882392377775.us-central1.run.app/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Basic <BASE64_OF_USERNAME:PASSWORD>" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}'
```

- Initialize (PowerShell):

```powershell
$URL = 'https://dataforseo-mcp-882392377775.us-central1.run.app/mcp'
$B64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("USERNAME:PASSWORD"))
$headers = @{ Authorization = "Basic $B64"; Accept = "application/json, text/event-stream"; "Content-Type" = "application/json" }
$body = @{ jsonrpc = "2.0"; id = "1"; method = "initialize"; params = @{ protocolVersion = "2025-03-26"; capabilities = @{} } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri $URL -Headers $headers -Body $body
```

- List tools (PowerShell):

```powershell
$body2 = @{ jsonrpc = "2.0"; id = "2"; method = "tools/list"; params = @{} } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri $URL -Headers $headers -Body $body2
```

### Example MCP client configuration

Use an HTTP transport pointing to your service URL’s `/mcp` endpoint.

```json
{
  "name": "DataForSEO",
  "description": "Access DataForSEO APIs via MCP",
  "transport": {
    "type": "http",
    "baseUrl": "https://dataforseo-mcp-882392377775.us-central1.run.app/mcp"
  }
}
```

### Environment variables (on Cloud Run)

- `DATAFORSEO_USERNAME`: required
- `DATAFORSEO_PASSWORD`: required
- `ENABLED_MODULES`: optional; comma-separated (defaults to all)
- `ENABLED_PROMPTS`: optional; comma-separated
- `DATAFORSEO_FULL_RESPONSE`: optional; `"true"` to return full API responses (default `false` uses compact `.ai` endpoints)

Recommended: store credentials in Secret Manager and mount with `--set-secrets` when deploying.

### Troubleshooting

- 405 on GET `/mcp`: expected — use POST with JSON.
- 401 Unauthorized: include Basic Auth header or set `DATAFORSEO_USERNAME`/`DATAFORSEO_PASSWORD` in the service.
- 406/Not Acceptable: include `Accept: application/json, text/event-stream`.
- Long/streaming responses: Cloud Run supports streaming; keep the `Accept` header above.

### (Optional) Deployment summary (Cloud Run)

1. Build and push image:

```bash
gcloud builds submit --tag <REGION>-docker.pkg.dev/<PROJECT_ID>/<REPO>/dataforseo-mcp:1
```

2. Deploy:

```bash
gcloud run deploy dataforseo-mcp \
  --image <REGION>-docker.pkg.dev/<PROJECT_ID>/<REPO>/dataforseo-mcp:1 \
  --region <REGION> \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars DATAFORSEO_USERNAME="<USERNAME>",DATAFORSEO_PASSWORD="<PASSWORD>",DATAFORSEO_FULL_RESPONSE="false"
```

Replace `<PROJECT_ID>`, `<REGION>`, `<REPO>`, `<USERNAME>`, and `<PASSWORD>` accordingly.


