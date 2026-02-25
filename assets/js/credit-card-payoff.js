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
  const formMessage = document.getElementById("formMessage");

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
      const principal = totalPayment - interest;

      remaining = remaining + interest - totalPayment;
      if (remaining < 0) remaining = 0;

      schedule.push({
        month,
        payment: totalPayment,
        interest,
        principal,
        balance: remaining
      });
    }

    return {
      months: month,
      totalInterest,
      schedule
    };
  }

  function renderSchedule(schedule) {
    scheduleBody.innerHTML = "";
    schedule.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.month}</td>
        <td>${currency(row.payment)}</td>
        <td>${currency(row.interest)}</td>
        <td>${currency(row.principal)}</td>
        <td>${currency(row.balance)}</td>
      `;
      scheduleBody.appendChild(tr);
    });
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

    renderSchedule(withExtra.schedule);

    setResultsState("ready");

    openDesktopOnce();

    if (window.innerWidth < 920) {
      document.querySelector(".results-card").scrollIntoView({ behavior: "smooth" });
    }

    if (persistToggle.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance, apr, payment, extra
      }));
    }
  }

  function handleReset() {
    form.reset();
    scheduleBody.innerHTML = "";
    formMessage.textContent = "";
    setResultsState("empty");
    localStorage.removeItem(STORAGE_KEY);
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
      persistToggle.checked = true;
    } catch {}
  }

  loadInputs();
  setResultsState("empty");

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