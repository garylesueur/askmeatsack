# 1Password secret references. Nothing secret lives in git.
# One vault: Agents (mep374l3cpdtzwibf5fswsimbi). Override with OP_VAULT.
# Three items:
#   MEATSACK lanyard Development  — this file; laptop only
#   ucxrz4yvhmmrajqqjdxokdmzju      — .env.preview.tpl → Vercel Preview
#   fgps4a7gwmzfbl7vrn2lk6oela   — .env.production.tpl → Vercel Production
# Leave Redis empty on the Development item to stay local. Fill R2 to upload files.

AGENT_API_KEY=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/AGENT_API_KEY
PUBLIC_BASE_URL=http://localhost:3000
KV_REST_API_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/KV_REST_API_URL
KV_REST_API_TOKEN=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/KV_REST_API_TOKEN
R2_ACCOUNT_ID=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/R2_BUCKET_NAME
R2_PUBLIC_BASE_URL=op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/R2_PUBLIC_BASE_URL
