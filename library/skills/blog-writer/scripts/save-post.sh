#!/bin/bash
# Save a new blog post to Supabase as draft
# Usage: ./save-post.sh '<json>'
# Example: ./save-post.sh '{"slug":"my-post","title":"My Post","description":"About this","content":"# Hello","category":"Guide","tags":["seo"],"author_name":"John","target_query":"how to X","schema_types":["Article","FAQPage"],"faq_data":[{"question":"What?","answer":"This."}]}'
#
# Required fields: slug, title, description, content, author_name
# Optional fields: category, tags, author_role, author_avatar, seo_title, seo_description,
#                  cover_image_url, target_query, schema_types, faq_data

set -e

JSON_INPUT="$1"

if [ -z "$JSON_INPUT" ]; then
    echo "Usage: ./save-post.sh '<json>'"
    echo ""
    echo "Required: slug, title, description, content, author_name"
    echo "Optional: category, tags, author_role, author_avatar, seo_title,"
    echo "          seo_description, target_query, schema_types, faq_data"
    exit 1
fi

# Validate JSON
if ! echo "$JSON_INPUT" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON input" >&2
    exit 1
fi

# Check required fields
for field in slug title description content author_name; do
    if ! echo "$JSON_INPUT" | jq -e ".$field" >/dev/null 2>&1; then
        echo "Error: '$field' is required" >&2
        exit 1
    fi
done

# Load env from webapp/.env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/webapp/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found" >&2
    exit 1
fi

while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    line="${line#export }"
    [[ "$line" == *"="* ]] || continue
    export "$line" 2>/dev/null || true
done < "$ENV_FILE"

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
API_KEY="${SUPABASE_SECRET_KEY}"

if [ -z "$SUPABASE_URL" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL not set" >&2
    exit 1
fi

if [ -z "$API_KEY" ]; then
    echo "Error: SUPABASE_SECRET_KEY not set — needed to insert blog posts" >&2
    exit 1
fi

# Force status to draft (safety: skill should never publish directly)
POST_DATA=$(echo "$JSON_INPUT" | jq '. + {"status": "draft"}')

# Secret key in both headers — bypasses RLS
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${SUPABASE_URL}/rest/v1/blog_posts" \
    -H "apikey: ${API_KEY}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$POST_DATA")

# Split response body and HTTP status
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "$BODY" | jq '.[0] // .'
else
    echo "Error (HTTP $HTTP_CODE):" >&2
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY" >&2
    exit 1
fi
