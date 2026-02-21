(() => {
  const resultsEl = document.getElementById("results");
  const snowBtn = document.getElementById("btnViewSnowball");
  const avaBtn = document.getElementById("btnViewAvalanche");

  if (!resultsEl || !snowBtn || !avaBtn) return;

  function readMoney(text) {
    const n = Number(String(text || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function getCurrencySymbol() {
    const cur = document.getElementById("currency");
    const code = cur && cur.value ? cur.value : "GBP";
    if (code === "USD") return "$";
    if (code === "EUR") return "€";
    if (code === "INR") return "₹";
    return "£";
  }

  function formatShort(amount) {
    const sym = getCurrencySymbol();
    const v = Math.round(amount);
    const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sym + s;
  }

  function currentMethod() {
    if (avaBtn.classList.contains("is-active")) return "avalanche";
    return "snowball";
  }

  function getTotalsForMethod(method) {
    const dl = document.getElementById(method === "avalanche" ? "avalancheSummary" : "snowballSummary");
    if (!dl) return null;

    const rows = dl.querySelectorAll(".kv-row");
    if (rows.length < 4) return null;

    const totalInterest = readMoney(rows[2].querySelector("dd")?.textContent);
    const totalPaid = readMoney(rows[3].querySelector("dd")?.textContent);
    const principal = Math.max(0, totalPaid - totalInterest);

    return { totalPaid, totalInterest, principal };
  }

  function ensureRing() {
    let wrap = document.getElementById("msmRing");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "msmRing";
    wrap.className = "msm-ring";

    wrap.innerHTML = `
      <div class="msm-ring-left">
        <div class="msm-ring-k">Total to repay</div>
        <div class="msm-ring-v" data-total>—</div>
        <div class="msm-ring-k">Principal vs interest</div>
      </div>

      <svg class="msm-ring-svg" viewBox="0 0 120 120" aria-label="Principal vs interest chart" role="img">
        <circle cx="60" cy="60" r="46" fill="none" stroke="#e5eaf2" stroke-width="12"></circle>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#2f66b3" stroke-width="12"
          transform="rotate(-90 60 60)" data-principal></circle>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#64748b" stroke-width="12"
          transform="rotate(-90 60 60)" data-interest></circle>

        <text x="60" y="56" text-anchor="middle" class="msm-ring-center">Total</text>
        <text x="60" y="78" text-anchor="middle" class="msm-ring-center-strong" data-center>—</text>
      </svg>
    `;

    const summaryStrip = document.getElementById("summaryStrip");
    if (summaryStrip && summaryStrip.parentElement) {
      summaryStrip.parentElement.insertBefore(wrap, summaryStrip.nextSibling);
    } else {
      resultsEl.prepend(wrap);
    }

    return wrap;
  }

  function setRing(principal, interest, total) {
    const wrap = ensureRing();
    const totalEl = wrap.querySelector("[data-total]");
    const centerEl = wrap.querySelector("[data-center]");
    const principalArc = wrap.querySelector("[data-principal]");
    const interestArc = wrap.querySelector("[data-interest]");

    totalEl.textContent = formatShort(total);
    centerEl.textContent = formatShort(total);

    const r = 46;
    const c = 2 * Math.PI * r;

    const safeTotal = Math.max(1, total);
    const pFrac = Math.max(0, Math.min(1, principal / safeTotal));
    const iFrac = Math.max(0, Math.min(1, interest / safeTotal));

    const pLen = c * pFrac;
    const iLen = c * iFrac;

    principalArc.setAttribute("stroke-dasharray", `${pLen} ${c - pLen}`);
    principalArc.setAttribute("stroke-dashoffset", "0");

    interestArc.setAttribute("stroke-dasharray", `${iLen} ${c - iLen}`);
    interestArc.setAttribute("stroke-dashoffset", String(-pLen));
  }

  function update() {
    const totals = getTotalsForMethod(currentMethod());
    if (!totals) return;
    setRing(totals.principal, totals.totalInterest, totals.totalPaid);
  }

  const observer = new MutationObserver(() => update());
  observer.observe(resultsEl, { subtree: true, childList: true, characterData: true });

  snowBtn.addEventListener("click", () => setTimeout(update, 0));
  avaBtn.addEventListener("click", () => setTimeout(update, 0));

  update();
})();
