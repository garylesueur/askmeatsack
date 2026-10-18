export const OP_VAULT = "mep374l3cpdtzwibf5fswsimbi";
export const DEVELOPMENT_ITEM = "MEATSACK lanyard Development";
// One shared environment item; Ask's storage and signing authority stay separate.
export const DEVELOPMENT_FIELDS = {
  R2_ACCOUNT_ID: "ASK_R2_ACCOUNT_ID",
  R2_ACCESS_KEY_ID: "ASK_R2_ACCESS_KEY_ID",
  R2_SECRET_ACCESS_KEY: "ASK_R2_SECRET_ACCESS_KEY",
  R2_BUCKET_NAME: "ASK_R2_BUCKET_NAME",
  ASK_METADATA_SECRET: "ASK_METADATA_SECRET",
  CLEANROOM_URL: "ASK_CLEANROOM_URL",
  CLEANROOM_SERVICE_CREDENTIAL: "ASK_CLEANROOM_SERVICE_CREDENTIAL",
  CLEANROOM_WEBHOOK_SECRET: "ASK_CLEANROOM_WEBHOOK_SECRET",
};
/** @returns {Record<string, string>} */
export function developmentValues(stored) {
  const fields = new Map(stored.fields.map((field) => [field.label, field.value ?? ""]));
  const missing = Object.values(DEVELOPMENT_FIELDS).filter((field) => !fields.get(field)?.trim());
  if (missing.length) throw new Error(`Fill ${DEVELOPMENT_ITEM}: ${missing.join(", ")}`);
  return {
    ...Object.fromEntries(
      Object.entries(DEVELOPMENT_FIELDS).map(([key, field]) => [key, fields.get(field)]),
    ),
    PUBLIC_BASE_URL: "http://localhost:3043",
    LANYARD_URL: "http://localhost:3040",
    // Anonymous local sessions retain their in-memory store. No hosted Redis is loaded.
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
    R2_PUBLIC_BASE_URL: "",
    AGENT_API_KEY: fields.get("ASK_AGENT_API_KEY") ?? "",
  };
}
