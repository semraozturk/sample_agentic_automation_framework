(function () {
  const storage = window.PaperTrailStorage;
  if (!storage) return;

  if (!storage.hasTenancy()) {
    window.location.href = "start.html";
    return;
  }

  const tenancy = storage.getTenancy();
  const entries = storage.getEntries().slice().reverse();

  const heading = document.getElementById("tenancy-heading");
  const summary = document.querySelector("[data-testid='tenancy-summary']");
  const emptyState = document.querySelector("[data-testid='log-empty-state']");
  const entriesRoot = document.querySelector("[data-testid='log-entries']");
  const deliveryNote = document.getElementById("delivery-note");

  if (heading) heading.textContent = tenancy.address;

  if (summary) {
    summary.innerHTML = `
      <h2>Tenancy details</h2>
      <dl>
        <dt>Address</dt>
        <dd>${escapeHtml(tenancy.address)}</dd>
        <dt>Move-in date</dt>
        <dd>${escapeHtml(storage.formatDate(tenancy.moveIn))}</dd>
        <dt>Deposit</dt>
        <dd>${escapeHtml(storage.formatMoney(tenancy.deposit))}</dd>
        ${
          tenancy.landlord
            ? `<dt>Landlord / agent</dt><dd>${escapeHtml(tenancy.landlord)}</dd>`
            : ""
        }
      </dl>
      <p class="muted">These details are read-only. Every log entry is attached to this tenancy.</p>
    `;
  }

  if (deliveryNote) {
    if (!tenancy.landlord) {
      deliveryNote.hidden = false;
      deliveryNote.textContent =
        "Reports cannot be delivered yet — add a landlord or agent contact on the start form.";
    } else {
      deliveryNote.hidden = true;
    }
  }

  const hasCondition = entries.some((e) => e.type === "condition-sealed");
  if (emptyState) {
    emptyState.hidden = hasCondition;
  }

  if (entriesRoot) {
    entriesRoot.innerHTML = entries
      .map((entry) => renderEntry(entry, storage))
      .join("");
  }

  function renderEntry(entry, store) {
    const role =
      entry.authorRole === "system"
        ? "System"
        : entry.authorRole.charAt(0).toUpperCase() + entry.authorRole.slice(1);
    const status = entry.status
      ? `<span class="status ${entry.status}">${entry.status}</span>`
      : "";
    const correction = entry.correctsId
      ? `<p class="muted">Correction to earlier entry.</p>`
      : "";
    return `
      <article class="entry" data-testid="log-entry-${entry.id}">
        <p class="entry-when">${escapeHtml(store.formatLoggedAt(entry.loggedAt))} · ${escapeHtml(role)}</p>
        <h3 class="entry-title">${escapeHtml(entry.title)} ${status}</h3>
        <p class="entry-body">${escapeHtml(entry.body)}${correction}</p>
      </article>
    `;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
