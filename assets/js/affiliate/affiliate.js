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

  function matchesRules(offer, context) {
    if (!offer.rules || !offer.rules.length) return true;

    return offer.rules.every(rule => {
      const value = context[rule.field];
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
    slot.innerHTML = `
      <div class="affiliate-card">
        <div class="affiliate-title">${offer.title}</div>
        <div class="affiliate-body">${offer.body}</div>
        <a href="${offer.url}"
           class="btn primary"
           target="_blank"
           rel="sponsored noopener noreferrer">
           ${offer.cta}
        </a>
        <div class="affiliate-disclosure">
          ${offer.disclosure || "We may receive compensation from partners."}
        </div>
      </div>
    `;
  }

  function renderFallback(slot) {
    slot.innerHTML = `
      <div class="affiliate-card">
        <div class="affiliate-title">Next steps</div>
        <div class="affiliate-body">
          Consider reviewing balance transfer options or consolidation strategies.
        </div>
        <a href="/tools/" class="btn primary">
          Browse debt tools
        </a>
        <div class="affiliate-disclosure">
          No affiliate recommendation matched these results.
        </div>
      </div>
    `;
  }

  function render({ slot, context }) {
    if (!slot) return;

    loadOffers().then(offers => {
      const matches = offers.filter(o => matchesRules(o, context));
      const selected = matches.length ? matches[0] : null;

      if (selected) {
        renderCard(slot, selected);
      } else {
        renderFallback(slot);
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