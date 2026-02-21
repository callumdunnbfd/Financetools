(() => {
  const money = (n) => {
    if (!isFinite(n)) return "–";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
  };

  const pct = (n) => {
    if (!isFinite(n)) return "–";
    return `${(n * 100).toFixed(1)}%`;
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const periodsPerYear = (freq) => {
    if (freq === "annual") return 1;
    if (freq === "monthly") return 12;
    if (freq === "weekly") return 52;
    if (freq === "fortnightly") return 26;
    if (freq === "fourweekly") return 13;
    return 12;
  };

  const parseTaxCodeAllowance = (taxCode) => {
    const raw = String(taxCode || "").trim().toUpperCase();
    const m = raw.match(/^(\d{1,5})/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!isFinite(n) || n < 0) return null;
    return n * 10;
  };

  const personalAllowanceWithTaper = (baseAllowance, totalIncomeForTaper) => {
    const limit = 100000;
    const taperEnd = 125140;
    if (totalIncomeForTaper <= limit) return baseAllowance;
    if (totalIncomeForTaper >= taperEnd) return 0;
    const reduction = (totalIncomeForTaper - limit) / 2;
    return Math.max(0, baseAllowance - reduction);
  };

  const taxAnnual_rUK = (taxable) => {
    const basicBand = 37700;
    const higherBandTopTaxable = 125140;

    let remaining = Math.max(0, taxable);
    let tax = 0;

    const basic = Math.min(remaining, basicBand);
    tax += basic * 0.20;
    remaining -= basic;

    if (remaining <= 0) return tax;

    const higherBandSize = Math.max(0, higherBandTopTaxable - basicBand);
    const higher = Math.min(remaining, higherBandSize);
    tax += higher * 0.40;
    remaining -= higher;

    if (remaining <= 0) return tax;

    tax += remaining * 0.45;
    return tax;
  };

  const taxAnnual_scotland = (taxable) => {
    const bands = [
      { size: 2827, rate: 0.19 },
      { size: 14921 - 2827, rate: 0.20 },
      { size: 31092 - 14921, rate: 0.21 },
      { size: 62430 - 31092, rate: 0.42 },
      { size: 125140 - 62430, rate: 0.45 }
    ];
    const topRate = 0.48;

    let remaining = Math.max(0, taxable);
    let tax = 0;

    for (const b of bands) {
      if (remaining <= 0) break;
      const chunk = Math.min(remaining, b.size);
      tax += chunk * b.rate;
      remaining -= chunk;
    }

    if (remaining > 0) tax += remaining * topRate;
    return tax;
  };

  const niAnnual_categoryA = (annualEarnings) => {
    const PT = 12570;
    const UEL = 50270;
    const mainRate = 0.08;
    const addRate = 0.02;

    if (annualEarnings <= PT) return 0;

    const mainSlice = Math.min(annualEarnings, UEL) - PT;
    const above = Math.max(0, annualEarnings - UEL);

    return Math.max(0, mainSlice) * mainRate + above * addRate;
  };

  const studentLoanAnnual = (incomeAnnual, plan, postgrad) => {
    const planThresholds = {
      none: { thr: Infinity, rate: 0 },
      plan1: { thr: 26065, rate: 0.09 },
      plan2: { thr: 28470, rate: 0.09 },
      plan4: { thr: 32745, rate: 0.09 },
      plan5: { thr: 25000, rate: 0.09 }
    };

    const pg = { thr: 21000, rate: 0.06 };

    let sl = 0;

    const p = planThresholds[plan] || planThresholds.none;
    if (p.rate > 0 && isFinite(p.thr)) sl += Math.max(0, incomeAnnual - p.thr) * p.rate;

    if (postgrad) sl += Math.max(0, incomeAnnual - pg.thr) * pg.rate;

    return sl;
  };

  const pensionAnnual = (grossAnnual, percent, type) => {
    const p = clamp(percent || 0, 0, 60) / 100;
    if (!p || type === "none") return 0;
    return grossAnnual * p;
  };

  const compute = (inputs) => {
    const gross = Math.max(0, inputs.grossAnnual);
    const otherIncome = Math.max(0, inputs.otherIncome);

    const pen = pensionAnnual(gross, inputs.pensionPercent, inputs.pensionType);

    const pensionBeforeTax = (inputs.pensionType === "before_tax" || inputs.pensionType === "salary_sacrifice") ? pen : 0;
    const pensionAfterTax = (inputs.pensionType === "after_tax") ? pen : 0;

    const taxablePayBase = Math.max(0, gross - pensionBeforeTax);
    const totalIncomeForTaper = taxablePayBase + otherIncome;

    const parsedAllowance = parseTaxCodeAllowance(inputs.taxCode);
    const baseAllowance = parsedAllowance === null ? 12570 : parsedAllowance;

    const allowance = personalAllowanceWithTaper(baseAllowance, totalIncomeForTaper);
    const taxable = Math.max(0, taxablePayBase - allowance);

    const taxAnnual = inputs.region === "scotland" ? taxAnnual_scotland(taxable) : taxAnnual_rUK(taxable);

    const niBase = inputs.pensionType === "salary_sacrifice" ? taxablePayBase : gross;
    const niAnnual = niAnnual_categoryA(niBase);

    const slBase = taxablePayBase;
    const slAnnual = studentLoanAnnual(slBase, inputs.studentPlan, inputs.postgrad);

    const netAnnual = gross - taxAnnual - niAnnual - slAnnual - pensionAfterTax - pensionBeforeTax;
    const deductionsAnnual = gross - netAnnual;

    return {
      gross,
      taxAnnual,
      niAnnual,
      slAnnual,
      pensionAnnual: pen,
      netAnnual,
      deductionsAnnual
    };
  };

  const el = (id) => document.getElementById(id);

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
    pNI: el("pNI"),
    pSL: el("pSL"),
    pPen: el("pPen"),
    pNet: el("pNet"),
    aGross: el("aGross"),
    aTax: el("aTax"),
    aNI: el("aNI"),
    aSL: el("aSL"),
    aPen: el("aPen"),
    aNet: el("aNet")
  };

  const readInputs = () => ({
    grossAnnual: parseFloat(el("grossAnnual").value),
    frequency: el("frequency").value,
    region: el("region").value,
    taxCode: el("taxCode").value,
    otherIncome: parseFloat(el("otherIncome").value),
    pensionPercent: parseFloat(el("pensionPercent").value),
    pensionType: el("pensionType").value,
    studentPlan: el("studentPlan").value,
    postgrad: el("postgrad").checked
  });

  const setExample = () => {
    el("grossAnnual").value = 35000;
    el("frequency").value = "monthly";
    el("region").value = "rUK";
    el("taxCode").value = "1257L";
    el("otherIncome").value = 0;
    el("pensionPercent").value = 5;
    el("pensionType").value = "before_tax";
    el("studentPlan").value = "none";
    el("postgrad").checked = false;
  };

  const clearUI = () => {
    refs.resultTop.textContent = "Enter your salary and press Calculate.";
    [
      "takeHomeMain","takeHomeSub","deductMain","deductSub","effectiveMain","effectiveSub",
      "pGross","pTax","pNI","pSL","pPen","pNet",
      "aGross","aTax","aNI","aSL","aPen","aNet"
    ].forEach((k) => {
      if (refs[k]) refs[k].textContent = "–";
    });
  };

  const render = (inputs) => {
    if (!isFinite(inputs.grossAnnual) || inputs.grossAnnual < 0) {
      refs.resultTop.textContent = "Please enter a valid gross annual salary.";
      return;
    }

    const out = compute(inputs);
    const ppy = periodsPerYear(inputs.frequency);
    const per = (x) => x / ppy;

    const effRate = out.gross > 0 ? out.deductionsAnnual / out.gross : 0;
    const netRate = out.gross > 0 ? out.netAnnual / out.gross : 0;

    refs.resultTop.textContent = `Estimated net pay is ${money(per(out.netAnnual))} (${inputs.frequency}).`;

    refs.takeHomeMain.textContent = money(per(out.netAnnual));
    refs.takeHomeSub.textContent = `${money(out.netAnnual)} per year`;

    refs.deductMain.textContent = money(per(out.deductionsAnnual));
    refs.deductSub.textContent = `${money(out.deductionsAnnual)} per year`;

    refs.effectiveMain.textContent = pct(effRate);
    refs.effectiveSub.textContent = `Net is ${pct(netRate)} of gross`;

    refs.pGross.textContent = money(per(out.gross));
    refs.pTax.textContent = money(per(out.taxAnnual));
    refs.pNI.textContent = money(per(out.niAnnual));
    refs.pSL.textContent = money(per(out.slAnnual));
    refs.pPen.textContent = money(per(out.pensionAnnual));
    refs.pNet.textContent = money(per(out.netAnnual));

    refs.aGross.textContent = money(out.gross);
    refs.aTax.textContent = money(out.taxAnnual);
    refs.aNI.textContent = money(out.niAnnual);
    refs.aSL.textContent = money(out.slAnnual);
    refs.aPen.textContent = money(out.pensionAnnual);
    refs.aNet.textContent = money(out.netAnnual);
  };

  refs.form.addEventListener("submit", (e) => {
    e.preventDefault();
    render(readInputs());
  });

  refs.btnReset.addEventListener("click", () => {
    refs.form.reset();
    el("taxCode").value = "1257L";
    el("otherIncome").value = 0;
    clearUI();
  });

  refs.btnExample.addEventListener("click", () => {
    setExample();
    render(readInputs());
  });

  clearUI();
})();
