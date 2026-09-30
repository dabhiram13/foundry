#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <domain> <upstream_host> <upstream_port>" >&2
  exit 1
fi

domain="$1"
upstream_host="$2"
upstream_port="$3"

cat <<EOF
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://${upstream_host}:${upstream_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
