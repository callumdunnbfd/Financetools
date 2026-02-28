(function () {

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function monthlyRate(apr) {
    const a = Number(apr);
    if (!Number.isFinite(a) || a <= 0) return 0;
    return a / 100 / 12;
  }

  function monthlyPayment(principal, apr, months) {
    const p = Number(principal);
    const n = Math.floor(Number(months));
    if (!Number.isFinite(p) || p <= 0) return 0;
    if (!Number.isFinite(n) || n <= 0) return 0;

    const r = monthlyRate(apr);
    if (r === 0) return round2(p / n);

    const pow = Math.pow(1 + r, -n);
    const pay = p * r / (1 - pow);
    return round2(pay);
  }

  function amortise(params) {
    const loanAmount = Number(params && params.loanAmount);
    const fee = Number((params && params.fee) || 0);
    const apr = Number(params && params.apr);
    const termMonths = Math.floor(Number(params && params.termMonths));
    const overpay = Number((params && params.overpay) || 0);

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) return null;
    if (!Number.isFinite(apr) || apr < 0) return null;
    if (!Number.isFinite(termMonths) || termMonths <= 0) return null;

    const financedFee = Number.isFinite(fee) && fee > 0 ? fee : 0;
    const principal0 = loanAmount + financedFee;

    const basePayment = monthlyPayment(principal0, apr, termMonths);
    const r = monthlyRate(apr);

    let balance = principal0;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    const schedule = [];

    const extra = Number.isFinite(overpay) && overpay > 0 ? overpay : 0;

    while (balance > 0.005 && month < 1200) {
      month++;

      const interest = r === 0 ? 0 : balance * r;
      let payment = basePayment;
      let principalPart = payment - interest;
      if (principalPart < 0) principalPart = 0;

      let totalThisMonth = payment + extra;
      const maxPay = balance + interest;
      if (totalThisMonth > maxPay) totalThisMonth = maxPay;

      const extraUsed = Math.max(0, totalThisMonth - payment);
      const principalPaid = Math.max(0, totalThisMonth - interest);

      balance = balance + interest - totalThisMonth;
      if (balance < 0) balance = 0;

      totalInterest += interest;
      totalPaid += totalThisMonth;

      schedule.push({
        month,
        payment: round2(payment),
        interest: round2(interest),
        principal: round2(principalPaid - extraUsed),
        overpay: round2(extraUsed),
        total: round2(totalThisMonth),
        balance: round2(balance)
      });

      if (month >= termMonths && extra === 0) {
        if (balance <= 0.01) break;
        const maxExtraLoops = 240;
        if (month > termMonths + maxExtraLoops) break;
      }
    }

    return {
      loanAmount: round2(loanAmount),
      fee: round2(financedFee),
      principal: round2(principal0),
      apr: round2(apr),
      termMonths,
      monthlyPayment: round2(basePayment),
      overpay: round2(extra),
      monthsActual: month,
      totalInterest: round2(totalInterest),
      totalPaid: round2(totalPaid),
      schedule
    };
  }

  window.Amortisation = {
    monthlyPayment,
    amortise
  };

})();