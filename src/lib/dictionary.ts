/** Caller IDs are ordinary own keys, including names also present on Object.prototype. */
export function ownValue<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}
