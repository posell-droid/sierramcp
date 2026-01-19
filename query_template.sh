#!/bin/bash
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "gatemcp-production-DatabaseProxySecret-nbvwtvtt" --query 'SecretString' --output text)
DB_USER=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['username'])")
DB_PASS=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['password'])")
PGPASSWORD="$DB_PASS" psql -h localhost -p 5433 -U "$DB_USER" -d gatemcp -c "SELECT slug, name, \"defaultTools\" FROM application_templates WHERE slug ILIKE '%google%' OR name ILIKE '%google%';"
