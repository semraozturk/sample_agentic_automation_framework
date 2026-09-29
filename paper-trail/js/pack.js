(function () {
  if (!PaperTrailGuard.requireTenancy()) return;

  const tenancy = PaperTrailStorage.getTenancy();
  const entries = PaperTrailStorage.getEntries();
  const sheet = document.querySelector(".pack-sheet");
  if (!sheet) return;

  const generated = PaperTrailStorage.formatLoggedAt(Date.now());
  const addressEl = sheet.querySelector("[data-testid='pack-address']");
  const addressSummary = sheet.querySelector("[data-testid='pack-address-summary']");
  if (addressEl) addressEl.textContent = tenancy.address;
  if (addressSummary) addressSummary.textContent = tenancy.address;
  const dateEl = sheet.querySelector("[data-testid='pack-generated-date']");
  if (dateEl) dateEl.textContent = generated;
  sheet.querySelector("[data-testid='pack-deposit']").textContent =
    PaperTrailStorage.formatMoney(tenancy.deposit);
  sheet.querySelector("[data-testid='pack-entry-count']").textContent =
    String(entries.length);

  const list = sheet.querySelector("[data-testid='pack-entries']");
  if (list) {
    list.innerHTML = entries
      .slice()
      .reverse()
      .map(
        (e) =>
          `<article class="entry"><p class="entry-when">${PaperTrailStorage.formatLoggedAt(e.loggedAt)}</p><h3 class="entry-title">${e.title}</h3><p class="entry-body">${e.body}</p></article>`
      )
      .join("");
  }
})();
