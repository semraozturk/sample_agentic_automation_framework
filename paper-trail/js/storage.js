/**
 * Paper Trail — browser storage (Stage B).
 * Append-only: no updateEntry or deleteEntry exists (US-019).
 */
(function (global) {
  const KEY = "paper-trail-v1";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(store) {
    localStorage.setItem(KEY, JSON.stringify(store));
  }

  function hasTenancy() {
    return Boolean(read()?.tenancy?.address);
  }

  function getTenancy() {
    return read()?.tenancy ?? null;
  }

  function getEntries() {
    return read()?.entries ?? [];
  }

  function createTenancy({ address, moveIn, deposit, landlord }) {
    const store = {
      tenancy: {
        address: String(address).trim(),
        moveIn: String(moveIn).trim(),
        deposit: deposit === "" || deposit == null ? null : Number(deposit),
        landlord: landlord ? String(landlord).trim() : "",
      },
      entries: [],
    };
    write(store);
    appendEntry({
      type: "tenancy-created",
      authorRole: "tenant",
      title: "Tenancy record started",
      body: `Record opened for ${store.tenancy.address}.`,
    });
    return store.tenancy;
  }

  function appendEntry(partial) {
    const store = read();
    if (!store) {
      throw new Error("No tenancy");
    }
    const entry = Object.freeze({
      id: crypto.randomUUID(),
      type: partial.type || "note",
      authorRole: partial.authorRole || "tenant",
      title: partial.title || "",
      body: partial.body || "",
      room: partial.room || null,
      reportedAt: partial.reportedAt || null,
      loggedAt: Date.now(),
      status: partial.status || null,
      correctsId: partial.correctsId || null,
    });
    store.entries = store.entries.concat(entry);
    write(store);
    return entry;
  }

  function formatLoggedAt(ms) {
    const d = new Date(ms);
    return d.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatMoney(amount) {
    if (amount == null || Number.isNaN(amount)) return "Not recorded";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  }

  function appendCorrection(entryId, body, authorRole) {
    return appendEntry({
      type: "correction",
      authorRole: authorRole || "tenant",
      title: "Correction added",
      body,
      correctsId: entryId,
    });
  }

  global.PaperTrailStorage = {
    hasTenancy,
    getTenancy,
    getEntries,
    createTenancy,
    appendEntry,
    appendCorrection,
    formatLoggedAt,
    formatDate,
    formatMoney,
  };
})(window);
