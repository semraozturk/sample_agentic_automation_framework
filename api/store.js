/**
 * In-memory append-only store for Paper Trail API (Stage C).
 * No update or delete functions exist (US-027).
 */
import crypto from "node:crypto";

const tenancies = new Map();

export function createTenancy(body) {
  if (!body?.address?.trim()) {
    return { error: { code: "VALIDATION_ERROR", fields: ["address"] } };
  }
  const id = crypto.randomUUID();
  const tokens = {
    tenant: `tenant-${crypto.randomUUID()}`,
    landlord: `landlord-${crypto.randomUUID()}`,
    reader: `reader-${crypto.randomUUID()}`,
  };
  const record = {
    id,
    address: body.address.trim(),
    moveIn: body.moveIn || null,
    deposit: body.deposit ?? null,
    entries: [],
    tokens,
  };
  tenancies.set(id, record);
  return { tenancy: { id, tokens } };
}

export function getTenancy(id) {
  return tenancies.get(id) ?? null;
}

export function findByToken(token) {
  for (const tenancy of tenancies.values()) {
    const entries = Object.entries(tenancy.tokens || {});
    for (const [role, value] of entries) {
      if (value === token) return { tenancy, role };
    }
  }
  return null;
}

export function appendEntry(tenancyId, partial, role) {
  const tenancy = tenancies.get(tenancyId);
  if (!tenancy) return null;
  const entry = Object.freeze({
    id: crypto.randomUUID(),
    authorRole: role,
    title: partial.title || "",
    body: partial.body || "",
    reportedAt: partial.reportedAt || null,
    loggedAt: new Date().toISOString(),
  });
  tenancy.entries = tenancy.entries.concat(entry);
  return entry;
}

export function exportTenancy(tenancyId) {
  const tenancy = tenancies.get(tenancyId);
  if (!tenancy) return null;
  return {
    generatedAt: new Date().toISOString(),
    tenancy: {
      id: tenancy.id,
      address: tenancy.address,
      moveIn: tenancy.moveIn,
      deposit: tenancy.deposit,
    },
    entryCount: tenancy.entries.length,
    entries: tenancy.entries,
  };
}
