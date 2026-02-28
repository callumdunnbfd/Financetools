(function () {
  const form =
    document.getElementById("loanForm") ||
    document.getElementById("personalLoanForm") ||
    document.querySelector('form[data-tool="loan"]') ||
    document.querySelector("form");

  if (!form) return;

  const resultsShell = document.getElementById("resultsShell");
  const resultsCard = document.querySelector(".results-card");

  const resetBtn = document.getElementById("resetBtn");
  const persistToggle = document.getElementById("persistToggle");

  const loanAmountInput = document.getElementById("loanAmount");
  const aprInput = document.getElementById("apr");
  const termYearsInput = document.getElementById("termYears");
  const termMonthsInput = document.getElementById("termMonths");
  const overpayInput = document.getElementById("overpay");
  const feeInput = document.getElementById("fee");

  const kpiPayment = document.getElementById("kpiPayment");
  const kpiPaymentMeta = document.getElementById("kpiPaymentMeta");
  const kpiDate = document.getElementById("kpiDate");
  const kpiTermMeta = document.getElementById("kpiTermMeta");
  const kpiInterest = document.getElementById("kpiInterest");
  const kpiTotalCost = document.getElementById("kpiTotalCost");
  const kpiCostMeta = document.getElementById("kpiCostMeta");

  const callout = document.getElementById("resultsCallout");
  const calloutTitle = document.getElementById("calloutTitle");
  const calloutBody = document.getElementById("calloutBody");

  const scheduleBody = document.getElementById("scheduleBody");
  const scheduleMeta = document.getElementById("scheduleMeta");
  const scheduleDetails = document.getElementById("scheduleDetails");

  const formMessage = document.getElementById("formMessage");
  const affiliateSlot = document.getElementById("affiliateSlot");

  const termUnitRadios = Array.from(form.querySelectorAll('input[name="termUnit"]'));
  const termFields = Array.from(form.querySelectorAll(".term-field"));

  const STORAGE_KEY = "loan_repayment_inputs_v1";

  let openedOnceDesktop = false;
  let scheduleCache = null;
  let scheduleRendered = false;

  function isDesktop() {
    return window.innerWidth >= 920;
  }

  function setResultsState(state) {
    if (!resultsShell) return;
    resultsShell.dataset.state = state;
  }

  
  function setDesktopCollapsed(collapsed) {
    if (!resultsCard) return;
    if (!isDesktop()) return;
    resultsCard.setAttribute("data-collapsed", collapsed ? "true" : "false");
  }

  function openDesktopOnce() {
    if (!isDesktop()) return;
    if (openedOnceDesktop) return;
    setDesktopCollapsed(false);
    openedOnceDesktop = true;
  }

  function currency(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return "£" + x.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function monthsToLabel(m) {
    const x = Math.floor(Number(m));
    if (!Number.isFinite(x) || x <= 0) return "—";
    const years = Math.floor(x / 12);
    const months = x % 12;
    if (years <= 0) return x + " months";
    if (months === 0) return years + " years";
    return years + " years " + months + " months";
  }

  function parseMoney(input) {
    const raw = String(input || "").replace(/,/g, "").trim();
    const n = Number(raw);
    if (!Number.isFinite(n)) return NaN;
    return n;
  }

  function parsePercent(input) {
    const raw = String(input || "").trim();
    const n = Number(raw);
    if (!Number.isFinite(n)) return NaN;
    return n;
  }

  function activeTermUnit() {
    const checked = termUnitRadios.find(r => r.checked);
    return checked ? checked.value : "years";
  }

  function setTermUnit(unit) {
    termFields.forEach(el => {
      const show = el.getAttribute("data-unit") === unit;
      el.hidden = !show;
    });
  }

  function getTermMonths() {
    const unit = activeTermUnit();
    if (unit === "months") {
      const m = Math.floor(Number(String(termMonthsInput && termMonthsInput.value || "").trim()));
      return m;
    }
    const y = Number(String(termYearsInput && termYearsInput.value || "").trim());
    if (!Number.isFinite(y)) return NaN;
    return Math.floor(y * 12);
  }

  function buildCheckpointMonths(finalMonth) {
    const n = Math.floor(Number(finalMonth));
    if (!Number.isFinite(n) || n <= 0) return [];
    if (n === 1) return [1];

    const desired = 5;
    const months = [1];

    for (let m = 12; m < n && months.length < desired - 1; m += 12) {
      months.push(m);
    }

    if (months.length < desired - 1) {
      const need = (desired - 1) - months.length;
      for (let i = 1; i <= need; i++) {
        const guess = Math.round((i * n) / (need + 1));
        if (guess > 1 && guess < n && !months.includes(guess)) months.push(guess);
      }
    }

    months.sort((a, b) => a - b);
    if (!months.includes(n)) months.push(n);

    return months;
  }

  function updateScheduleMeta(result) {
    if (!scheduleMeta) return;
    if (!result || !Number.isFinite(result.monthsActual)) {
      scheduleMeta.textContent = "—";
      return;
    }
    const checkpoints = buildCheckpointMonths(result.monthsActual);
    scheduleMeta.textContent = checkpoints.length + " checkpoints • Final month " + result.monthsActual;
  }

  function renderScheduleLazily() {
    if (!scheduleDetails || !scheduleBody) return;
    if (!scheduleDetails.open) return;
    if (scheduleRendered) return;
    if (!scheduleCache || !Array.isArray(scheduleCache.schedule)) return;

    const rows = scheduleCache.schedule;
    const finalMonth = scheduleCache.monthsActual;
    const checkpoints = buildCheckpointMonths(finalMonth);
    const parts = new Array(checkpoints.length);

    for (let i = 0; i < checkpoints.length; i++) {
      const m = checkpoints[i];
      const r = rows[m - 1];
      if (!r) continue;

      const label = m === finalMonth ? "Final (Month " + m + ")" : "Month " + m;

      parts[i] =
        "<tr>" +
          "<td>" + label + "</td>" +
          "<td>" + currency(r.total) + "</td>" +
          "<td>" + currency(r.interest) + "</td>" +
          "<td>" + currency(r.balance) + "</td>" +
        "</tr>";
    }

    scheduleBody.innerHTML = parts.join("");
    scheduleRendered = true;
  }

  function showCallout(base, actual) {
    if (!callout || !calloutTitle || !calloutBody) return;

    const timeSaved = base.monthsActual - actual.monthsActual;
    const interestSaved = base.totalInterest - actual.totalInterest;

    if (timeSaved <= 0 && interestSaved <= 0) {
      callout.hidden = true;
      return;
    }

    callout.hidden = false;

    const timeText = timeSaved > 0 ? monthsToLabel(timeSaved) : null;
    const interestText = interestSaved > 0 ? currency(interestSaved) : null;

    if (timeText && interestText) {
      calloutTitle.textContent = "Estimated savings from overpayments";
      calloutBody.textContent = "You could repay about " + timeText + " sooner and save around " + interestText + " in interest versus no overpayments.";
      return;
    }

    if (timeText) {
      calloutTitle.textContent = "Estimated time saved";
      calloutBody.textContent = "You could repay about " + timeText + " sooner versus no overpayments.";
      return;
    }

    calloutTitle.textContent = "Estimated interest saved";
    calloutBody.textContent = "You could save around " + interestText + " in interest versus no overpayments.";
  }

  function validateInputs(loanAmount, apr, termMonths) {
    if (!Number.isFinite(loanAmount) || loanAmount <= 0) return "Please enter a valid loan amount.";
    if (!Number.isFinite(apr) || apr < 0 || apr > 100) return "Please enter a valid APR (0–100).";
    if (!Number.isFinite(termMonths) || termMonths <= 0) return "Please enter a valid loan term.";
    if (termMonths > 600) return "Please enter a loan term of 600 months or less.";
    return "";
  }

  function runCalculation() {
    const loanAmount = parseMoney(loanAmountInput && loanAmountInput.value);
    const apr = parsePercent(aprInput && aprInput.value);
    const termMonths = getTermMonths();
    const overpay = parseMoney(overpayInput && overpayInput.value || 0);
    const fee = parseMoney(feeInput && feeInput.value || 0);

    const err = validateInputs(loanAmount, apr, termMonths);
    if (err) {
      if (formMessage) formMessage.textContent = err;
      setResultsState("empty");
      if (isDesktop()) setDesktopCollapsed(true);
      return;
    }

    if (!window.Amortisation || typeof window.Amortisation.amortise !== "function") {
      if (formMessage) formMessage.textContent = "Calculator engine failed to load. Please refresh the page.";
      setResultsState("empty");
      if (isDesktop()) setDesktopCollapsed(true);
      return;
    }

    if (formMessage) formMessage.textContent = "";

    const now = new Date();

    const base = window.Amortisation.amortise({
      loanAmount,
      fee,
      apr,
      termMonths,
      overpay: 0,
      startDate: now
    });

    const actual = window.Amortisation.amortise({
      loanAmount,
      fee,
      apr,
      termMonths,
      overpay: Number.isFinite(overpay) ? overpay : 0,
      startDate: now
    });

    if (!base || !actual) {
      if (formMessage) formMessage.textContent = "Please check your inputs and try again.";
      setResultsState("empty");
      if (isDesktop()) setDesktopCollapsed(true);
      return;
    }

    if (kpiPayment) kpiPayment.textContent = currency(actual.monthlyPayment);
    if (kpiPaymentMeta) {
      kpiPaymentMeta.textContent = actual.overpay > 0
        ? "Total monthly outflow: " + currency(actual.monthlyPayment + actual.overpay)
        : "Contractual monthly payment";
    }

      if (kpiDate) {
      const m = Number(actual.monthsActual);
      if (Number.isFinite(m) && m > 0) {
        const pd = addMonthsSafe(new Date(), m);
        kpiDate.textContent = formatMonthYear(pd);
      } else {
        kpiDate.textContent = "—";
      }
    }

    if (kpiTermMeta) kpiTermMeta.textContent = "Estimated term: " + monthsToLabel(actual.monthsActual);
    if (kpiInterest) kpiInterest.textContent = currency(actual.totalInterest);

    if (kpiTotalCost) kpiTotalCost.textContent = currency(actual.totalPaid);
    if (kpiCostMeta) kpiCostMeta.textContent = actual.fee > 0 ? "Includes fee of " + currency(actual.fee) : "Excludes fees";

    showCallout(base, actual);

    scheduleCache = actual;
    scheduleRendered = false;
    if (scheduleBody) scheduleBody.innerHTML = "";
    updateScheduleMeta(actual);
    if (scheduleDetails) scheduleDetails.open = false;

    setResultsState("ready");
    openDesktopOnce();

    if (window.innerWidth < 920) {
    const rc = document.querySelector(".results-card");
    if (rc) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          rc.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }
  setResultsState("ready");
  openDesktopOnce();
    if (persistToggle && persistToggle.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        loanAmount,
        apr,
        termUnit: activeTermUnit(),
        termYears: termYearsInput ? termYearsInput.value || "" : "",
        termMonths: termMonthsInput ? termMonthsInput.value || "" : "",
        overpay: overpayInput ? overpayInput.value || "" : "",
        fee: feeInput ? feeInput.value || "" : ""
      }));
    }

    if (window.Affiliate && affiliateSlot) {
      const interestSaved = base.totalInterest - actual.totalInterest;
      window.Affiliate.render({
        slot: affiliateSlot,
        context: {
          loanAmount,
          apr,
          term: termMonths,
          interestSaved,
          totalInterest: actual.totalInterest,
          monthlyPayment: actual.monthlyPayment
        }
      });
    }
  }
  function addMonthsSafe(date, months) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }

  function formatMonthYear(d) {
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    runCalculation();
  }

  function handleReset(e) {
    if (e) e.preventDefault();
    form.reset();
    setTermUnit("years");

    scheduleCache = null;
    scheduleRendered = false;
    if (scheduleBody) scheduleBody.innerHTML = "";
    if (scheduleMeta) scheduleMeta.textContent = "—";

    if (callout) callout.hidden = true;
    if (formMessage) formMessage.textContent = "";

    if (kpiPayment) kpiPayment.textContent = "—";
    if (kpiPaymentMeta) kpiPaymentMeta.textContent = "—";
    if (kpiDate) kpiDate.textContent = "—";
    if (kpiTermMeta) kpiTermMeta.textContent = "—";
    if (kpiInterest) kpiInterest.textContent = "—";
    if (kpiTotalCost) kpiTotalCost.textContent = "—";
    if (kpiCostMeta) kpiCostMeta.textContent = "—";

    setResultsState("empty");
    openedOnceDesktop = false;
    if (isDesktop()) setDesktopCollapsed(true);

    localStorage.removeItem(STORAGE_KEY);

    if (window.Affiliate && affiliateSlot && window.Affiliate.clear) {
      window.Affiliate.clear(affiliateSlot);
    }
  }

  function loadInputs() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (loanAmountInput) loanAmountInput.value = data.loanAmount || "";
      if (aprInput) aprInput.value = data.apr || "";
      if (overpayInput) overpayInput.value = data.overpay || "";
      if (feeInput) feeInput.value = data.fee || "";
      if (termYearsInput) termYearsInput.value = data.termYears || "";
      if (termMonthsInput) termMonthsInput.value = data.termMonths || "";

      const unit = data.termUnit === "months" ? "months" : "years";
      termUnitRadios.forEach(r => r.checked = r.value === unit);
      setTermUnit(unit);

      if (persistToggle) persistToggle.checked = true;
    } catch {}
  }

  function wireTermToggle() {
    termUnitRadios.forEach(radio => {
      radio.addEventListener("change", () => {
        setTermUnit(activeTermUnit());
      });
    });
    setTermUnit(activeTermUnit());
  }

  loadInputs();
  setResultsState("empty");
  if (scheduleMeta) scheduleMeta.textContent = "—";
  if (callout) callout.hidden = true;
  if (isDesktop()) setDesktopCollapsed(true);
  wireTermToggle();

  form.addEventListener("submit", handleSubmit);

  const calcBtn =
    document.getElementById("calcBtn") ||
    form.querySelector('button[type="submit"]') ||
    form.querySelector(".btn.primary");

  if (calcBtn) {
    calcBtn.addEventListener("click", function (e) {
      e.preventDefault();
      runCalculation();
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", handleReset);

  if (scheduleDetails) {
    scheduleDetails.addEventListener("toggle", function () {
      renderScheduleLazily();
    });
  }

  window.addEventListener("resize", function () {
    if (!isDesktop()) return;
    if (openedOnceDesktop) {
      setDesktopCollapsed(false);
      return;
    }
    setDesktopCollapsed(true);
  });
})();