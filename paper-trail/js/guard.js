/** Redirect to start when no tenancy exists (US-015-AC-3). */
(function (global) {
  global.PaperTrailGuard = {
    requireTenancy() {
      if (!global.PaperTrailStorage?.hasTenancy()) {
        window.location.href = "start.html";
        return false;
      }
      return true;
    },
  };
})(window);
