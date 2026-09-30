#!/bin/bash
# Fetch recent blog posts from Supabase for dedup
# Usage: ./get-recent-posts.sh [limit]
# Example: ./get-recent-posts.sh 20
# Returns: JSON array of {title, description, slug, category, created_at}

set -e

LIMIT="${1:-20}"

# Load env from webapp/.env (resolve relative to script location)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/webapp/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found" >&2
    exit 1
fi

# Source env vars (handle multi-line, comments, exports)
while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    # Remove 'export ' prefix if present
    line="${line#export }"
    # Only process lines with =
    [[ "$line" == *"="* ]] || continue
    export "$line" 2>/dev/null || true
done < "$ENV_FILE"

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
API_KEY="${SUPABASE_SECRET_KEY}"

if [ -z "$SUPABASE_URL" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL not set in $ENV_FILE" >&2
    exit 1
fi

if [ -z "$API_KEY" ]; then
    echo "Error: SUPABASE_SECRET_KEY not set in $ENV_FILE" >&2
    exit 1
fi

# Secret key in both headers — bypasses RLS (needed to see drafts for dedup)
RESPONSE=$(curl -s \
    "${SUPABASE_URL}/rest/v1/blog_posts?select=title,description,slug,category,created_at&order=created_at.desc&limit=${LIMIT}" \
    -H "apikey: ${API_KEY}" \
    -H "Authorization: Bearer ${API_KEY}")

# Check for errors
if echo "$RESPONSE" | jq -e '.message' >/dev/null 2>&1; then
    echo "Error from Supabase:" >&2
    echo "$RESPONSE" | jq -r '.message' >&2
    exit 1
fi

# Output formatted JSON
echo "$RESPONSE" | jq '.'
