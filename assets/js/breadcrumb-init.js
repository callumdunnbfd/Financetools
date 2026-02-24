(function () {
  function run() {
    if (!window.Breadcrumb || typeof window.Breadcrumb.render !== "function") return;
    window.Breadcrumb.render({
      selector: ".breadcrumb",
      config: window.__BREADCRUMB__ || {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();