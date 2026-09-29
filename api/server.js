import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import {
  appendEntry,
  createTenancy,
  exportTenancy,
  findByToken,
} from "./store.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function errorBody(code, message, fields) {
  return { error: { code, message, fields: fields || [] } };
}

function authRole(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const hit = findByToken(token);
  if (!hit) return null;
  return { tenancyId: hit.tenancy.id, role: hit.role, token };
}

app.post("/api/tenancies", (req, res) => {
  const result = createTenancy(req.body);
  if (result.error) {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "Invalid tenancy", result.error.fields));
  }
  res.status(201).json(result);
});

app.post("/api/tenancies/:id/entries", (req, res) => {
  const auth = authRole(req);
  if (!auth) return res.status(401).json(errorBody("UNAUTHORIZED", "Missing token"));
  if (auth.role === "reader") {
    return res.status(403).json(errorBody("FORBIDDEN", "Read-only token"));
  }
  const entry = appendEntry(auth.tenancyId, req.body, auth.role);
  if (!entry) return res.status(404).json(errorBody("NOT_FOUND", "Tenancy not found"));
  res.status(201).json({ entry });
});

app.get("/api/tenancies/:id/entries", (req, res) => {
  const auth = authRole(req);
  if (!auth) return res.status(401).json(errorBody("UNAUTHORIZED", "Missing token"));
  const hit = findByToken(req.headers.authorization.slice(7));
  if (!hit) return res.status(401).json(errorBody("UNAUTHORIZED", "Missing token"));
  res.json({ entries: hit.tenancy.entries });
});

app.put("/api/tenancies/:id/entries/:entryId", (_req, res) => {
  res.status(405).json(errorBody("METHOD_NOT_ALLOWED", "Entries cannot be edited"));
});

app.patch("/api/tenancies/:id/entries/:entryId", (_req, res) => {
  res.status(405).json(errorBody("METHOD_NOT_ALLOWED", "Entries cannot be edited"));
});

app.delete("/api/tenancies/:id/entries/:entryId", (_req, res) => {
  res.status(405).json(errorBody("METHOD_NOT_ALLOWED", "Entries cannot be deleted"));
});

app.get("/api/tenancies/:id/export", (req, res) => {
  const auth = authRole(req);
  if (!auth) return res.status(401).json(errorBody("UNAUTHORIZED", "Missing token"));
  if (auth.role === "contractor") {
    return res.status(403).json(errorBody("FORBIDDEN", "Contractor cannot export"));
  }
  const payload = exportTenancy(auth.tenancyId);
  if (!payload) return res.status(404).json(errorBody("NOT_FOUND", "Tenancy not found"));
  res.json(payload);
});

app.use((err, _req, res, _next) => {
  const id = crypto.randomUUID();
  res.status(500).json(errorBody("INTERNAL_ERROR", `Request failed (${id})`));
});

app.listen(PORT, () => {
  console.log(`Paper Trail API listening on http://localhost:${PORT}`);
});
