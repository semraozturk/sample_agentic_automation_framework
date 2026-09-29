(function () {
  if (!PaperTrailGuard.requireTenancy()) return;

  const form = document.getElementById("issue-form");
  const errorEl = document.getElementById("issue-error");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorEl.hidden = true;

    const description = form.description.value.trim();
    const room = form.room.value;
    const started = form.started.value;

    if (!description) {
      errorEl.textContent = "Describe the problem before submitting.";
      errorEl.hidden = false;
      return;
    }

    const bodyParts = [description];
    if (started) {
      bodyParts.push(`Problem started: ${PaperTrailStorage.formatDate(started)}.`);
    }

    PaperTrailStorage.appendEntry({
      type: "issue",
      authorRole: "tenant",
      title: `Issue reported: ${room}`,
      body: bodyParts.join(" "),
      room,
      reportedAt: started || null,
      status: "reported",
    });

    window.location.href = "log.html";
  });
})();
