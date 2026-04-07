const SENSITIVE_KEYS = [
  "authorization",
  "access_token",
  "token",
  "password",
  "hash",
  "phone",
  "recipient_phone",
]

function redactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "[REDACTED]"
  }
  const asString = String(value)
  if (asString.length <= 4) {
    return "[REDACTED]"
  }
  return `${asString.slice(0, 2)}***${asString.slice(-2)}`
}

export function redactSensitiveObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {}
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lower = key.toLowerCase()
    if (SENSITIVE_KEYS.some((token) => lower.includes(token))) {
      out[key] = redactValue(value)
      continue
    }
    out[key] = value
  }
  return out
}
