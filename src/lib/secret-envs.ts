export const OP_VAULT_NAME = "Agents";
export const OP_VAULT_DEFAULT = "mep374l3cpdtzwibf5fswsimbi";

export const secretEnvItems = {
  development: "askmeatsack.com Development",
  preview: "askmeatsack.com Preview",
  production: "askmeatsack.com Production",
} as const;

export type LocalSecretEnv = "development";
export type VercelSecretEnv = "preview" | "production";
export type SecretEnv = LocalSecretEnv | VercelSecretEnv;

export const secretKeys = [
  "AGENT_API_KEY",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

export const envTemplateFiles = {
  development: ".env.development.tpl",
  preview: ".env.preview.tpl",
  production: ".env.production.tpl",
} as const;

export function itemForLocalDev(): (typeof secretEnvItems)["development"] {
  return secretEnvItems.development;
}

export function itemForVercelTarget(
  target: VercelSecretEnv,
): (typeof secretEnvItems)[VercelSecretEnv] {
  return secretEnvItems[target];
}

export function parseVercelSecretTarget(value: string): VercelSecretEnv {
  if (value === "preview" || value === "production") {
    return value;
  }
  throw new Error(
    "Only preview and production are pushed to Vercel. Development stays in 1Password and is loaded locally.",
  );
}

export function opSecretReference(
  vault: string,
  item: string,
  key: string,
): string {
  return `op://${vault}/${item}/${key}`;
}

export function opTemplateReference(item: string, key: string): string {
  return `op://\${OP_VAULT:-${OP_VAULT_DEFAULT}}/${item}/${key}`;
}
