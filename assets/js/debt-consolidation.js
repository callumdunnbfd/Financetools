(function () {

  const form = document.getElementById("dcForm");
  const resetBtn = document.getElementById("resetBtn");
  const persistToggle = document.getElementById("persistToggle");

  const totalDebtInput = document.getElementById("totalDebt");
  const averageAprInput = document.getElementById("averageApr");
  const monthlyPaymentInput = document.getElementById("monthlyPayment");

  const loanAprInput = document.getElementById("loanApr");
  const loanTermYearsInput = document.getElementById("loanTermYears");
  const arrangementFeeInput = document.getElementById("arrangementFee");

  const resultsShell = document.getElementById("resultsShell");
  const resultsCard = document.getElementById("resultsCard");

  const kpiInterestSaved = document.getElementById("kpiInterestSaved");
  const kpiInterestMeta = document.getElementById("kpiInterestMeta");
  const kpiTimeChange = document.getElementById("kpiTimeChange");
  const kpiTimeMeta = document.getElementById("kpiTimeMeta");
  const kpiPaymentChange = document.getElementById("kpiPaymentChange");
  const kpiPaymentMeta = document.getElementById("kpiPaymentMeta");
  const kpiPayoffChange = document.getElementById("kpiPayoffChange");
  const kpiPayoffMeta = document.getElementById("kpiPayoffMeta");

  const callout = document.getElementById("resultsCallout");
  const calloutTitle = document.getElementById("calloutTitle");
  const calloutBody = document.getElementById("calloutBody");

  const scheduleBody = document.getElementById("scheduleBody");
  const scheduleMeta = document.getElementById("scheduleMeta");
  const scheduleDetails = document.getElementById("scheduleDetails");

  const curSummary = document.getElementById("curSummary");
  const loanSummary = document.getElementById("loanSummary");
  const feeSummary = document.getElementById("feeSummary");

  const formMessage = document.getElementById("formMessage");
  const affiliateSlot = document.getElementById("affiliateSlot");

  const STORAGE_KEY = "debt_consolidation_inputs_v1";

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

  function currency(n, decimals) {
    const d = typeof decimals === "number" ? decimals : 2;
    return "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  }

  function currency0(n) {
    return "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }

  function monthsToYearsMonths(m) {
    const mm = Math.max(0, Math.round(m));
    const years = Math.floor(mm / 12);
    const months = mm % 12;
    if (years > 0) return years + " yr " + months + " mo";
    return months + " mo";
  }

  function payoffMonthLabel(monthsFromNow) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.max(0, Math.round(monthsFromNow)));
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  function monthlyRateFromApr(aprPercent) {
    return (aprPercent / 100) / 12;
  }

  function simulateCurrent(balance, aprPercent, monthlyPayment) {
    const r = monthlyRateFromApr(aprPercent);
    let remaining = balance;
    let month = 0;
    let totalInterest = 0;
    const cap = 1200;

    while (remaining > 0 && month < cap) {
      month++;
      const interest = remaining * r;
      totalInterest += interest;

      const pay = Math.min(monthlyPayment, remaining + interest);
      remaining = remaining + interest - pay;

      if (remaining < 0) remaining = 0;
    }

    return { months: month, totalInterest, remaining };
  }

  function loanPayment(principal, aprPercent, termMonths) {
    const r = monthlyRateFromApr(aprPercent);
    if (termMonths <= 0) return NaN;
    if (r === 0) return principal / termMonths;
    const pow = Math.pow(1 + r, termMonths);
    return principal * (r * pow) / (pow - 1);
  }

  function buildLoanSchedule(principal, aprPercent, termMonths, payment) {
    const r = monthlyRateFromApr(aprPercent);
    const schedule = [];
    let bal = principal;

    for (let m = 1; m <= termMonths; m++) {
      const interest = bal * r;
      let pay = payment;

      if (m === termMonths) {
        pay = bal + interest;
      }

      bal = bal + interest - pay;
      if (bal < 0) bal = 0;

      schedule.push({
        month: m,
        payment: pay,
        interest: interest,
        balance: bal
      });
    }

    return schedule;
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

  function renderLoanCheckpoints(schedule) {
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
        <td>${currency(row.payment, 2)}</td>
        <td>${currency(row.interest, 2)}</td>
        <td>${currency(row.balance, 2)}</td>
      `;
      scheduleBody.appendChild(tr);
    }

    if (scheduleMeta) {
      scheduleMeta.textContent = pick.length + " checkpoints • Final month " + schedule[schedule.length - 1].month;
    }
  }

  function setCallout(title, body) {
    if (!callout || !calloutTitle || !calloutBody) return;
    calloutTitle.textContent = title || "";
    calloutBody.textContent = body || "";
    callout.hidden = !(title || body);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const totalDebt = parseFloat(totalDebtInput.value);
    const averageApr = parseFloat(averageAprInput.value);
    const monthlyPayment = parseFloat(monthlyPaymentInput.value);

    const loanApr = parseFloat(loanAprInput.value);
    const loanTermYears = parseFloat(loanTermYearsInput.value);
    const arrangementFee = parseFloat(arrangementFeeInput.value || 0);

    if (!totalDebt || !averageApr || !monthlyPayment || !loanApr || !loanTermYears) {
      formMessage.textContent = "Please complete all required fields.";
      setResultsState("empty");
      return;
    }

    if (totalDebt <= 0 || monthlyPayment <= 0 || averageApr < 0 || loanApr < 0 || loanTermYears <= 0) {
      formMessage.textContent = "Please enter valid positive values.";
      setResultsState("empty");
      return;
    }

    const rCurrent = monthlyRateFromApr(averageApr);
    const firstMonthInterest = totalDebt * rCurrent;

    if (monthlyPayment <= firstMonthInterest) {
      formMessage.textContent = "Your current monthly payment is too low to reduce the balance after interest.";
      setResultsState("empty");
      return;
    }

    const termMonths = Math.round(loanTermYears * 12);
    if (!Number.isFinite(termMonths) || termMonths <= 0 || termMonths > 600) {
      formMessage.textContent = "Please enter a valid loan term.";
      setResultsState("empty");
      return;
    }

    formMessage.textContent = "";

    const current = simulateCurrent(totalDebt, averageApr, monthlyPayment);

    const principal = totalDebt + Math.max(0, arrangementFee);
    const paymentLoan = loanPayment(principal, loanApr, termMonths);

    if (!Number.isFinite(paymentLoan) || paymentLoan <= 0) {
      formMessage.textContent = "Unable to calculate the consolidation payment with these inputs.";
      setResultsState("empty");
      return;
    }

    const loanTotalPaid = paymentLoan * termMonths;
    const loanTotalInterest = loanTotalPaid - principal;

    const interestSaved = current.totalInterest - loanTotalInterest;
    const monthsSaved = current.months - termMonths;
    const monthlyPaymentDifference = paymentLoan - monthlyPayment;

    const payoffCurrentLabel = payoffMonthLabel(current.months);
    const payoffLoanLabel = payoffMonthLabel(termMonths);

    const payoffDeltaLabel = monthsSaved === 0 ? "Same month" : (monthsSaved > 0 ? "Earlier" : "Later");

    kpiInterestSaved.textContent = currency0(Math.abs(interestSaved));
    kpiInterestMeta.textContent = interestSaved >= 0 ? "Lower total interest" : "Higher total interest";

    kpiTimeChange.textContent = monthsToYearsMonths(Math.abs(monthsSaved));
    kpiTimeMeta.textContent = monthsSaved >= 0 ? "Debt-free sooner" : "Debt-free later";

    kpiPaymentChange.textContent = currency0(Math.abs(monthlyPaymentDifference));
    kpiPaymentMeta.textContent = monthlyPaymentDifference <= 0 ? "Lower monthly payment" : "Higher monthly payment";

    kpiPayoffChange.textContent = payoffDeltaLabel;
    kpiPayoffMeta.textContent = payoffCurrentLabel + " vs " + payoffLoanLabel;

    const loanSchedule = buildLoanSchedule(principal, loanApr, termMonths, paymentLoan);
    renderLoanCheckpoints(loanSchedule);

    curSummary.textContent = monthsToYearsMonths(current.months) + " • " + currency0(current.totalInterest) + " interest • " + currency0(monthlyPayment) + "/mo";
    loanSummary.textContent = monthsToYearsMonths(termMonths) + " • " + currency0(loanTotalInterest) + " interest • " + currency0(paymentLoan) + "/mo";
    feeSummary.textContent = arrangementFee > 0 ? "Fee added to loan: " + currency0(arrangementFee) : "No arrangement fee included";

    if (interestSaved > 0 && monthsSaved > 0) {
      setCallout("Potential savings", "Based on your inputs, consolidation could reduce total interest and bring your payoff date forward. Confirm the offered APR and fees before proceeding.");
    } else if (interestSaved > 0 && monthsSaved <= 0) {
      setCallout("Lower interest, longer time", "Your total interest may fall, but the term could keep you in debt for longer. Compare alternative terms to balance cost and monthly payment.");
    } else if (interestSaved <= 0 && monthsSaved > 0) {
      setCallout("Faster payoff, higher cost", "You may become debt-free sooner, but the consolidation scenario could cost more in total interest after fees and term effects.");
    } else {
      setCallout("No clear savings", "Based on your inputs, consolidation may not reduce your total cost. Try a shorter term or check whether a different rate is realistic for your situation.");
    }

    setResultsState("ready");
    openDesktopOnce();

    if (window.innerWidth < 920) {
      if (resultsCard) resultsCard.scrollIntoView({ behavior: "smooth" });
    }

    if (persistToggle && persistToggle.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        totalDebt,
        averageApr,
        monthlyPayment,
        loanApr,
        loanTermYears,
        arrangementFee
      }));
    }

    if (window.Affiliate && affiliateSlot) {
      window.Affiliate.render({
        slot: affiliateSlot,
        context: {
          totalDebt: totalDebt,
          averageApr: averageApr,
          interestSaved: interestSaved,
          monthsSaved: monthsSaved,
          monthlyPaymentDifference: monthlyPaymentDifference,
          totalInterest: current.totalInterest,
          apr: averageApr,
          months: current.months
        }
      });
    }
  }

  function handleReset() {
    form.reset();
    scheduleBody.innerHTML = "";
    if (scheduleMeta) scheduleMeta.textContent = "—";
    if (scheduleDetails) scheduleDetails.open = false;

    if (curSummary) curSummary.textContent = "—";
    if (loanSummary) loanSummary.textContent = "—";
    if (feeSummary) feeSummary.textContent = "—";

    setCallout("", "");
    formMessage.textContent = "";
    setResultsState("empty");
    localStorage.removeItem(STORAGE_KEY);

    if (window.Affiliate && affiliateSlot) {
      window.Affiliate.clear(affiliateSlot);
    }

    if (resultsCard) {
      resultsCard.setAttribute("data-collapsed", "true");
    }
    openedOnceDesktop = false;
  }

  function loadInputs() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      totalDebtInput.value = data.totalDebt || "";
      averageAprInput.value = data.averageApr || "";
      monthlyPaymentInput.value = data.monthlyPayment || "";
      loanAprInput.value = data.loanApr || "";
      loanTermYearsInput.value = data.loanTermYears || "";
      arrangementFeeInput.value = data.arrangementFee || "";
      if (persistToggle) persistToggle.checked = true;
    } catch {}
  }

  loadInputs();

  if (form) form.addEventListener("submit", handleSubmit);
  if (resetBtn) resetBtn.addEventListener("click", handleReset);

  window.addEventListener("resize", function () {
    if (!resultsCard) return;
    if (!isDesktop()) {
      resultsCard.removeAttribute("data-collapsed");
      return;
    }
    const hasResults = resultsShell && resultsShell.dataset && resultsShell.dataset.state === "ready";
    if (!hasResults) {
      resultsCard.setAttribute("data-collapsed", "true");
      openedOnceDesktop = false;
      return;
    }
    if (!openedOnceDesktop) {
      resultsCard.setAttribute("data-collapsed", "true");
    }
  });

})();