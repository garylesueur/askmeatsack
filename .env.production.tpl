# Production item. Push with: pnpm env:vercel production  (or pnpm env:vercel)
# Do not load this file on a laptop.

AGENT_API_KEY=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/AGENT_API_KEY
PUBLIC_BASE_URL=https://ask.imeatsack.com
KV_REST_API_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/KV_REST_API_URL
KV_REST_API_TOKEN=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/KV_REST_API_TOKEN
R2_ACCOUNT_ID=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/R2_BUCKET_NAME
R2_PUBLIC_BASE_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/fgps4a7gwmzfbl7vrn2lk6oela/R2_PUBLIC_BASE_URL

# Shared portal and Ask storage/scanner authority for this environment.
LANYARD_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Production/BETTER_AUTH_URL
ASK_METADATA_SECRET=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Production/ASK_METADATA_SECRET
CLEANROOM_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Production/ASK_CLEANROOM_URL
CLEANROOM_SERVICE_CREDENTIAL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Production/ASK_CLEANROOM_SERVICE_CREDENTIAL
CLEANROOM_WEBHOOK_SECRET=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Production/ASK_CLEANROOM_WEBHOOK_SECRET
CLEANROOM_CALLBACK_BASE_URL=
