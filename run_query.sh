#!/bin/bash
cd /Users/robertdelf/sierramcp/packages/db
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "gatemcp-production-DatabaseProxySecret-nbvwtvtt" --query 'SecretString' --output text)
DB_USER=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['username'])")
DB_PASS=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['password'])")
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5433/gatemcp"
npx tsx query-template.ts
