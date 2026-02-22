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

(function(){
  function loadOnce(src){
    var exists = Array.prototype.slice.call(document.scripts).some(function(s){ return (s.src || "").indexOf(src) !== -1; });
    if(exists) return;
    var s = document.createElement("script");
    s.src = src;
    document.body.appendChild(s);
  }

  function afterIncludes(){
    loadOnce("/tools/assets/js/consent.js");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", afterIncludes);
  }else{
    afterIncludes();
  }
})();