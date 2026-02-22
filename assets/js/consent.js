(function () {
  "use strict";

  var Consent = {
    storageKey: "cc_consent_v1",
    regionOverrideKey: "cc_region_override_v1",
    config: {
      regionMode: "auto",
      consentExpiryDays: 270,
      categories: ["functional", "analytics", "marketing"],
      version: 1
    },
    state: {
      isOpen: false,
      lastFocused: null,
      regionModeEffective: null,
      regionOverride: null,
      regionResolved: null,
      gpc: false,
      record: null,
      wired: false
    }
  };

  function now() {
    return Date.now();
  }

  function daysToMs(d) {
    return d * 24 * 60 * 60 * 1000;
  }

  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getGpc() {
    try {
      return navigator.globalPrivacyControl === true;
    } catch (e) {
      return false;
    }
  }

  function normalizeRegionValue(v) {
    if (v === "eu" || v === "uk" || v === "us" || v === "row" || v === "auto") return v;
    return "auto";
  }

  function detectRegionHeuristic() {
    var lang = "";
    var tz = "";
    try {
      lang = (navigator.language || "").toLowerCase();
    } catch (e) {
      lang = "";
    }
    try {
      tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
    } catch (e2) {
      tz = "";
    }

    var isUK = false;
    var isEU = false;
    var isUS = false;

    if (lang === "en-gb" || lang.endsWith("-gb")) isUK = true;
    if (tz.indexOf("london") !== -1 || tz.indexOf("belfast") !== -1) isUK = true;

    var euLangHints = ["-fr", "-de", "-es", "-it", "-nl", "-be", "-ie", "-pt", "-se", "-dk", "-fi", "-no", "-pl", "-cz", "-sk", "-hu", "-ro", "-bg", "-hr", "-si", "-lt", "-lv", "-ee", "-gr", "-at", "-lu", "-mt", "-cy"];
    for (var i = 0; i < euLangHints.length; i++) {
      if (lang.endsWith(euLangHints[i])) isEU = true;
    }

    if (tz.indexOf("europe/") !== -1) isEU = true;

    if (lang === "en-us" || lang.endsWith("-us")) isUS = true;
    if (tz.indexOf("america/") !== -1 || tz.indexOf("us/") !== -1) isUS = true;

    if (isUK) return "uk";
    if (isEU) return "eu";
    if (isUS) return "us";
    return "row";
  }

  function resolveRegionMode() {
    var override = normalizeRegionValue(readStorage(Consent.regionOverrideKey) || "");
    if (override !== "auto") return { effective: override, override: override };

    var cfg = normalizeRegionValue(Consent.config.regionMode);
    if (cfg !== "auto") return { effective: cfg, override: "auto" };

    return { effective: detectRegionHeuristic(), override: "auto" };
  }

  function regionLabel(r) {
    if (r === "eu") return "EU (opt-in)";
    if (r === "uk") return "UK (opt-in)";
    if (r === "us") return "US (opt-out elements)";
    return "Rest of world";
  }

  function expiryText(days) {
    var months = Math.round((days / 30) * 10) / 10;
    if (months >= 1) {
      var m = Math.round(months);
      return m + (m === 1 ? " month" : " months");
    }
    return days + (days === 1 ? " day" : " days");
  }

  function defaultChoicesForRegion(region, gpc) {
    var base = { necessary: true, functional: false, analytics: false, marketing: false, saleOptOut: false };
    if (region === "us") {
      base.functional = true;
      base.analytics = true;
      base.marketing = true;
      base.saleOptOut = false;
    }
    if (gpc) {
      base.marketing = false;
      base.saleOptOut = true;
    }
    return base;
  }

  function clampChoices(raw) {
    var c = {
      necessary: true,
      functional: !!(raw && raw.functional),
      analytics: !!(raw && raw.analytics),
      marketing: !!(raw && raw.marketing),
      saleOptOut: !!(raw && raw.saleOptOut)
    };
    c.necessary = true;
    if (Consent.state.gpc) {
      c.marketing = false;
      c.saleOptOut = true;
    }
    return c;
  }

  function isRecordValid(rec) {
    if (!rec || typeof rec !== "object") return false;
    if (rec.version !== Consent.config.version) return false;
    if (!rec.region) return false;
    if (!rec.choices || typeof rec.choices !== "object") return false;
    var exp = Number(rec.expiresAt || 0);
    if (!exp) return false;
    if (now() > exp) return false;
    return true;
  }

  function readConsentRecord() {
    if (window.__cc && window.__cc.preconsent) {
      var p = window.__cc.preconsent;
      var pr = {
        version: Consent.config.version,
        region: p.region,
        choices: p.choices,
        gpc: !!p.gpc,
        updatedAt: p.updatedAt || null,
        expiresAt: p.expiresAt || null
      };
      if (isRecordValid(pr)) return pr;
    }
    var raw = readStorage(Consent.storageKey);
    var rec = safeJsonParse(raw);
    if (isRecordValid(rec)) return rec;
    return null;
  }

  function writeConsentRecord(region, choices, gpc) {
    var exp = now() + daysToMs(Consent.config.consentExpiryDays);
    var rec = {
      version: Consent.config.version,
      region: region,
      choices: choices,
      gpc: !!gpc,
      updatedAt: now(),
      expiresAt: exp
    };
    var ok = writeStorage(Consent.storageKey, JSON.stringify(rec));
    if (ok) {
      Consent.state.record = rec;
      window.__cc = window.__cc || {};
      window.__cc.preconsent = { region: rec.region, choices: rec.choices, gpc: rec.gpc, updatedAt: rec.updatedAt, expiresAt: rec.expiresAt };
    }
    return ok;
  }

  function setRegionOverride(val) {
    var v = normalizeRegionValue(val);
    if (v === "auto") {
      removeStorage(Consent.regionOverrideKey);
      Consent.state.regionOverride = "auto";
    } else {
      writeStorage(Consent.regionOverrideKey, v);
      Consent.state.regionOverride = v;
    }
    var resolved = resolveRegionMode();
    Consent.state.regionModeEffective = resolved.effective;
    Consent.state.regionResolved = resolved.effective;
  }

  function setFooterMeta(text) {
    var el = document.getElementById("cc-footer-meta");
    if (el) el.textContent = text;
  }

  function buildFooterMeta(rec, region) {
    if (!rec) return "Non-essential cookies are currently blocked until you choose.";
    var date = "";
    try {
      date = new Date(rec.updatedAt).toLocaleDateString();
    } catch (e) {
      date = "";
    }
    var exp = "";
    try {
      exp = new Date(rec.expiresAt).toLocaleDateString();
    } catch (e2) {
      exp = "";
    }
    var parts = [];
    parts.push("Region: " + regionLabel(region));
    if (date) parts.push("Saved: " + date);
    if (exp) parts.push("Expires: " + exp);
    if (Consent.state.gpc) parts.push("GPC: on");
    return parts.join(" · ");
  }

  function shouldGateCategory(region, category) {
    if (category === "necessary") return false;
    if (region === "eu" || region === "uk") return true;
    if (region === "us") return category !== "necessary";
    return category !== "necessary";
  }

  function isCategoryAllowed(region, choices, category) {
    if (category === "necessary") return true;
    if (Consent.state.gpc && category === "marketing") return false;
    if (region === "eu" || region === "uk") {
      return !!choices[category];
    }
    if (region === "us") {
      if (category === "marketing") {
        if (choices.saleOptOut) return false;
        return !!choices.marketing;
      }
      return !!choices[category];
    }
    return !!choices[category];
  }

  function getTextPlainScripts() {
    return Array.prototype.slice.call(document.querySelectorAll('script[type="text/plain"][data-cookiecategory]'));
  }

  function isScriptAlreadyRun(node) {
    return node.getAttribute("data-cc-executed") === "true";
  }

  function markScriptRun(node) {
    node.setAttribute("data-cc-executed", "true");
  }

  function cloneAttributes(from, to) {
    var attrs = from.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      var value = attrs[i].value;
      if (name === "type") continue;
      if (name === "data-cookiecategory") continue;
      to.setAttribute(name, value);
    }
  }

  function executeBlockedScriptsInOrder(region, choices) {
    var nodes = getTextPlainScripts();
    var buckets = { functional: [], analytics: [], marketing: [] };
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (isScriptAlreadyRun(n)) continue;
      var cat = (n.getAttribute("data-cookiecategory") || "").toLowerCase();
      if (!buckets[cat]) continue;
      if (!isCategoryAllowed(region, choices, cat)) continue;
      buckets[cat].push(n);
    }

    var order = ["functional", "analytics", "marketing"];
    for (var j = 0; j < order.length; j++) {
      var list = buckets[order[j]];
      for (var k = 0; k < list.length; k++) {
        var srcNode = list[k];
        var s = document.createElement("script");
        cloneAttributes(srcNode, s);
        var inline = srcNode.textContent;
        if (inline && inline.trim().length) {
          s.text = inline;
        }
        markScriptRun(srcNode);
        srcNode.parentNode.insertBefore(s, srcNode.nextSibling);
      }
    }
  }

  function applyConsentToRuntime() {
    var rec = Consent.state.record;
    if (!rec) return;
    var region = rec.region;
    var choices = clampChoices(rec.choices);
    executeBlockedScriptsInOrder(region, choices);
    setFooterMeta(buildFooterMeta(rec, region));
    updateExampleStatusFallback(region, choices);
  }

  function updateExampleStatusFallback(region, choices) {
    var f = document.getElementById("functional-status");
    var a = document.getElementById("analytics-status");
    var m = document.getElementById("marketing-status");
    if (f && f.textContent === "Not run") {
      if (!isCategoryAllowed(region, choices, "functional")) f.textContent = "Blocked until allowed";
    }
    if (a && a.textContent === "Not run") {
      if (!isCategoryAllowed(region, choices, "analytics")) a.textContent = "Blocked until allowed";
    }
    if (m && m.textContent === "Not run") {
      if (!isCategoryAllowed(region, choices, "marketing")) m.textContent = Consent.state.gpc ? "Blocked due to Global Privacy Control" : "Blocked until allowed";
    }
  }

  function lockScroll(lock) {
    var body = document.body;
    if (!body) return;
    if (lock) {
      body.dataset.ccScrollLock = "true";
      body.style.overflow = "hidden";
    } else {
      if (body.dataset.ccScrollLock === "true") {
        body.style.overflow = "";
        delete body.dataset.ccScrollLock;
      }
    }
  }

  function getFocusable(container) {
    if (!container) return [];
    var selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");
    var all = Array.prototype.slice.call(container.querySelectorAll(selectors));
    return all.filter(function (el) {
      if (el.hasAttribute("hidden")) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      return true;
    });
  }

  function focusFirst(container) {
    var focusables = getFocusable(container);
    if (focusables.length) focusables[0].focus();
  }

  function trapFocus(e) {
    if (!Consent.state.isOpen) return;
    if (e.key !== "Tab") return;
    var modal = document.getElementById("cc-modal");
    var focusables = getFocusable(modal);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !modal.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function show(el) {
    if (el) el.hidden = false;
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  function setPanel(which) {
    var first = document.getElementById("cc-first-panel");
    var custom = document.getElementById("cc-custom-panel");
    if (which === "custom") {
      hide(first);
      show(custom);
    } else {
      show(first);
      hide(custom);
    }
  }

  function updateRegionUi(region) {
    var badge = document.getElementById("cc-region-badge");
    if (badge) badge.textContent = regionLabel(region);
    var usRow = document.getElementById("cc-us-row");
    var usOpt = document.getElementById("cc-us-optout-row");
    if (region === "us") {
      show(usRow);
      show(usOpt);
    } else {
      hide(usRow);
      hide(usOpt);
    }
  }

  function updateGpcUi() {
    var badge = document.getElementById("cc-gpc-badge");
    if (badge) {
      if (Consent.state.gpc) show(badge);
      else hide(badge);
    }
    var marketing = document.getElementById("cc-marketing");
    var sale = document.getElementById("cc-sale");
    if (Consent.state.gpc) {
      if (marketing) marketing.checked = false;
      if (marketing) marketing.disabled = true;
      if (sale) sale.checked = true;
      if (sale) sale.disabled = true;
    } else {
      if (marketing) marketing.disabled = false;
      if (sale) sale.disabled = false;
    }
  }

  function updateSmallprint(region) {
    var t = "Your choice will be saved for " + expiryText(Consent.config.consentExpiryDays) + " unless you update it earlier. You can change your mind at any time via Cookie settings.";
    if (region === "eu" || region === "uk") {
      t += " In " + (region === "uk" ? "the UK" : "the EU") + ", optional categories are off until you opt in.";
    } else if (region === "us") {
      t += " In the US, you can opt out of sale/sharing and targeted advertising, including via Global Privacy Control where supported.";
    } else {
      t += " Depending on your location, certain uses may require opt-in before optional categories run.";
    }
    var sp1 = document.getElementById("cc-smallprint");
    var sp2 = document.getElementById("cc-smallprint-2");
    if (sp1) sp1.textContent = t;
    if (sp2) sp2.textContent = t;
  }

  function openModal(initialPanel) {
    var modal = document.getElementById("cc-modal");
    var backdrop = document.getElementById("cc-backdrop");
    if (!modal || !backdrop) return;
    if (Consent.state.isOpen) return;

    Consent.state.isOpen = true;
    Consent.state.lastFocused = document.activeElement;

    show(backdrop);
    show(modal);
    lockScroll(true);

    setPanel(initialPanel || "first");
    updateRegionUi(Consent.state.regionResolved);
    updateSmallprint(Consent.state.regionResolved);

    var regionSelect = document.getElementById("cc-region-select");
    if (regionSelect) {
      var storedOverride = normalizeRegionValue(readStorage(Consent.regionOverrideKey) || "auto");
      regionSelect.value = storedOverride === "eu" || storedOverride === "uk" || storedOverride === "us" || storedOverride === "row" ? storedOverride : "auto";
    }

    var rec = Consent.state.record;
    var choices = rec ? clampChoices(rec.choices) : defaultChoicesForRegion(Consent.state.regionResolved, Consent.state.gpc);
    setFormFromChoices(Consent.state.regionResolved, choices);
    updateGpcUi();

    document.addEventListener("keydown", trapFocus, true);
    document.addEventListener("keydown", blockEscape, true);

    focusFirst(modal);
  }

  function closeModal() {
    var modal = document.getElementById("cc-modal");
    var backdrop = document.getElementById("cc-backdrop");
    if (!modal || !backdrop) return;
    if (!Consent.state.isOpen) return;

    hide(modal);
    hide(backdrop);
    lockScroll(false);

    document.removeEventListener("keydown", trapFocus, true);
    document.removeEventListener("keydown", blockEscape, true);

    Consent.state.isOpen = false;
    var prev = Consent.state.lastFocused;
    Consent.state.lastFocused = null;
    if (prev && typeof prev.focus === "function") prev.focus();
  }

  function blockEscape(e) {
    if (!Consent.state.isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
    }
  }

  function setFormFromChoices(region, choices) {
    var f = document.getElementById("cc-functional");
    var a = document.getElementById("cc-analytics");
    var m = document.getElementById("cc-marketing");
    var s = document.getElementById("cc-sale");

    if (f) f.checked = !!choices.functional;
    if (a) a.checked = !!choices.analytics;
    if (m) m.checked = !!choices.marketing;
    if (s) s.checked = !!choices.saleOptOut;

    if (region === "eu" || region === "uk") {
      if (s) s.checked = false;
    }
  }

  function getChoicesFromForm(region) {
    var f = document.getElementById("cc-functional");
    var a = document.getElementById("cc-analytics");
    var m = document.getElementById("cc-marketing");
    var s = document.getElementById("cc-sale");

    var choices = {
      necessary: true,
      functional: !!(f && f.checked),
      analytics: !!(a && a.checked),
      marketing: !!(m && m.checked),
      saleOptOut: !!(s && s.checked)
    };

    if (region === "eu" || region === "uk") {
      choices.saleOptOut = false;
    }

    return clampChoices(choices);
  }

  function acceptAll() {
    var region = Consent.state.regionResolved;
    var choices = { necessary: true, functional: true, analytics: true, marketing: true, saleOptOut: false };
    choices = clampChoices(choices);
    var ok = writeConsentRecord(region, choices, Consent.state.gpc);
    if (ok) {
      applyConsentToRuntime();
      closeModal();
    }
  }

  function rejectAll() {
    var region = Consent.state.regionResolved;
    var choices = { necessary: true, functional: false, analytics: false, marketing: false, saleOptOut: false };
    if (region === "us") choices.saleOptOut = true;
    choices = clampChoices(choices);
    var ok = writeConsentRecord(region, choices, Consent.state.gpc);
    if (ok) {
      applyConsentToRuntime();
      closeModal();
    }
  }

  function savePreferences(e) {
    if (e) e.preventDefault();
    var regionSelect = document.getElementById("cc-region-select");
    var selected = regionSelect ? normalizeRegionValue(regionSelect.value) : "auto";
    if (selected === "auto") {
      removeStorage(Consent.regionOverrideKey);
      Consent.state.regionResolved = resolveRegionMode().effective;
    } else {
      setRegionOverride(selected);
      Consent.state.regionResolved = selected;
    }

    var region = Consent.state.regionResolved;
    var choices = getChoicesFromForm(region);
    var ok = writeConsentRecord(region, choices, Consent.state.gpc);
    if (ok) {
      applyConsentToRuntime();
      closeModal();
    }
  }

  function doNotSellOrShare() {
    var region = Consent.state.regionResolved;
    if (region !== "us") {
      openModal("custom");
      return;
    }
    var rec = Consent.state.record;
    var base = rec ? clampChoices(rec.choices) : defaultChoicesForRegion(region, Consent.state.gpc);
    base.saleOptOut = true;
    base.marketing = false;
    base = clampChoices(base);
    var ok = writeConsentRecord(region, base, Consent.state.gpc);
    if (ok) {
      applyConsentToRuntime();
      closeModal();
    }
  }

  function wireUiOnce() {
    if (Consent.state.wired) return;
    Consent.state.wired = true;

    document.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        if (!t) return;

        var el = t;
        var guard = 0;
        while (el && guard < 6) {
          if (el.id) break;
          el = el.parentElement;
          guard++;
        }
        if (!el || !el.id) return;

        var id = el.id;

        if (id === "cc-open-settings") {
          e.preventDefault();
          e.stopPropagation();
          openModal("custom");
          return;
        }

        if (id === "cc-accept") {
          e.preventDefault();
          e.stopPropagation();
          acceptAll();
          return;
        }

        if (id === "cc-reject" || id === "cc-reject-2") {
          e.preventDefault();
          e.stopPropagation();
          rejectAll();
          return;
        }

        if (id === "cc-customize") {
          e.preventDefault();
          e.stopPropagation();
          setPanel("custom");
          updateRegionUi(Consent.state.regionResolved);
          updateSmallprint(Consent.state.regionResolved);
          focusFirst(document.getElementById("cc-modal"));
          return;
        }

        if (id === "cc-back") {
          e.preventDefault();
          e.stopPropagation();
          setPanel("first");
          updateRegionUi(Consent.state.regionResolved);
          updateSmallprint(Consent.state.regionResolved);
          focusFirst(document.getElementById("cc-modal"));
          return;
        }

        if (id === "cc-dnss") {
          e.preventDefault();
          e.stopPropagation();
          doNotSellOrShare();
          return;
        }
      },
      true
    );

    document.addEventListener(
      "submit",
      function (e) {
        var form = e.target;
        if (!form || form.id !== "cc-form") return;
        savePreferences(e);
      },
      true
    );

    document.addEventListener(
      "change",
      function (e) {
        var t = e.target;
        if (!t || !t.id) return;

        if (t.id === "cc-region-select") {
          var selected = normalizeRegionValue(t.value);
          var effective = selected === "auto" ? resolveRegionMode().effective : selected;
          Consent.state.regionResolved = effective;
          updateRegionUi(effective);
          updateSmallprint(effective);
          var rec = Consent.state.record;
          var choices = rec ? clampChoices(rec.choices) : defaultChoicesForRegion(effective, Consent.state.gpc);
          if (effective === "eu" || effective === "uk") {
            choices.functional = false;
            choices.analytics = false;
            choices.marketing = false;
            choices.saleOptOut = false;
          }
          if (effective === "us" && !rec) {
            choices.functional = true;
            choices.analytics = true;
            choices.marketing = !Consent.state.gpc;
            choices.saleOptOut = !!Consent.state.gpc;
          }
          setFormFromChoices(effective, choices);
          updateGpcUi();
          return;
        }

        if (t.id === "cc-marketing") {
          var region = Consent.state.regionResolved;
          if (region === "us") {
            var sale = document.getElementById("cc-sale");
            if (sale && t.checked) sale.checked = false;
          }
          return;
        }

        if (t.id === "cc-sale") {
          var region2 = Consent.state.regionResolved;
          if (region2 === "us") {
            var marketing2 = document.getElementById("cc-marketing");
            if (t.checked && marketing2) marketing2.checked = false;
          }
          updateGpcUi();
          return;
        }
      },
      true
    );
  }

  function initState() {
    Consent.state.gpc = getGpc();
    var resolved = resolveRegionMode();
    Consent.state.regionModeEffective = resolved.effective;
    Consent.state.regionOverride = resolved.override;
    Consent.state.regionResolved = resolved.effective;

    var rec = readConsentRecord();
    if (rec) {
      Consent.state.record = rec;
      Consent.state.regionResolved = rec.region;
    } else {
      Consent.state.record = null;
    }
  }

  function applyInitial() {
    var rec = Consent.state.record;
    if (rec) {
      var choices = clampChoices(rec.choices);
      if (Consent.state.gpc && (!rec.gpc || choices.marketing !== false || choices.saleOptOut !== true)) {
        choices.marketing = false;
        choices.saleOptOut = true;
        writeConsentRecord(rec.region, choices, true);
      }
      applyConsentToRuntime();
      return;
    }

    var region = Consent.state.regionResolved;
    updateRegionUi(region);
    updateSmallprint(region);
    setFooterMeta(buildFooterMeta(null, region));

    openModal("first");
  }

  function observeNewBlockedScripts() {
    if (!("MutationObserver" in window)) return;
    var mo = new MutationObserver(function (mutations) {
      var rec = Consent.state.record;
      if (!rec) return;
      var region = rec.region;
      var choices = clampChoices(rec.choices);
      var shouldRun = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.tagName && node.tagName.toLowerCase() === "script") {
              var type = node.getAttribute("type");
              var cat = (node.getAttribute("data-cookiecategory") || "").toLowerCase();
              if (type === "text/plain" && cat) {
                if (isCategoryAllowed(region, choices, cat)) shouldRun = true;
              }
            } else {
              var nested = node.querySelectorAll ? node.querySelectorAll('script[type="text/plain"][data-cookiecategory]') : [];
              if (nested && nested.length) shouldRun = true;
            }
          }
        }
      }
      if (shouldRun) executeBlockedScriptsInOrder(region, choices);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function enforceNoPreconsentExecution() {
    var region = Consent.state.regionResolved;
    var rec = Consent.state.record;
    if (!rec) return;
    var choices = clampChoices(rec.choices);
    var scripts = getTextPlainScripts();
    for (var i = 0; i < scripts.length; i++) {
      var cat = (scripts[i].getAttribute("data-cookiecategory") || "").toLowerCase();
      if (!cat) continue;
      if (shouldGateCategory(region, cat) && !isCategoryAllowed(region, choices, cat)) {
        continue;
      }
    }
    executeBlockedScriptsInOrder(region, choices);
  }

  function main() {
    initState();
    wireUiOnce();
    observeNewBlockedScripts();
    enforceNoPreconsentExecution();
    applyInitial();
  }

  function waitForConsentNodes(cb) {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (
        document.getElementById("cc-modal") &&
        document.getElementById("cc-backdrop") &&
        document.getElementById("cc-open-settings") &&
        document.getElementById("cc-customize") &&
        document.getElementById("cc-accept") &&
        document.getElementById("cc-reject")
      ) {
        clearInterval(t);
        cb();
      }
      if (tries > 600) {
        clearInterval(t);
      }
    }, 10);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      waitForConsentNodes(main);
    });
  } else {
    waitForConsentNodes(main);
  }
})();