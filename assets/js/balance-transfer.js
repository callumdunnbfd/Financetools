(function () {

  const form = document.getElementById("btForm");
  const resetBtn = document.getElementById("resetBtn");
  const persistToggle = document.getElementById("persistToggle");

  const balanceInput = document.getElementById("balance");
  const currentAprInput = document.getElementById("currentApr");
  const currentPaymentInput = document.getElementById("currentPayment");

  const promoMonthsInput = document.getElementById("promoMonths");
  const transferFeeInput = document.getElementById("transferFee");
  const postAprInput = document.getElementById("postApr");
  const transferPaymentInput = document.getElementById("transferPayment");

  const resultsShell = document.getElementById("resultsShell");
  const resultsCard = document.getElementById("resultsCard");

  const kpiSavings = document.getElementById("kpiInterestSaved");
  const kpiSavingsMeta = document.getElementById("kpiInterestMeta");
  const kpiFee = document.getElementById("kpiTimeChange");
  const kpiFeeMeta = document.getElementById("kpiTimeMeta");
  const kpiPayoff = document.getElementById("kpiPaymentChange");
  const kpiPayoffMeta = document.getElementById("kpiPaymentMeta");
  const kpiInterest = document.getElementById("kpiPayoffChange");
  const kpiInterestMeta = document.getElementById("kpiPayoffMeta");

  const callout = document.getElementById("resultsCallout");
  const calloutTitle = document.getElementById("calloutTitle");
  const calloutBody = document.getElementById("calloutBody");

  const curSummary = document.getElementById("curSummary");
  const loanSummary = document.getElementById("loanSummary");
  const feeSummary = document.getElementById("feeSummary");

  const formMessage = document.getElementById("formMessage");
  const affiliateSlot = document.getElementById("affiliateSlot");

  const STORAGE_KEY = "balance_transfer_inputs_v1";

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

  function simulateRevolving(balance, aprPercent, monthlyPayment, interestFreeMonths) {
    const r = monthlyRateFromApr(aprPercent);
    let remaining = balance;
    let month = 0;
    let totalInterest = 0;
    const cap = 1200;

    while (remaining > 0 && month < cap) {
      month++;

      const promo = interestFreeMonths && month <= interestFreeMonths;
      const interest = promo ? 0 : remaining * r;
      totalInterest += interest;

      const pay = Math.min(monthlyPayment, remaining + interest);
      remaining = remaining + interest - pay;
      if (remaining < 0) remaining = 0;

      if (!promo && monthlyPayment <= remaining * r && month >= 2) {
        break;
      }
    }

    return { months: month, totalInterest, remaining };
  }

  function setCallout(title, body) {
    if (!callout || !calloutTitle || !calloutBody) return;
    calloutTitle.textContent = title || "";
    calloutBody.textContent = body || "";
    callout.hidden = !(title || body);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const balance = parseFloat(balanceInput.value);
    const currentApr = parseFloat(currentAprInput.value);
    const currentPayment = parseFloat(currentPaymentInput.value);

    const promoMonthsParsed = parseFloat(promoMonthsInput.value);
    const promoMonths = Number.isFinite(promoMonthsParsed) ? Math.round(promoMonthsParsed) : 0;

    const transferFeePct = parseFloat(transferFeeInput.value);
    const postApr = parseFloat(postAprInput.value);

    const transferPaymentRaw = parseFloat(transferPaymentInput.value);
    const transferPayment = Number.isFinite(transferPaymentRaw) && transferPaymentRaw > 0 ? transferPaymentRaw : currentPayment;

    if (!balance || !Number.isFinite(currentApr) || !currentPayment || !Number.isFinite(transferFeePct) || !Number.isFinite(postApr)) {
      formMessage.textContent = "Please complete all required fields.";
      setResultsState("empty");
      return;
    }

    if (balance <= 0 || currentPayment <= 0 || transferPayment <= 0 || currentApr < 0 || postApr < 0 || promoMonths < 0 || transferFeePct < 0) {
      formMessage.textContent = "Please enter valid values.";
      setResultsState("empty");
      return;
    }

    if (promoMonths > 120) {
      formMessage.textContent = "Please enter a realistic 0% period length.";
      setResultsState("empty");
      return;
    }

    const firstMonthInterestCurrent = balance * monthlyRateFromApr(currentApr);
    if (currentApr > 0 && currentPayment <= firstMonthInterestCurrent) {
      formMessage.textContent = "Your current monthly payment is too low to reduce the balance after interest.";
      setResultsState("empty");
      return;
    }

    const feeCost = balance * (transferFeePct / 100);
    const transferStartBalance = balance + Math.max(0, feeCost);

    const current = simulateRevolving(balance, currentApr, currentPayment, 0);
    if (current.remaining > 0) {
      formMessage.textContent = "Unable to estimate payoff with the current scenario inputs.";
      setResultsState("empty");
      return;
    }

    if (promoMonths === 0 && postApr > 0) {
      const firstMonthInterestTransfer = transferStartBalance * monthlyRateFromApr(postApr);
      if (transferPayment <= firstMonthInterestTransfer) {
        formMessage.textContent = "Your transfer monthly payment is too low to reduce the balance after interest.";
        setResultsState("empty");
        return;
      }
    } else if (promoMonths > 0 && postApr > 0) {
      let approxBalanceAfterPromo = transferStartBalance;
      const r = monthlyRateFromApr(postApr);
      for (let i = 0; i < promoMonths; i++) {
        const pay = Math.min(transferPayment, approxBalanceAfterPromo);
        approxBalanceAfterPromo = approxBalanceAfterPromo - pay;
        if (approxBalanceAfterPromo <= 0) {
          approxBalanceAfterPromo = 0;
          break;
        }
      }
      if (approxBalanceAfterPromo > 0) {
        const firstMonthInterestPost = approxBalanceAfterPromo * r;
        if (transferPayment <= firstMonthInterestPost) {
          formMessage.textContent = "Your transfer monthly payment is too low to reduce the balance once the post-promo APR applies.";
          setResultsState("empty");
          return;
        }
      }
    }

    const transfer = simulateRevolving(transferStartBalance, postApr, transferPayment, promoMonths);
    if (transfer.remaining > 0) {
      formMessage.textContent = "Your transfer monthly payment may be too low to clear the balance (especially after the 0% period ends). Increase the payment or adjust the APRs.";
      setResultsState("empty");
      return;
    }

    formMessage.textContent = "";

    const stayTotalCost = balance + current.totalInterest;
    const transferTotalCost = transferStartBalance + transfer.totalInterest;
    const savings = stayTotalCost - transferTotalCost;

    const payoffStayLabel = payoffMonthLabel(current.months);
    const payoffTransferLabel = payoffMonthLabel(transfer.months);

    kpiSavings.textContent = currency0(Math.abs(savings));
    kpiSavingsMeta.textContent = savings >= 0 ? "Lower total cost" : "Higher total cost";

    kpiFee.textContent = currency0(feeCost);
    kpiFeeMeta.textContent = transferFeePct.toFixed(2) + "% of balance";

    kpiPayoff.textContent = monthsToYearsMonths(current.months) + " vs " + monthsToYearsMonths(transfer.months);
    kpiPayoffMeta.textContent = payoffStayLabel + " vs " + payoffTransferLabel;

    const interestDiff = current.totalInterest - transfer.totalInterest;
    kpiInterest.textContent = currency0(Math.abs(interestDiff));
    kpiInterestMeta.textContent = interestDiff >= 0 ? "Lower interest with transfer" : "Higher interest with transfer";

    const promoClears = promoMonths > 0 && transfer.months <= promoMonths;
    if (savings > 0 && promoClears) {
      setCallout("Potential savings", "Based on your inputs, the transfer clears within the 0% period. Your main cost is the transfer fee. Confirm the offer terms and fee before applying.");
    } else if (savings > 0) {
      setCallout("Potential savings", "Based on your inputs, the transfer could reduce total cost after fees. If a balance remains after the 0% period, the post-promo APR matters most.");
    } else if (savings < 0) {
      setCallout("No clear savings", "Based on your inputs, the transfer may cost more after fees and post-promo interest. Try a longer 0% period, a lower fee, or a higher transfer payment.");
    } else {
      setCallout("Similar outcome", "Based on your inputs, the two scenarios are broadly similar. Fees and the post-promo APR can make the transfer more or less favourable depending on how quickly you repay.");
    }

    curSummary.textContent = monthsToYearsMonths(current.months) + " • " + currency0(current.totalInterest) + " interest • " + currency0(stayTotalCost) + " total";
    loanSummary.textContent = monthsToYearsMonths(transfer.months) + " • " + currency0(transfer.totalInterest) + " interest • " + currency0(transferTotalCost) + " total";
    feeSummary.textContent = "Fee: " + currency0(feeCost) + " • 0%: " + promoMonths + " months • Post APR: " + postApr.toFixed(2) + "%";

    setResultsState("ready");
    openDesktopOnce();

    if (window.innerWidth < 920) {
      if (resultsCard) resultsCard.scrollIntoView({ behavior: "smooth" });
    }

    if (persistToggle && persistToggle.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance,
        currentApr,
        currentPayment,
        promoMonths: promoMonthsInput.value ? promoMonths : "",
        transferFeePct,
        postApr,
        transferPayment: Number.isFinite(transferPaymentRaw) ? transferPaymentRaw : ""
      }));
    }

    if (window.Affiliate && affiliateSlot) {
      window.Affiliate.render({
        slot: affiliateSlot,
        context: {
          balance,
          apr: currentApr,
          months: current.months,
          totalInterest: current.totalInterest,
          interestSaved: interestDiff,
          savings,
          transferFee: feeCost,
          promoMonths,
          postApr,
          transferMonths: transfer.months
        }
      });
    }
  }

  function handleReset() {
    form.reset();

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
      balanceInput.value = data.balance || "";
      currentAprInput.value = data.currentApr || "";
      currentPaymentInput.value = data.currentPayment || "";
      promoMonthsInput.value = data.promoMonths || "";
      transferFeeInput.value = data.transferFeePct || "";
      postAprInput.value = data.postApr || "";
      transferPaymentInput.value = data.transferPayment || "";
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