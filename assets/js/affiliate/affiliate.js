(function () {

  let offersCache = null;
  let loadingPromise = null;

  function loadOffers() {
    if (offersCache) return Promise.resolve(offersCache);
    if (loadingPromise) return loadingPromise;

    loadingPromise = fetch("/tools/data/affiliate-offers-uk.json", { cache: "no-cache" })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load affiliate config");
        return res.json();
      })
      .then(data => {
        offersCache = Array.isArray(data) ? data : [];
        return offersCache;
      })
      .catch(() => {
        offersCache = [];
        return offersCache;
      });

    return loadingPromise;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeUrl(u) {
    try {
      const url = new URL(String(u || ""), window.location.href);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
      return "#";
    } catch {
      return "#";
    }
  }

  function formatGBP(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    return "£" + x.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }

  function monthsToLabel(m) {
    const x = Number(m);
    if (!Number.isFinite(x) || x <= 0) return "";
    const years = Math.floor(x / 12);
    const months = x % 12;
    if (years <= 0) return x + " months";
    if (months === 0) return years + " years";
    return years + " years " + months + " months";
  }

  function matchesRules(offer, context) {
    if (!offer.rules || !offer.rules.length) return true;

    return offer.rules.every(rule => {
      const value = context ? context[rule.field] : undefined;
      if (value == null) return false;

      switch (rule.operator) {
        case "gt": return value > rule.value;
        case "gte": return value >= rule.value;
        case "lt": return value < rule.value;
        case "lte": return value <= rule.value;
        case "eq": return value === rule.value;
        default: return false;
      }
    });
  }

  function renderCard(slot, offer) {
    const title = esc(offer.title);
    const body = esc(offer.body);
    const cta = esc(offer.cta || "View offer");
    const url = safeUrl(offer.url);
    const disclosure = esc(offer.disclosure || "We may receive compensation if you click this link or apply through it.");
    const provider = esc(offer.provider || "");
    const aprText = esc(offer.representativeApr || "");
    const feesText = esc(offer.feesSummary || "");
    const eligibilityText = esc(offer.eligibilitySummary || "");

    const metaBits = [provider, aprText, feesText, eligibilityText].filter(Boolean);

    slot.innerHTML = `
      <section class="aff-offer" aria-label="Sponsored recommendation">
        <div class="aff-top">
          <div class="aff-badges">
            <span class="aff-badge aff-badge--sponsored">Sponsored</span>
            <span class="aff-badge aff-badge--uk">UK</span>
          </div>
          <div class="aff-title">${title}</div>
          <div class="aff-body">${body}</div>
        </div>

        ${metaBits.length ? `<ul class="aff-meta">${metaBits.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}

        <div class="aff-actions">
          <a class="aff-btn" href="${url}" target="_blank" rel="sponsored noopener noreferrer">
            ${cta}
          </a>
          <a class="aff-link" href="/tools/learn/affiliate-disclosure.html">
            How recommendations work
          </a>
        </div>

        <details class="aff-details">
          <summary>Important information</summary>
          <div class="aff-disclosure">${disclosure}</div>
          <div class="aff-safety">
            Always check eligibility, fees, and the lender’s terms before applying. Credit is subject to status and affordability.
          </div>
        </details>
      </section>
    `;
  }

  function renderFallback(slot, context) {
    const interest = formatGBP(context && context.totalInterest);
    const apr = context && Number.isFinite(Number(context.apr)) ? Number(context.apr).toFixed(2) + "%" : "";
    const time = monthsToLabel(context && context.months);

    const hasAny = Boolean(interest || apr || time);

    const headline = interest
      ? `You’re projected to pay <span class="aff-stat">${esc(interest)}</span> in interest`
      : "Based on your results, there may be alternatives";

    const sub = hasAny
      ? "Some regulated lenders offer lower rates, depending on eligibility and fees."
      : "Balance transfers, consolidation, and repayment strategies can reduce interest, depending on eligibility and fees.";

    const meta = [apr ? "Current APR: " + esc(apr) : "", time ? "Estimated payoff: " + esc(time) : ""].filter(Boolean);

    slot.innerHTML = `
      <section class="aff-offer" aria-label="Next steps">
        <div class="aff-top">
          <div class="aff-badges">
            <span class="aff-badge aff-badge--info">Next steps</span>
          </div>
          <div class="aff-title">${headline}</div>
          <div class="aff-body">${esc(sub)}</div>
        </div>

        ${meta.length ? `<ul class="aff-meta">${meta.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}

        <div class="aff-actions">
          <a class="aff-btn aff-btn--secondary" href="/tools/debt/">
            Compare regulated options
          </a>
          <a class="aff-link" href="/tools/learn/choosing-credit.html">
            Choosing credit safely
          </a>
        </div>

        <details class="aff-details">
          <summary>Why you’re seeing this</summary>
          <div class="aff-disclosure">
            No sponsored recommendation matched your inputs. We only show offers when the rules match your scenario.
          </div>
        </details>
      </section>
    `;
  }

  function render(args) {
    const slot = args && args.slot;
    const context = (args && args.context) || {};
    if (!slot) return;

    loadOffers().then(offers => {
      const matches = offers.filter(o => matchesRules(o, context));
      const selected = matches.length ? matches[0] : null;

      if (selected) {
        renderCard(slot, selected);
      } else {
        renderFallback(slot, context);
      }
    });
  }

  function clear(slot) {
    if (!slot) return;
    slot.innerHTML = "";
  }

  window.Affiliate = {
    render,
    clear
  };

})();