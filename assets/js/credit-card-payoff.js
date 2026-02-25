(function () {

  const form = document.getElementById("ccPayoffForm");
  const resetBtn = document.getElementById("resetBtn");
  const persistToggle = document.getElementById("persistToggle");

  const balanceInput = document.getElementById("balance");
  const aprInput = document.getElementById("apr");
  const paymentInput = document.getElementById("payment");
  const extraInput = document.getElementById("extra");

  const resultsShell = document.getElementById("resultsShell");
  const resultsCard = document.querySelector(".results-card");

  const kpiTime = document.getElementById("kpiTime");
  const kpiTimeMeta = document.getElementById("kpiTimeMeta");
  const kpiDate = document.getElementById("kpiDate");
  const kpiInterest = document.getElementById("kpiInterest");
  const kpiSaved = document.getElementById("kpiSaved");

  const scheduleBody = document.getElementById("scheduleBody");
  const scheduleMeta = document.getElementById("scheduleMeta");
  const scheduleDetails = document.getElementById("scheduleDetails");

  const formMessage = document.getElementById("formMessage");
  const affiliateSlot = document.getElementById("affiliateSlot");

  const STORAGE_KEY = "cc_payoff_inputs_v1";

  let openedOnceDesktop = false;

  function isDesktop() {
    return window.innerWidth >= 920;
  }

  function setResultsState(state) {
    resultsShell.dataset.state = state;
    resultsShell.dataset.hasResults = state === "ready" ? "true" : "false";
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
    return "£" + n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  }

  function monthsToYearsMonths(m) {
    const years = Math.floor(m / 12);
    const months = m % 12;
    if (years > 0) return years + " yr " + months + " mo";
    return months + " mo";
  }

  function calculate(balance, apr, payment, extra) {
    const monthlyRate = apr / 100 / 12;
    let remaining = balance;
    let month = 0;
    let totalInterest = 0;
    const schedule = [];

    while (remaining > 0 && month < 600) {
      month++;
      const interest = remaining * monthlyRate;
      totalInterest += interest;

      const totalPayment = Math.min(payment + extra, remaining + interest);

      remaining = remaining + interest - totalPayment;
      if (remaining < 0) remaining = 0;

      schedule.push({
        month,
        payment: totalPayment,
        interest,
        balance: remaining
      });
    }

    return {
      months: month,
      totalInterest,
      schedule
    };
  }

  function uniqSorted(arr) {
    const set = new Set();
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (typeof v === "number" && Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function checkpointLabel(month, isFinal) {
    if (isFinal) return "Final (Month " + month + ")";
    if (month === 1) return "Month 1";
    if (month === 12) return "Month 12";
    if (month === 24) return "Month 24";
    if (month === 36) return "Month 36";
    return "Month " + month;
  }

  function renderMiniSchedule(schedule) {
    scheduleBody.innerHTML = "";

    if (!Array.isArray(schedule) || !schedule.length) {
      if (scheduleMeta) scheduleMeta.textContent = "—";
      if (scheduleDetails) scheduleDetails.open = false;
      return;
    }

    const lastIndex = schedule.length - 1;
    const pick = uniqSorted([0, 11, 23, 35, lastIndex]).filter(i => i >= 0 && i <= lastIndex);

    for (let i = 0; i < pick.length; i++) {
      const row = schedule[pick[i]];
      const isFinal = pick[i] === lastIndex;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${checkpointLabel(row.month, isFinal)}</td>
        <td>${currency(row.payment)}</td>
        <td>${currency(row.interest)}</td>
        <td>${currency(row.balance)}</td>
      `;
      scheduleBody.appendChild(tr);
    }

    if (scheduleMeta) {
      scheduleMeta.textContent = pick.length + " checkpoints • Final month " + schedule[schedule.length - 1].month;
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    const balance = parseFloat(balanceInput.value);
    const apr = parseFloat(aprInput.value);
    const payment = parseFloat(paymentInput.value);
    const extra = parseFloat(extraInput.value || 0);

    if (!balance || !apr || !payment) {
      formMessage.textContent = "Please complete all required fields.";
      setResultsState("empty");
      return;
    }

    if (payment <= balance * (apr / 100 / 12)) {
      formMessage.textContent = "Monthly payment is too low to reduce the balance.";
      setResultsState("empty");
      return;
    }

    formMessage.textContent = "";

    const base = calculate(balance, apr, payment, 0);
    const withExtra = calculate(balance, apr, payment, extra);

    kpiTime.textContent = monthsToYearsMonths(withExtra.months);
    kpiTimeMeta.textContent = withExtra.months + " months";

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + withExtra.months);
    kpiDate.textContent = payoffDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    kpiInterest.textContent = currency(withExtra.totalInterest);
    kpiSaved.textContent = currency(base.totalInterest - withExtra.totalInterest);

    renderMiniSchedule(withExtra.schedule);

    setResultsState("ready");

    openDesktopOnce();

    if (window.innerWidth < 920) {
      const rc = document.querySelector(".results-card");
      if (rc) rc.scrollIntoView({ behavior: "smooth" });
    }

    if (persistToggle && persistToggle.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance, apr, payment, extra
      }));
    }

    if (window.Affiliate && affiliateSlot) {
      window.Affiliate.render({
        slot: affiliateSlot,
        context: {
          balance,
          apr,
          payment,
          extra,
          months: withExtra.months,
          totalInterest: withExtra.totalInterest,
          interestSaved: base.totalInterest - withExtra.totalInterest
        }
      });
    }
  }

  function handleReset() {
    form.reset();
    scheduleBody.innerHTML = "";
    if (scheduleMeta) scheduleMeta.textContent = "—";
    formMessage.textContent = "";
    setResultsState("empty");
    localStorage.removeItem(STORAGE_KEY);

    if (window.Affiliate && affiliateSlot) {
      window.Affiliate.clear(affiliateSlot);
    }
  }

  function loadInputs() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      balanceInput.value = data.balance || "";
      aprInput.value = data.apr || "";
      paymentInput.value = data.payment || "";
      extraInput.value = data.extra || "";
      if (persistToggle) persistToggle.checked = true;
    } catch {}
  }

  loadInputs();
  setResultsState("empty");

  if (scheduleMeta) scheduleMeta.textContent = "—";

  if (isDesktop()) {
    setDesktopCollapsed(true);
  }

  form.addEventListener("submit", handleSubmit);
  resetBtn.addEventListener("click", handleReset);

  window.addEventListener("resize", () => {
    if (!isDesktop()) return;
    if (openedOnceDesktop) {
      setDesktopCollapsed(false);
      return;
    }
    setDesktopCollapsed(true);
  });

})();