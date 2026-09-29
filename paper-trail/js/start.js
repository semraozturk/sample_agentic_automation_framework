(function () {
  const form = document.getElementById("start-form");
  const errorEl = document.getElementById("form-error");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = "";

    const address = form.address.value.trim();
    const moveIn = form["move-in"].value.trim();
    const deposit = form.deposit.value;
    const landlord = form.landlord ? form.landlord.value.trim() : "";

    if (!address || !moveIn) {
      errorEl.textContent =
        "Enter your address and move-in date before starting this record.";
      errorEl.hidden = false;
      return;
    }

    PaperTrailStorage.createTenancy({ address, moveIn, deposit, landlord });
    window.location.href = "log.html";
  });
})();
