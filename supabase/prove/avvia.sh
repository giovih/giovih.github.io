#!/bin/bash
# Avvia un Supabase locale (rete dell'host) per provare database, accesso, foto e funzioni.
set -e
cd "$(dirname "$0")"
node chiavi.mjs stampa > chiavi.env
source chiavi.env
QUI=$(pwd)
REPO="$(cd "$QUI/../.." && pwd)"
mkdir -p "$QUI/storage"
PW=postgres
docker rm -f sb-db sb-auth sb-rest sb-storage sb-fn >/dev/null 2>&1 || true
rm -rf "$QUI/storage"/* 2>/dev/null || true

docker run -d --name sb-db --network host \
  -e POSTGRES_PASSWORD=$PW -e POSTGRES_HOST=/var/run/postgresql -e PGPORT=5432 -e POSTGRES_PORT=5432 \
  -e PGPASSWORD=$PW -e PGDATABASE=postgres -e POSTGRES_DB=postgres -e JWT_SECRET="$SEGRETO_JWT" -e JWT_EXP=3600 \
  -v "$QUI/init/99-roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:ro" \
  -v "$QUI/init/99-jwt.sql:/docker-entrypoint-initdb.d/init-scripts/99-jwt.sql:ro" \
  supabase/postgres:17.6.1.054 postgres -c config_file=/etc/postgresql/postgresql.conf -c log_min_messages=fatal >/dev/null

echo -n "attendo il database"
for i in $(seq 1 90); do
  if docker exec sb-db pg_isready -U postgres -h localhost >/dev/null 2>&1 && docker exec sb-db psql -U supabase_admin -h localhost -d postgres -tAc "select 1 from pg_roles where rolname='authenticator'" 2>/dev/null | grep -q 1; then break; fi
  echo -n .; sleep 2
done
sleep 3; echo

docker run -d --name sb-auth --network host \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost:8000 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:$PW@localhost:5432/postgres" \
  -e GOTRUE_SITE_URL=http://localhost:8765/palestra/ -e GOTRUE_URI_ALLOW_LIST="" -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_SECRET="$SEGRETO_JWT" -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_SMTP_ADMIN_EMAIL=admin@example.com -e GOTRUE_SMTP_HOST=localhost -e GOTRUE_SMTP_PORT=2500 \
  -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify \
  supabase/gotrue:v2.197.0 >/dev/null

docker run -d --name sb-rest --network host \
  -e PGRST_DB_URI="postgres://authenticator:$PW@localhost:5432/postgres" -e PGRST_DB_SCHEMAS=public,storage,graphql_public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SEGRETO_JWT" -e PGRST_DB_USE_LEGACY_GUCS=false \
  -e PGRST_APP_SETTINGS_JWT_SECRET="$SEGRETO_JWT" -e PGRST_APP_SETTINGS_JWT_EXP=3600 -e PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v13.0.4 >/dev/null

docker run -d --name sb-storage --network host \
  -e ANON_KEY="$ANON" -e SERVICE_KEY="$SERVICE" -e POSTGREST_URL=http://localhost:3000 -e PGRST_JWT_SECRET="$SEGRETO_JWT" \
  -e AUTH_JWT_SECRET="$SEGRETO_JWT" -e DATABASE_URL="postgres://supabase_storage_admin:$PW@localhost:5432/postgres" \
  -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage -e TENANT_ID=stub \
  -e REGION=stub -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false -e SERVER_PORT=5000 -e PORT=5000 \
  -v "$QUI/storage:/var/lib/storage" supabase/storage-api:v1.84.23 >/dev/null

docker run -d --name sb-fn --network host \
  -e SUPABASE_URL=http://localhost:8000 -e SUPABASE_ANON_KEY="$ANON" -e SUPABASE_SERVICE_ROLE_KEY="$SERVICE" \
  -e ANTHROPIC_API_KEY=sk-ant-prova-locale -e ANTHROPIC_BASE_URL=http://127.0.0.1:9200 \
  ${HTTPS_PROXY:+-e HTTPS_PROXY=$HTTPS_PROXY -e NO_PROXY=localhost,127.0.0.1} \
  ${CA_BUNDLE:+-e DENO_CERT=/ca.crt -v $CA_BUNDLE:/ca.crt:ro} \
  -v "$REPO/supabase/functions:/home/deno/functions:ro" -v "$QUI/main:/home/deno/main:ro" \
  supabase/edge-runtime:v1.77.8 start --main-service /home/deno/main --port 9000 >/dev/null

echo "servizi avviati"
