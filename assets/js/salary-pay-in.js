(() => {
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const moneyINR = (n) => {
    if (!isFinite(n)) return "–";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  };

  const pct = (n) => {
    if (!isFinite(n)) return "–";
    return `${(n * 100).toFixed(1)}%`;
  };

  const periodsPerYear = (freq) => {
    if (freq === "annual") return 1;
    if (freq === "monthly") return 12;
    if (freq === "weekly") return 52;
    if (freq === "fortnightly") return 26;
    if (freq === "fourweekly") return 13;
    return 12;
  };

  const el = (id) => document.getElementById(id);

  const slabsNew = [
    { upTo: 400000, rate: 0.00 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.10 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.20 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: Infinity, rate: 0.30 }
  ];

  const slabsOld_lt60 = [
    { upTo: 250000, rate: 0.00 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: Infinity, rate: 0.30 }
  ];

  const slabsOld_60to79 = [
    { upTo: 300000, rate: 0.00 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: Infinity, rate: 0.30 }
  ];

  const slabsOld_80plus = [
    { upTo: 500000, rate: 0.00 },
    { upTo: 1000000, rate: 0.20 },
    { upTo: Infinity, rate: 0.30 }
  ];

  const taxFromSlabs = (taxableIncome, slabs) => {
    let t = 0;
    let prev = 0;
    const income = Math.max(0, taxableIncome);

    for (const s of slabs) {
      const upper = s.upTo;
      const chunk = Math.min(income, upper) - prev;
      if (chunk > 0) t += chunk * s.rate;
      prev = upper;
      if (income <= upper) break;
    }

    return t;
  };

  const surchargeRate = (totalIncome) => {
    const x = Math.max(0, totalIncome);
    if (x > 50000000) return 0.37;
    if (x > 20000000) return 0.25;
    if (x > 10000000) return 0.15;
    if (x > 5000000) return 0.10;
    return 0.0;
  };

  const computeIndia = (inputs) => {
    const gross = Math.max(0, inputs.grossAnnual);
    const otherIncome = Math.max(0, inputs.otherIncome);
    const totalIncome = gross + otherIncome;

    const regime = inputs.regime;
    const ageGroup = inputs.ageGroup;

    const stdDedNew = 75000;
    const stdDedOld = 50000;

    const standardDeduction = regime === "new" ? stdDedNew : stdDedOld;

    const pt = Math.max(0, inputs.professionalTax);

    const ded80C = Math.max(0, inputs.ded80C);
    const ded80D = Math.max(0, inputs.ded80D);
    const ded80CCD1B = Math.max(0, inputs.ded80CCD1B);

    let allowedDeductions = 0;
    if (regime === "old") {
      allowedDeductions += clamp(ded80C, 0, 150000);
      allowedDeductions += ded80D;
      allowedDeductions += clamp(ded80CCD1B, 0, 50000);
      allowedDeductions += pt;
    } else {
      allowedDeductions += 0;
    }

    const taxableIncome = Math.max(0, totalIncome - standardDeduction - allowedDeductions);

    let slabs;
    if (regime === "new") {
      slabs = slabsNew;
    } else {
      if (ageGroup === "80plus") slabs = slabsOld_80plus;
      else if (ageGroup === "60to79") slabs = slabsOld_60to79;
      else slabs = slabsOld_lt60;
    }

    const incomeTax = taxFromSlabs(taxableIncome, slabs);

    const applySurcharge = inputs.includeSurcharge === "yes";
    let sur = 0;
    if (applySurcharge) {
      sur = incomeTax * surchargeRate(taxableIncome);
    }

    const cessRate = 0.04;
    const cess = (incomeTax + sur) * cessRate;

    const totalTax = incomeTax + sur + cess;

    const netAnnual = Math.max(0, gross - totalTax - pt);
    const deductionsAnnual = Math.max(0, gross - netAnnual);

    return {
      gross,
      taxableIncome,
      incomeTax,
      surcharge: sur,
      cess,
      professionalTax: pt,
      totalTax,
      netAnnual,
      deductionsAnnual
    };
  };

  const refs = {
    form: el("salaryForm"),
    btnReset: el("btnReset"),
    btnExample: el("btnExample"),
    resultTop: el("resultTop"),
    takeHomeMain: el("takeHomeMain"),
    takeHomeSub: el("takeHomeSub"),
    deductMain: el("deductMain"),
    deductSub: el("deductSub"),
    effectiveMain: el("effectiveMain"),
    effectiveSub: el("effectiveSub"),
    pGross: el("pGross"),
    pTax: el("pTax"),
    pSur: el("pSur"),
    pCess: el("pCess"),
    pPT: el("pPT"),
    pNet: el("pNet"),
    aGross: el("aGross"),
    aTax: el("aTax"),
    aSur: el("aSur"),
    aCess: el("aCess"),
    aPT: el("aPT"),
    aNet: el("aNet")
  };

  const readInputs = () => ({
    grossAnnual: parseFloat(el("grossAnnual").value),
    frequency: el("frequency").value,
    regime: el("regime").value,
    ageGroup: el("ageGroup").value,
    includeSurcharge: el("includeSurcharge").value,
    ded80C: parseFloat(el("ded80C").value),
    ded80D: parseFloat(el("ded80D").value),
    ded80CCD1B: parseFloat(el("ded80CCD1B").value),
    professionalTax: parseFloat(el("professionalTax").value),
    otherIncome: parseFloat(el("otherIncome").value)
  });

  const setExample = () => {
    el("grossAnnual").value = 1200000;
    el("frequency").value = "monthly";
    el("regime").value = "new";
    el("ageGroup").value = "lt60";
    el("includeSurcharge").value = "no";
    el("ded80C").value = 0;
    el("ded80D").value = 0;
    el("ded80CCD1B").value = 0;
    el("professionalTax").value = 0;
    el("otherIncome").value = 0;
  };

  const clearUI = () => {
    refs.resultTop.textContent = "Enter your salary and press Calculate.";
    [
      "takeHomeMain","takeHomeSub","deductMain","deductSub","effectiveMain","effectiveSub",
      "pGross","pTax","pSur","pCess","pPT","pNet",
      "aGross","aTax","aSur","aCess","aPT","aNet"
    ].forEach((k) => {
      if (refs[k]) refs[k].textContent = "–";
    });
  };

  const render = (inputs) => {
    if (!isFinite(inputs.grossAnnual) || inputs.grossAnnual < 0) {
      refs.resultTop.textContent = "Please enter a valid gross annual salary.";
      return;
    }

    const out = computeIndia(inputs);
    const ppy = periodsPerYear(inputs.frequency);
    const per = (x) => x / ppy;

    const effRate = out.gross > 0 ? out.deductionsAnnual / out.gross : 0;
    const netRate = out.gross > 0 ? out.netAnnual / out.gross : 0;

    refs.resultTop.textContent = `Estimated net pay is ${moneyINR(per(out.netAnnual))} (${inputs.frequency}).`;

    refs.takeHomeMain.textContent = moneyINR(per(out.netAnnual));
    refs.takeHomeSub.textContent = `${moneyINR(out.netAnnual)} per year`;

    refs.deductMain.textContent = moneyINR(per(out.deductionsAnnual));
    refs.deductSub.textContent = `${moneyINR(out.deductionsAnnual)} per year`;

    refs.effectiveMain.textContent = pct(effRate);
    refs.effectiveSub.textContent = `Net is ${pct(netRate)} of gross`;

    refs.pGross.textContent = moneyINR(per(out.gross));
    refs.pTax.textContent = moneyINR(per(out.incomeTax));
    refs.pSur.textContent = moneyINR(per(out.surcharge));
    refs.pCess.textContent = moneyINR(per(out.cess));
    refs.pPT.textContent = moneyINR(per(out.professionalTax));
    refs.pNet.textContent = moneyINR(per(out.netAnnual));

    refs.aGross.textContent = moneyINR(out.gross);
    refs.aTax.textContent = moneyINR(out.incomeTax);
    refs.aSur.textContent = moneyINR(out.surcharge);
    refs.aCess.textContent = moneyINR(out.cess);
    refs.aPT.textContent = moneyINR(out.professionalTax);
    refs.aNet.textContent = moneyINR(out.netAnnual);
  };

  refs.form.addEventListener("submit", (e) => {
    e.preventDefault();
    render(readInputs());
  });

  refs.btnReset.addEventListener("click", () => {
    refs.form.reset();
    el("regime").value = "new";
    el("ageGroup").value = "lt60";
    el("includeSurcharge").value = "no";
    el("ded80C").value = 0;
    el("ded80D").value = 0;
    el("ded80CCD1B").value = 0;
    el("professionalTax").value = 0;
    el("otherIncome").value = 0;
    clearUI();
  });

  refs.btnExample.addEventListener("click", () => {
    setExample();
    render(readInputs());
  });

  clearUI();
})();