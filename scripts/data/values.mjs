/**
 * Value-level type and constraint checks for test-data manifests.
 * Framework-neutral: no test runner or product imports.
 * Contract: docs/test-data-contract.md
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENCY_RE = /^-?\d+(\.\d{1,2})?$/;

export const FIELD_TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "date",
  "datetime",
  "email",
  "uuid",
  "currency",
  "enum",
];

/** Absent, null, or an empty/whitespace string. `required` fails on all three. */
export function isBlank(value) {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.trim() === "";
}

function isCalendarDate(text) {
  if (!DATE_RE.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Returns null when the value fits the declared type, else a message. */
export function checkType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string" ? null : `expected string, got ${typeName(value)}`;
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : `expected number, got ${typeName(value)}`;
    case "integer":
      return Number.isInteger(value) ? null : `expected integer, got ${typeName(value)}`;
    case "boolean":
      return typeof value === "boolean" ? null : `expected boolean, got ${typeName(value)}`;
    case "date":
      return typeof value === "string" && isCalendarDate(value)
        ? null
        : `expected date YYYY-MM-DD, got ${JSON.stringify(value)}`;
    case "datetime":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : `expected ISO datetime, got ${JSON.stringify(value)}`;
    case "email":
      return typeof value === "string" && EMAIL_RE.test(value)
        ? null
        : `expected email address, got ${JSON.stringify(value)}`;
    case "uuid":
      return typeof value === "string" && UUID_RE.test(value)
        ? null
        : `expected uuid, got ${JSON.stringify(value)}`;
    case "currency":
      if (typeof value === "number") {
        return Number.isFinite(value) ? null : `expected currency amount, got ${value}`;
      }
      return typeof value === "string" && CURRENCY_RE.test(value)
        ? null
        : `expected currency amount (up to 2 decimals), got ${JSON.stringify(value)}`;
    case "enum":
      return null;
    default:
      return `unknown field type ${type}`;
  }
}

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function numericValue(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function todayIso(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function resolveBoundary(boundary, now) {
  return boundary === "today" ? todayIso(now) : boundary;
}

/**
 * Domain constraints beyond the raw type.
 * `kinds` selects which constraints run, so DC-02 (shape) and DC-03 (domain)
 * can share this function without reporting the same problem twice.
 */
export function checkConstraints(value, spec, { now = Date.now(), kinds = "all" } = {}) {
  const messages = [];
  const shape = kinds === "all" || kinds === "shape";
  const domain = kinds === "all" || kinds === "domain";

  if (shape) {
    if (typeof value === "string") {
      if (spec.minLength !== undefined && value.length < spec.minLength) {
        messages.push(`length ${value.length} is under minLength ${spec.minLength}`);
      }
      if (spec.maxLength !== undefined && value.length > spec.maxLength) {
        messages.push(`length ${value.length} is over maxLength ${spec.maxLength}`);
      }
    }
    if (spec.pattern) {
      let re = null;
      try {
        re = new RegExp(spec.pattern);
      } catch {
        messages.push(`pattern ${spec.pattern} is not a valid regular expression`);
      }
      if (re && typeof value === "string" && !re.test(value)) {
        messages.push(`${JSON.stringify(value)} does not match pattern ${spec.pattern}`);
      }
    }
  }

  if (domain) {
    const n = numericValue(value);
    if (spec.min !== undefined && n !== null && n < spec.min) {
      messages.push(`${n} is below min ${spec.min}`);
    }
    if (spec.max !== undefined && n !== null && n > spec.max) {
      messages.push(`${n} is above max ${spec.max}`);
    }
    if (spec.values && !spec.values.includes(value)) {
      messages.push(
        `${JSON.stringify(value)} is not one of ${spec.values.map((v) => JSON.stringify(v)).join(", ")}`
      );
    }
    if (spec.type === "date" && typeof value === "string") {
      if (spec.notBefore) {
        const bound = resolveBoundary(spec.notBefore, now);
        if (value < bound) messages.push(`${value} is before notBefore ${bound}`);
      }
      if (spec.notAfter) {
        const bound = resolveBoundary(spec.notAfter, now);
        if (value > bound) messages.push(`${value} is after notAfter ${bound}`);
      }
    }
    if (spec.type === "datetime" && typeof value === "string") {
      const at = Date.parse(value);
      if (!Number.isNaN(at)) {
        if (spec.notBefore) {
          const bound = Date.parse(resolveBoundary(spec.notBefore, now));
          if (at < bound) messages.push(`${value} is before notBefore ${spec.notBefore}`);
        }
        if (spec.notAfter) {
          const bound = Date.parse(resolveBoundary(spec.notAfter, now));
          if (at > bound) messages.push(`${value} is after notAfter ${spec.notAfter}`);
        }
      }
    }
  }

  return messages;
}

/** Milliseconds until `value` expires. Negative means already expired. */
export function msUntil(value, now = Date.now()) {
  if (typeof value !== "string") return null;
  const at = DATE_RE.test(value) ? Date.parse(`${value}T23:59:59Z`) : Date.parse(value);
  return Number.isNaN(at) ? null : at - now;
}

/** Redact values declared `secret` so reports never carry credentials. */
export function redact(value) {
  if (typeof value !== "string" || value.length === 0) return "[redacted]";
  return `[redacted:${value.length} chars]`;
}
