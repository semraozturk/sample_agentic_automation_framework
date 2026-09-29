import fs from "node:fs";
import path from "node:path";

/**
 * Framework binding for the test data contract (docs/test-data-contract.md).
 *
 * Specs ask for a dataset by id; the records come from the reservation written
 * by `node scripts/data-check.mjs --reserve`. Nothing here queries a source, so
 * a spec cannot quietly consume a one-time-use record the gate never counted.
 */

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const MANIFEST_DIR = path.join(REPO_ROOT, ".quality", "data");
const LATEST_POINTER = path.join(REPO_ROOT, ".quality", "tmp", "data-reservation-latest.json");

/** Triage keys off this prefix to classify the failure as `data-bug`. */
const PREFIX = "test data unavailable";

export type DataRecord = Record<string, unknown>;

type ReservationEntry = { lifecycle: string; records: DataRecord[] };

type Reservation = {
  runId: string;
  workers: number;
  datasets: Record<string, ReservationEntry>;
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function reservationFile(): string | null {
  const explicit = process.env.PAPER_TRAIL_DATA_RESERVATION;
  if (explicit) {
    const resolved = path.resolve(REPO_ROOT, explicit);
    return fs.existsSync(resolved) ? resolved : null;
  }
  const pointer = readJson<{ runId: string }>(LATEST_POINTER);
  if (!pointer?.runId) return null;
  const file = path.join(REPO_ROOT, ".quality", "runs", pointer.runId, "data-reservation.json");
  return fs.existsSync(file) ? file : null;
}

/**
 * Inline records straight from the manifest.
 * Lets `npm --prefix e2e test` work without a preflight for static datasets,
 * while anything leasable still demands a reservation.
 */
function staticFallback(datasetId: string): DataRecord[] | null {
  if (!fs.existsSync(MANIFEST_DIR)) return null;
  for (const name of fs.readdirSync(MANIFEST_DIR)) {
    if (!name.endsWith(".data.json")) continue;
    const manifest = readJson<{ datasets?: Array<Record<string, unknown>> }>(
      path.join(MANIFEST_DIR, name)
    );
    for (const dataset of manifest?.datasets ?? []) {
      if (dataset.id !== datasetId) continue;
      const source = dataset.source as { kind?: string } | undefined;
      if (source?.kind !== "static") return null;
      return (dataset.records as DataRecord[]) ?? [];
    }
  }
  return null;
}

/**
 * Collection-time read for config that cannot wait for a fixture, such as
 * `test.use({ viewport })`. Static datasets only — nothing leasable can be
 * resolved before the gate has run.
 */
export function readStaticRecord<T extends DataRecord = DataRecord>(datasetId: string): T {
  const records = staticFallback(datasetId);
  if (!records || records.length === 0) {
    throw new Error(
      `${PREFIX}: ${datasetId} has no static records in .quality/data/ — only static datasets can be read at collection time`
    );
  }
  return records[0] as T;
}

export type DataAccessor = {
  /** The dataset's record. One-time-use datasets hand out a fresh one per call. */
  <T extends DataRecord = DataRecord>(datasetId: string): T;
  /** Every record reserved for this dataset. */
  all<T extends DataRecord = DataRecord>(datasetId: string): T[];
};

/**
 * One accessor per worker. One-time-use records are partitioned across workers
 * so two workers never hand the same record to two tests.
 */
export function createDataAccessor(workerIndex: number): DataAccessor {
  const file = reservationFile();
  const reservation = file ? readJson<Reservation>(file) : null;
  const queues = new Map<string, DataRecord[]>();

  function entryFor(datasetId: string): ReservationEntry {
    const reserved = reservation?.datasets?.[datasetId];
    if (reserved) return reserved;

    const fallback = staticFallback(datasetId);
    if (fallback && fallback.length > 0) {
      return { lifecycle: "reusable", records: fallback };
    }

    const how = file
      ? `it is not in ${path.relative(REPO_ROOT, file)}`
      : "no reservation exists for this run";
    throw new Error(
      `${PREFIX}: ${datasetId} — ${how}. Run: node scripts/data-check.mjs --reserve --run-id <runId>`
    );
  }

  function oneTimeQueue(datasetId: string, entry: ReservationEntry): DataRecord[] {
    if (!queues.has(datasetId)) {
      const workers = Math.max(1, reservation?.workers ?? 1);
      // Deterministic slice: worker 0 takes records 0, n, 2n, and so on.
      queues.set(
        datasetId,
        entry.records.filter((_, i) => i % workers === workerIndex % workers)
      );
    }
    return queues.get(datasetId)!;
  }

  const accessor = (<T extends DataRecord = DataRecord>(datasetId: string): T => {
    const entry = entryFor(datasetId);

    if (entry.lifecycle === "one-time-use") {
      const queue = oneTimeQueue(datasetId, entry);
      const next = queue.shift();
      if (!next) {
        throw new Error(
          `${PREFIX}: ${datasetId} ran out mid-run on worker ${workerIndex}. Raise demandPerRun in .quality/data/, then re-run data-check.mjs --reserve`
        );
      }
      return next as T;
    }

    const [first] = entry.records;
    if (!first) {
      throw new Error(`${PREFIX}: ${datasetId} reserved zero records`);
    }
    return first as T;
  }) as DataAccessor;

  accessor.all = <T extends DataRecord = DataRecord>(datasetId: string): T[] =>
    entryFor(datasetId).records as T[];

  return accessor;
}
