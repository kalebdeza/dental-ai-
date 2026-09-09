export type SafeErrorMeta = {
  name: string;
  code?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * Loggable error metadata only. Never includes messages, details,
 * hints, or nested payloads that can contain PHI or secrets.
 */
export function safeErrorMeta(error: unknown): SafeErrorMeta {
  if (error instanceof Error) {
    const record = error as Error & { code?: unknown; status?: unknown };
    const code =
      typeof record.code === "string"
        ? record.code
        : typeof record.status === "number"
          ? String(record.status)
          : undefined;
    return code ? { name: error.name, code } : { name: error.name };
  }

  if (isRecord(error)) {
    const name = typeof error.name === "string" ? error.name : "Error";
    const code =
      typeof error.code === "string"
        ? error.code
        : typeof error.status === "number"
          ? String(error.status)
          : undefined;
    return code ? { name, code } : { name };
  }

  return { name: typeof error };
}

const UNSAFE_META_KEYS = new Set([
  "authorization",
  "body",
  "customer_key",
  "customerkey",
  "data",
  "details",
  "headers",
  "hint",
  "message",
  "password",
  "payload",
  "stack",
  "token",
]);

function isErrorLike(value: unknown): boolean {
  return (
    value instanceof Error ||
    (isRecord(value) &&
      !Array.isArray(value) &&
      ("message" in value ||
        "details" in value ||
        "hint" in value ||
        "stack" in value))
  );
}

function isUnsafeMetaKey(key: string): boolean {
  return UNSAFE_META_KEYS.has(key.toLowerCase());
}

function isSafePrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Keeps one level of primitive metadata and arrays of primitives.
 * Drops nested objects and Error messages that may contain PHI or
 * vendor payloads.
 */
export function sanitizeLogMeta(meta?: unknown): unknown {
  if (meta == null) {
    return undefined;
  }

  if (isErrorLike(meta)) {
    return safeErrorMeta(meta);
  }

  if (!isRecord(meta) || Array.isArray(meta)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (isUnsafeMetaKey(key)) {
      continue;
    }

    if (isErrorLike(value)) {
      sanitized[key] = safeErrorMeta(value);
      continue;
    }

    if (Array.isArray(value) && value.every(isSafePrimitive)) {
      sanitized[key] = value;
      continue;
    }

    if (isSafePrimitive(value)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
