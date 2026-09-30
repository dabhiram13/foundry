# Observability Stack — Agent-Autonomous Testing

No Docker. Native binaries. OTel Collector pipes everything to VictoriaMetrics.

## Architecture

```
Next.js app (OTel SDK) ──→ OTel Collector (:4317/:4318)
Playwright tests (OTel SDK) ──→      │
                                      ├──→ VictoriaMetrics (:8428) — metrics
                                      ├──→ VictoriaLogs (:9428) — logs
                                      └──→ VictoriaTraces (:9408) — traces
                                              │
Agent ←── VictoriaLogs MCP (:8080) ←──────────┘
Agent ←── Playwright MCP (:8931) — controls browser
```

## Install Binaries

Download from https://victoriametrics.com/download/ — single binaries, <50MB each.

```bash
# Place in project root or ~/bin
chmod +x victoria-metrics victoria-logs victoria-traces
```

OTel Collector: https://github.com/open-telemetry/opentelemetry-collector-releases

## OTel Collector Config

```yaml
# otel-config.yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }
processors:
  batch: {}
exporters:
  otlphttp/traces:
    endpoint: http://localhost:9408
  otlphttp/logs:
    endpoint: http://localhost:9428
  prometheusremotewrite:
    endpoint: http://localhost:8428/api/v1/write
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/traces]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/logs]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheusremotewrite]
```

## Next.js OTel

Set env: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`

Your existing `instrumentation.ts` already handles this. Traces include oRPC calls, DB queries, HTTP requests.

## Playwright OTel Integration

```typescript
// tests/e2e/global-setup.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();
export default async () => {};
```

Traces now flow: `playwright test → fetch /rpc → oRPC procedure → DB`.

## Agent Flow

1. **Start stack**: `./scripts/start-test-stack.sh`
2. **Agent → Playwright MCP**: "Run E2E suite on localhost:3000, capture traces"
3. **Agent → VictoriaLogs MCP**: "Query logs for 'error | oRPC | playwright' since 5m"
4. **Agent reasons**: "Login failed on step 3 — missing wait for element"
5. **Agent writes fix** → re-runs → validates

## MCP Servers

```bash
# Playwright MCP — agent controls browser
npx @playwright/mcp --port 8931

# VictoriaLogs MCP — agent queries logs/traces
npx @victoriametrics/mcp-victorialogs --victorialogs-url http://localhost:9428 --port 8080
```

Agent connects via stdio/HTTP. No manual intervention.
