# Paper Trail API (Stage C)

Append-only REST API for Paper Trail. Not a product dependency — runs separately from `paper-trail/`.

## Install and run

```bash
npm install --prefix api
npm --prefix api start
```

Listens on **http://localhost:3001** by default.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tenancies` | Create tenancy; returns role tokens once (US-025) |
| POST | `/api/tenancies/:id/entries` | Append entry (Bearer token required) |
| GET | `/api/tenancies/:id/entries` | List entries |
| GET | `/api/tenancies/:id/export` | Read-only export (US-029) |
| PUT/PATCH/DELETE | `/api/tenancies/:id/entries/:entryId` | Always 405 (US-027) |

Errors use one shape: `{ "error": { "code", "message", "fields" } }` (US-030).
