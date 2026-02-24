(function () {
  const STORAGE_KEY = "cc_payoff_inputs_v1";

  const form = document.getElementById("ccPayoffForm");
  const msg = document.getElementById("formMessage");
  const resetBtn = document.getElementById("resetBtn");

  const balanceEl = document.getElementById("balance");
  const aprEl = document.getElementById("apr");
  const paymentEl = document.getElementById("payment");
  const extraEl = document.getElementById("extra");
  const persistToggle = document.getElementById("persistToggle");

  const resultsShell = document.getElementById("resultsShell");

  const kpiTime = document.getElementById("kpiTime");
  const kpiTimeMeta = document.getElementById("kpiTimeMeta");
  const kpiDate = document.getElementById("kpiDate");
  const kpiInterest = document.getElementById("kpiInterest");
  const kpiSaved = document.getElementById("kpiSaved");

  const scheduleMeta = document.getElementById("scheduleMeta");
  const scheduleBody = document.getElementById("scheduleBody");

  const callout = document.getElementById("resultsCallout");
  const calloutTitle = document.getElementById("calloutTitle");
  const calloutBody = document.getElementById("calloutBody");

  const affiliateSlot = document.getElementById("affiliateSlot");

  const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });

  function parseMoney(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim().replace(/[,£\s]/g, "");
    if (!s) return NaN;
    return Number(s);
  }

  function parsePercent(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim().replace(/[%\s]/g, "");
    if (!s) return NaN;
    return Number(s);
  }

  function fmtMoney(n) {
    if (!Number.isFinite(n)) return "—";
    return moneyFmt.format(n);
  }

  function fmtMonths(totalMonths) {
    const m = Math.max(0, Math.floor(totalMonths));
    const years = Math.floor(m / 12);
    const months = m % 12;
    const parts = [];
    if (years) parts.push(years + " year" + (years === 1 ? "" : "s"));
    parts.push(months + " month" + (months === 1 ? "" : "s"));
    return { years, months, text: parts.join(" ") };
  }

  function addMonthsToToday(months) {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
  }

  function fmtMonthYear(dateObj) {
    try {
      return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(dateObj);
    } catch (e) {
      return "—";
    }
  }

  function calcSchedule(balance, apr, monthlyPayment) {
    const r = (apr / 100) / 12;
    let b = balance;
    let totalInterest = 0;
    let months = 0;
    const rows = [];
    const maxMonths = 1200;

    while (b > 0.005 && months < maxMonths) {
      months += 1;
      const interest = r > 0 ? b * r : 0;
      const pay = Math.min(monthlyPayment, b + interest);
      const principal = pay - interest;

      if (principal <= 0) {
        return { ok: false, months: Infinity, totalInterest: Infinity, rows: [] };
      }

      b = b - principal;
      totalInterest += interest;

      rows.push({
        m: months,
        payment: pay,
        interest: interest,
        principal: principal,
        balance: Math.max(0, b)
      });
    }

    if (months >= maxMonths) {
      return { ok: false, months: Infinity, totalInterest: Infinity, rows: [] };
    }

    return { ok: true, months, totalInterest, rows };
  }

  function setCallout(title, body) {
    if (!title && !body) {
      callout.hidden = true;
      calloutTitle.textContent = "";
      calloutBody.textContent = "";
      return;
    }
    callout.hidden = false;
    calloutTitle.textContent = title || "";
    calloutBody.textContent = body || "";
  }

  function clearTable() {
    scheduleBody.innerHTML = "";
  }

  function renderSchedule(rows) {
    const frag = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdM = document.createElement("td");
      tdM.textContent = String(row.m);
      tr.appendChild(tdM);

      const tdP = document.createElement("td");
      tdP.textContent = fmtMoney(row.payment);
      tr.appendChild(tdP);

      const tdI = document.createElement("td");
      tdI.textContent = fmtMoney(row.interest);
      tr.appendChild(tdI);

      const tdPr = document.createElement("td");
      tdPr.textContent = fmtMoney(row.principal);
      tr.appendChild(tdPr);

      const tdB = document.createElement("td");
      tdB.textContent = fmtMoney(row.balance);
      tr.appendChild(tdB);

      frag.appendChild(tr);
    }
    scheduleBody.appendChild(frag);
  }

  function saveInputs() {
    if (!persistToggle.checked) return;
    const rec = {
      balance: balanceEl.value,
      apr: aprEl.value,
      payment: paymentEl.value,
      extra: extraEl.value
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    } catch (e) {}
  }

  function loadInputs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const rec = JSON.parse(raw);
      if (!rec) return;
      balanceEl.value = rec.balance || "";
      aprEl.value = rec.apr || "";
      paymentEl.value = rec.payment || "";
      extraEl.value = rec.extra || "";
      persistToggle.checked = true;
    } catch (e) {}
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function setMessage(t) {
    msg.textContent = t || "";
  }

  async function runAffiliate(context) {
    if (!affiliateSlot) return;
    if (!window.AffiliateEngine || typeof window.AffiliateEngine.run !== "function") return;
    await window.AffiliateEngine.run({
      container: affiliateSlot,
      configUrl: "/tools/assets/data/affiliate-offers-uk.json",
      context: context
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setCallout("", "");
    clearTable();

    const balance = parseMoney(balanceEl.value);
    const apr = parsePercent(aprEl.value);
    const payment = parseMoney(paymentEl.value);
    const extra = parseMoney(extraEl.value);
    const extraPay = Number.isFinite(extra) ? Math.max(0, extra) : 0;

    if (!Number.isFinite(balance) || balance <= 0) {
      setMessage("Enter a valid current balance.");
      return;
    }
    if (!Number.isFinite(apr) || apr < 0 || apr > 200) {
      setMessage("Enter a valid APR (0–200).");
      return;
    }
    if (!Number.isFinite(payment) || payment <= 0) {
      setMessage("Enter a valid monthly payment.");
      return;
    }

    const base = calcSchedule(balance, apr, payment);
    if (!base.ok) {
      setMessage("Your monthly payment is too low to reduce the balance (it doesn’t cover interest). Increase the payment and try again.");
      resultsShell.dataset.hasResults = "false";
      kpiTime.textContent = "—";
      kpiTimeMeta.textContent = "—";
      kpiDate.textContent = "—";
      kpiInterest.textContent = "—";
      kpiSaved.textContent = "—";
      scheduleMeta.textContent = "—";
      affiliateSlot.innerHTML = '<div class="affiliate-placeholder" aria-hidden="true"></div>';
      return;
    }

    const withExtra = calcSchedule(balance, apr, payment + extraPay);

    const baseTime = fmtMonths(base.months);
    kpiTime.textContent = baseTime.text;
    kpiTimeMeta.textContent = extraPay > 0 && withExtra.ok ? "With extra: " + fmtMonths(withExtra.months).text : "—";

    kpiDate.textContent = fmtMonthYear(addMonthsToToday(base.months));
    kpiInterest.textContent = fmtMoney(base.totalInterest);

    let saved = 0;
    if (extraPay > 0 && withExtra.ok) saved = Math.max(0, base.totalInterest - withExtra.totalInterest);
    kpiSaved.textContent = extraPay > 0 && withExtra.ok ? fmtMoney(saved) : fmtMoney(0);

    scheduleMeta.textContent = base.months === 1 ? "1 month" : base.months + " months";
    renderSchedule(base.rows);

    if (extraPay > 0 && withExtra.ok) {
      const monthsSaved = Math.max(0, base.months - withExtra.months);
      setCallout(
        "Impact of the extra payment",
        "An extra " + fmtMoney(extraPay) + " per month could save about " + fmtMoney(saved) + " in interest and shorten repayment by " + fmtMonths(monthsSaved).text + "."
      );
    } else {
      setCallout("", "");
    }

    resultsShell.dataset.hasResults = "true";
    saveInputs();

    runAffiliate({
      balance: balance,
      apr: apr,
      payment: payment,
      extraPayment: extraPay,
      monthsToPayoff: base.months,
      totalInterest: base.totalInterest,
      interestSaved: saved
    });
  }

  function handleReset() {
    balanceEl.value = "";
    aprEl.value = "";
    paymentEl.value = "";
    extraEl.value = "";
    setMessage("");
    setCallout("", "");
    clearTable();
    resultsShell.dataset.hasResults = "false";
    kpiTime.textContent = "—";
    kpiTimeMeta.textContent = "—";
    kpiDate.textContent = "—";
    kpiInterest.textContent = "—";
    kpiSaved.textContent = "—";
    scheduleMeta.textContent = "—";
    affiliateSlot.innerHTML = '<div class="affiliate-placeholder" aria-hidden="true"></div>';
    if (!persistToggle.checked) clearSaved();
  }

  function handlePersistToggle() {
    if (!persistToggle.checked) {
      clearSaved();
      return;
    }
    saveInputs();
  }

  loadInputs();

  form.addEventListener("submit", handleSubmit);
  resetBtn.addEventListener("click", handleReset);
  persistToggle.addEventListener("change", handlePersistToggle);

  const inputs = [balanceEl, aprEl, paymentEl, extraEl];
  for (const el of inputs) {
    el.addEventListener("input", function () {
      if (persistToggle.checked) saveInputs();
    });
  }
})();