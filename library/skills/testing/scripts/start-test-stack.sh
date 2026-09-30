#!/bin/bash
# Start local observability + MCP stack for autonomous agent testing.
# No Docker. Native binaries. Kill with: pkill -f victoria; pkill -f otelcol

set -e

echo "Starting VictoriaMetrics stack..."
./victoria-metrics -httpListenAddr=:8428 &
./victoria-logs -httpListenAddr=:9428 &
./victoria-traces -httpListenAddr=:9408 &
otelcol-contrib --config=otel-config.yaml &

echo "Starting MCP servers..."
npx @victoriametrics/mcp-victorialogs --victorialogs-url http://localhost:9428 --port 8080 &
npx @playwright/mcp --port 8931 &

echo ""
echo "Stack ready:"
echo "  Metrics:        http://localhost:8428"
echo "  Logs:           http://localhost:9428"
echo "  Traces:         http://localhost:9408"
echo "  OTel Collector: grpc://localhost:4317  http://localhost:4318"
echo "  Playwright MCP: http://localhost:8931"
echo "  Victoria MCP:   http://localhost:8080"
echo ""
echo "Kill all: pkill -f victoria; pkill -f otelcol; pkill -f playwright/mcp"
