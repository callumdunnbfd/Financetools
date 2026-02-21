document.addEventListener("DOMContentLoaded", async () => {
  const nodes = document.querySelectorAll("[data-include]");
  for (const node of nodes) {
    const file = node.getAttribute("data-include");
    if (!file) continue;

    const url = new URL(file, window.location.href).toString();

    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      node.outerHTML = await res.text();
    } catch (err) {
      console.error("Include failed:", err);
    }
  }
});