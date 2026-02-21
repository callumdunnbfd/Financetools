(function () {
  const form = document.getElementById('mortgageForm');

  const currencyEl = document.getElementById('currency');
  const propertyPriceEl = document.getElementById('propertyPrice');
  const termYearsEl = document.getElementById('termYears');

  const depositModeEl = document.getElementById('depositMode');
  const depositValueEl = document.getElementById('depositValue');
  const depositHintEl = document.getElementById('depositHint');

  const loanAmountEl = document.getElementById('loanAmount');
  const startDateEl = document.getElementById('startDate');

  const introRateEl = document.getElementById('introRate');
  const introYearsEl = document.getElementById('introYears');
  const followRateEl = document.getElementById('followRate');

  const arrangementFeeEl = document.getElementById('arrangementFee');
  const feeModeEl = document.getElementById('feeMode');
  const otherUpfrontFeesEl = document.getElementById('otherUpfrontFees');

  const monthlyOverpayEl = document.getElementById('monthlyOverpay');
  const overpayStartMonthEl = document.getElementById('overpayStartMonth');
  const overpayEndMonthEl = document.getElementById('overpayEndMonth');

  const lumpSumAmountEl = document.getElementById('lumpSumAmount');
  const lumpSumMonthEl = document.getElementById('lumpSumMonth');

  const resetBtn = document.getElementById('resetBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');

  const errEl = document.getElementById('formError');

  const paymentIntroValueEl = document.getElementById('paymentIntroValue');
  const paymentFollowValueEl = document.getElementById('paymentFollowValue');
  const totalInterestValueEl = document.getElementById('totalInterestValue');
  const totalPaidValueEl = document.getElementById('totalPaidValue');
  const payoffTimeValueEl = document.getElementById('payoffTimeValue');
  const savingsValueEl = document.getElementById('savingsValue');
  const upfrontFeesValueEl = document.getElementById('upfrontFeesValue');
  const loanShownValueEl = document.getElementById('loanShownValue');

  const toggleScheduleBtn = document.getElementById('toggleScheduleBtn');

  const scheduleWrap = document.getElementById('scheduleWrap');
  const scheduleBody = document.getElementById('scheduleBody');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');

  let lastResult = null;

  function parseNumber(value) {
    if (typeof value !== 'string') return NaN;
    const cleaned = value.replace(/[,£$€ ]/g, '').trim();
    if (!cleaned) return NaN;
    return Number(cleaned);
  }

  function currencyFormat(code) {
    const c = (code || 'GBP').toUpperCase();
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: c });
  }

  function formatMoney(code, amount) {
    if (!isFinite(amount)) return '—';
    return currencyFormat(code).format(amount);
  }

  function formatPct(x) {
    if (!isFinite(x)) return '—';
    return `${x.toFixed(2)}%`;
  }

  function monthsToYearsMonths(totalMonths) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const yPart = years === 1 ? '1 year' : `${years} years`;
    const mPart = months === 1 ? '1 month' : `${months} months`;
    if (years === 0) return mPart;
    if (months === 0) return yPart;
    return `${yPart}, ${mPart}`;
  }

  function addMonthsToDate(date, months) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }

  function fmtISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function monthlyPaymentFor(balance, annualRatePct, remainingMonths) {
    const r = (annualRatePct / 100) / 12;
    if (remainingMonths <= 0) return 0;
    if (r === 0) return balance / remainingMonths;
    const pow = Math.pow(1 + r, remainingMonths);
    return balance * (r * pow) / (pow - 1);
  }

  function buildAmortisation(input) {
    const totalMonths = Math.round(input.termYears * 12);
    const introMonths = Math.round(Math.max(0, Math.min(input.introYears, input.termYears)) * 12);

    const startDate = input.startDate ? new Date(input.startDate) : null;

    let balance = input.loanAmount;
    let month = 0;

    let totalPaid = 0;
    let totalInterest = 0;

    const rows = [];

    let currentRate = input.followRate;
    let currentPayment = monthlyPaymentFor(balance, currentRate, totalMonths);

    if (introMonths > 0) {
      currentRate = input.introRate;
      currentPayment = monthlyPaymentFor(balance, currentRate, totalMonths);
    }

    const maxMonthsSafety = 1800;

    while (balance > 0 && month < Math.min(maxMonthsSafety, totalMonths + 600)) {
      month += 1;

      if (introMonths > 0 && month === introMonths + 1) {
        const remaining = Math.max(1, totalMonths - (month - 1));
        currentRate = input.followRate;
        currentPayment = monthlyPaymentFor(balance, currentRate, remaining);
      }

      const remainingMonthsNow = Math.max(1, totalMonths - (month - 1));
      if (month === 1) {
        currentPayment = monthlyPaymentFor(balance, currentRate, remainingMonthsNow);
      }

      const r = (currentRate / 100) / 12;
      const interest = r === 0 ? 0 : balance * r;

      let scheduled = currentPayment;
      if (!isFinite(scheduled) || scheduled <= 0) {
        return { error: 'Unable to compute a valid payment from the inputs.' };
      }

      const overpayActive =
        input.monthlyOverpay > 0 &&
        month >= input.overpayStartMonth &&
        (input.overpayEndMonth === null || month <= input.overpayEndMonth);

      const overpay = overpayActive ? input.monthlyOverpay : 0;
      const lumpSum = (input.lumpSumAmount > 0 && input.lumpSumMonth === month) ? input.lumpSumAmount : 0;

      let payment = scheduled + overpay;

      const principalFromPayment = payment - interest;
      if (principalFromPayment <= 0) {
        return { error: 'Payment is not high enough to cover interest at some point. Increase payment, lower rate, or shorten term.' };
      }

      let principalApplied = principalFromPayment + lumpSum;

      if (principalApplied > balance) {
        principalApplied = balance;
        const neededPayment = interest + Math.max(0, balance - lumpSum);
        const actualPayment = Math.min(payment, neededPayment);
        payment = actualPayment;
      }

      balance = balance - principalApplied;

      totalPaid += payment + lumpSum;
      totalInterest += interest;

      let dateStr = '';
      if (startDate) {
        const rowDate = addMonthsToDate(startDate, month - 1);
        dateStr = fmtISODate(rowDate);
      }

      rows.push({
        month,
        dateStr,
        ratePct: currentRate,
        payment,
        interest,
        principal: Math.max(0, principalFromPayment),
        overpay,
        lumpSum,
        balance
      });

      if (balance <= 0.00001) {
        balance = 0;
        break;
      }
    }

    const paymentIntro = introMonths > 0
      ? monthlyPaymentFor(input.loanAmount, input.introRate, totalMonths)
      : monthlyPaymentFor(input.loanAmount, input.followRate, totalMonths);

    let paymentFollow = paymentIntro;
    if (introMonths > 0 && introMonths < totalMonths) {
      const balanceAtSwitch = rows[introMonths - 1] ? rows[introMonths - 1].balance : input.loanAmount;
      const remainingAfter = totalMonths - introMonths;
      paymentFollow = monthlyPaymentFor(balanceAtSwitch, input.followRate, remainingAfter);
    }

    return {
      rows,
      totalPaid,
      totalInterest,
      payoffMonths: rows.length,
      paymentIntro,
      paymentFollow,
      introMonths,
      totalMonths
    };
  }

  function setError(message) {
    errEl.textContent = message || '';
    errEl.style.display = message ? 'block' : 'none';
  }

  function clearResults() {
    paymentIntroValueEl.textContent = '—';
    paymentFollowValueEl.textContent = '—';
    totalInterestValueEl.textContent = '—';
    totalPaidValueEl.textContent = '—';
    payoffTimeValueEl.textContent = '—';
    savingsValueEl.textContent = '—';
    upfrontFeesValueEl.textContent = '—';
    loanShownValueEl.textContent = '—';
    scheduleBody.innerHTML = '';
    downloadCsvBtn.disabled = true;
    lastResult = null;
  }

  function renderSchedule(code, rows) {
    const maxRows = 600;
    const shown = rows.slice(0, maxRows);

    scheduleBody.innerHTML = shown.map((r) => {
      return `
        <tr>
          <td style="text-align:left">${r.month}</td>
          <td style="text-align:left">${r.dateStr || ''}</td>
          <td>${formatPct(r.ratePct)}</td>
          <td>${formatMoney(code, r.payment)}</td>
          <td>${formatMoney(code, r.interest)}</td>
          <td>${formatMoney(code, r.principal)}</td>
          <td>${formatMoney(code, r.overpay)}</td>
          <td>${formatMoney(code, r.lumpSum)}</td>
          <td>${formatMoney(code, r.balance)}</td>
        </tr>
      `;
    }).join('');

    if (rows.length > maxRows) {
      scheduleBody.insertAdjacentHTML('beforeend', `
        <tr>
          <td colspan="9" style="text-align:left">Showing first ${maxRows} months only. Download CSV for the full schedule.</td>
        </tr>
      `);
    }
  }

  function toCsv(result) {
    const lines = [];
    lines.push(['Month', 'Date', 'RatePct', 'Payment', 'Interest', 'Principal', 'Overpay', 'LumpSum', 'Balance'].join(','));
    for (const r of result.rows) {
      const line = [
        r.month,
        r.dateStr || '',
        r.ratePct.toFixed(6),
        r.payment.toFixed(2),
        r.interest.toFixed(2),
        r.principal.toFixed(2),
        r.overpay.toFixed(2),
        r.lumpSum.toFixed(2),
        r.balance.toFixed(2)
      ].join(',');
      lines.push(line);
    }
    return lines.join('\n');
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getInputsFromForm() {
    const currency = currencyEl.value || 'GBP';

    const propertyPrice = parseNumber(propertyPriceEl.value);
    const depositMode = depositModeEl.value;
    const depositValueRaw = parseNumber(depositValueEl.value);

    let baseLoanAmount = parseNumber(loanAmountEl.value);

    const termYears = parseNumber(termYearsEl.value);
    const startDate = startDateEl.value || '';

    const introRate = parseNumber(introRateEl.value);
    const introYears = parseNumber(introYearsEl.value);
    const followRate = parseNumber(followRateEl.value);

    const arrangementFee = arrangementFeeEl.value.trim() ? parseNumber(arrangementFeeEl.value) : 0;
    const feeMode = feeModeEl.value;
    const otherUpfrontFees = otherUpfrontFeesEl.value.trim() ? parseNumber(otherUpfrontFeesEl.value) : 0;

    const monthlyOverpay = monthlyOverpayEl.value.trim() ? parseNumber(monthlyOverpayEl.value) : 0;
    const overpayStartMonth = overpayStartMonthEl.value.trim() ? parseNumber(overpayStartMonthEl.value) : 1;
    const overpayEndMonth = overpayEndMonthEl.value.trim() ? parseNumber(overpayEndMonthEl.value) : null;

    const lumpSumAmount = lumpSumAmountEl.value.trim() ? parseNumber(lumpSumAmountEl.value) : 0;
    const lumpSumMonth = lumpSumMonthEl.value.trim() ? parseNumber(lumpSumMonthEl.value) : null;

    if (isFinite(propertyPrice) && propertyPrice > 0 && isFinite(depositValueRaw) && depositValueRaw >= 0) {
      let depositAmount = depositValueRaw;
      if (depositMode === 'percent') depositAmount = (depositValueRaw / 100) * propertyPrice;
      const computedLoan = propertyPrice - depositAmount;
      if (!loanAmountEl.value.trim() || !isFinite(baseLoanAmount) || baseLoanAmount <= 0) {
        baseLoanAmount = computedLoan;
      }
    }

    let loanAmount = baseLoanAmount;
    const upfrontFees = (feeMode === 'upfront' ? arrangementFee : 0) + otherUpfrontFees;
    if (feeMode === 'addToLoan') loanAmount = baseLoanAmount + arrangementFee;

    return {
      currency,
      propertyPrice,
      depositMode,
      depositValueRaw,
      baseLoanAmount,
      loanAmount,
      termYears,
      startDate,
      introRate,
      introYears: isFinite(introYears) ? introYears : 0,
      followRate,
      arrangementFee,
      feeMode,
      otherUpfrontFees,
      upfrontFees,
      monthlyOverpay,
      overpayStartMonth: isFinite(overpayStartMonth) ? Math.max(1, Math.round(overpayStartMonth)) : 1,
      overpayEndMonth: overpayEndMonth === null ? null : Math.max(1, Math.round(overpayEndMonth)),
      lumpSumAmount,
      lumpSumMonth: lumpSumMonth === null ? null : Math.max(1, Math.round(lumpSumMonth))
    };
  }

  function validateInputs(input) {
    if (!isFinite(input.baseLoanAmount) || input.baseLoanAmount <= 0) return 'Enter a valid loan amount.';
    if (!isFinite(input.termYears) || input.termYears <= 0 || input.termYears > 60) return 'Enter a valid term (1 to 60 years).';
    if (!isFinite(input.followRate) || input.followRate < 0 || input.followRate > 100) return 'Enter a valid follow-on rate (0 to 100).';

    if (input.introYears < 0 || input.introYears > input.termYears) return 'Intro period must be between 0 and the full term.';
    if (input.introYears > 0) {
      if (!isFinite(input.introRate) || input.introRate < 0 || input.introRate > 100) return 'Enter a valid intro rate (0 to 100).';
    }

    if (!isFinite(input.arrangementFee) || input.arrangementFee < 0) return 'Arrangement fee must be 0 or more.';
    if (!isFinite(input.otherUpfrontFees) || input.otherUpfrontFees < 0) return 'Other fees must be 0 or more.';

    if (!isFinite(input.monthlyOverpay) || input.monthlyOverpay < 0) return 'Monthly overpayment must be 0 or more.';
    if (!isFinite(input.overpayStartMonth) || input.overpayStartMonth < 1) return 'Overpayment start month must be 1 or more.';
    if (input.overpayEndMonth !== null && (!isFinite(input.overpayEndMonth) || input.overpayEndMonth < input.overpayStartMonth)) {
      return 'Overpayment end month must be blank or >= start month.';
    }

    if (!isFinite(input.lumpSumAmount) || input.lumpSumAmount < 0) return 'Lump sum must be 0 or more.';
    if (input.lumpSumAmount > 0 && (input.lumpSumMonth === null || !isFinite(input.lumpSumMonth) || input.lumpSumMonth < 1)) {
      return 'If you enter a lump sum, set the month it happens.';
    }

    return '';
  }

  function computeBaseline(input) {
    const baselineInput = Object.assign({}, input, {
      monthlyOverpay: 0,
      overpayStartMonth: 1,
      overpayEndMonth: null,
      lumpSumAmount: 0,
      lumpSumMonth: null
    });
    return buildAmortisation(baselineInput);
  }

  function updateDepositHint() {
    depositHintEl.textContent = depositModeEl.value === 'percent'
      ? 'Enter a percentage (e.g. 10 for 10%).'
      : 'Enter an amount (e.g. 30000).';
  }

  function autoUpdateLoanIfPossible() {
    const propertyPrice = parseNumber(propertyPriceEl.value);
    const depositMode = depositModeEl.value;
    const depositValueRaw = parseNumber(depositValueEl.value);

    if (!isFinite(propertyPrice) || propertyPrice <= 0) return;
    if (!isFinite(depositValueRaw) || depositValueRaw < 0) return;

    let depositAmount = depositValueRaw;
    if (depositMode === 'percent') depositAmount = (depositValueRaw / 100) * propertyPrice;

    const loan = propertyPrice - depositAmount;
    if (isFinite(loan) && loan > 0) {
      loanAmountEl.value = String(Math.round(loan));
    }
  }

  function saveToLocalStorage(input) {
    try {
      localStorage.setItem('toolz_mortgage_inputs', JSON.stringify(input));
    } catch (e) {
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('toolz_mortgage_inputs');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function buildShareUrl(input) {
    const url = new URL(window.location.href);
    const p = url.searchParams;

    p.set('cur', input.currency || 'GBP');
    p.set('pp', String(input.propertyPrice || ''));
    p.set('dm', input.depositMode || 'amount');
    p.set('dv', String(input.depositValueRaw || ''));
    p.set('loan', String(input.baseLoanAmount || ''));

    p.set('term', String(input.termYears || ''));
    if (input.startDate) p.set('start', input.startDate); else p.delete('start');

    p.set('ir', String(input.introRate || ''));
    p.set('iy', String(input.introYears || 0));
    p.set('fr', String(input.followRate || ''));

    p.set('af', String(input.arrangementFee || 0));
    p.set('fm', input.feeMode || 'upfront');
    p.set('of', String(input.otherUpfrontFees || 0));

    p.set('mo', String(input.monthlyOverpay || 0));
    p.set('os', String(input.overpayStartMonth || 1));
    if (input.overpayEndMonth !== null) p.set('oe', String(input.overpayEndMonth)); else p.delete('oe');

    p.set('ls', String(input.lumpSumAmount || 0));
    if (input.lumpSumMonth !== null) p.set('lm', String(input.lumpSumMonth)); else p.delete('lm');

    return url.toString();
  }

  function loadFromQueryParams() {
    const url = new URL(window.location.href);
    const p = url.searchParams;
    if (![...p.keys()].length) return null;

    const obj = {};
    obj.currency = p.get('cur') || 'GBP';

    obj.propertyPrice = p.get('pp') ? Number(p.get('pp')) : '';
    obj.depositMode = p.get('dm') || 'amount';
    obj.depositValueRaw = p.get('dv') ? Number(p.get('dv')) : '';
    obj.baseLoanAmount = p.get('loan') ? Number(p.get('loan')) : '';

    obj.termYears = p.get('term') ? Number(p.get('term')) : '';
    obj.startDate = p.get('start') || '';

    obj.introRate = p.get('ir') ? Number(p.get('ir')) : '';
    obj.introYears = p.get('iy') ? Number(p.get('iy')) : 0;
    obj.followRate = p.get('fr') ? Number(p.get('fr')) : '';

    obj.arrangementFee = p.get('af') ? Number(p.get('af')) : 0;
    obj.feeMode = p.get('fm') || 'upfront';
    obj.otherUpfrontFees = p.get('of') ? Number(p.get('of')) : 0;

    obj.monthlyOverpay = p.get('mo') ? Number(p.get('mo')) : 0;
    obj.overpayStartMonth = p.get('os') ? Number(p.get('os')) : 1;
    obj.overpayEndMonth = p.get('oe') ? Number(p.get('oe')) : null;

    obj.lumpSumAmount = p.get('ls') ? Number(p.get('ls')) : 0;
    obj.lumpSumMonth = p.get('lm') ? Number(p.get('lm')) : null;

    return obj;
  }

  function setFormFromObject(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.currency) currencyEl.value = String(obj.currency);

    if (obj.propertyPrice !== undefined) propertyPriceEl.value = String(obj.propertyPrice ?? '');
    if (obj.depositMode !== undefined) depositModeEl.value = String(obj.depositMode ?? 'amount');
    if (obj.depositValueRaw !== undefined) depositValueEl.value = String(obj.depositValueRaw ?? '');
    if (obj.baseLoanAmount !== undefined) loanAmountEl.value = String(obj.baseLoanAmount ?? '');

    if (obj.termYears !== undefined) termYearsEl.value = String(obj.termYears ?? '');
    if (obj.startDate !== undefined && obj.startDate) startDateEl.value = String(obj.startDate);

    if (obj.introRate !== undefined) introRateEl.value = String(obj.introRate ?? '');
    if (obj.introYears !== undefined) introYearsEl.value = String(obj.introYears ?? '');
    if (obj.followRate !== undefined) followRateEl.value = String(obj.followRate ?? '');

    if (obj.arrangementFee !== undefined) arrangementFeeEl.value = String(obj.arrangementFee ?? '');
    if (obj.feeMode !== undefined) feeModeEl.value = String(obj.feeMode ?? 'upfront');
    if (obj.otherUpfrontFees !== undefined) otherUpfrontFeesEl.value = String(obj.otherUpfrontFees ?? '');

    if (obj.monthlyOverpay !== undefined) monthlyOverpayEl.value = String(obj.monthlyOverpay ?? '');
    if (obj.overpayStartMonth !== undefined) overpayStartMonthEl.value = String(obj.overpayStartMonth ?? 1);
    if (obj.overpayEndMonth !== undefined && obj.overpayEndMonth !== null) overpayEndMonthEl.value = String(obj.overpayEndMonth);

    if (obj.lumpSumAmount !== undefined) lumpSumAmountEl.value = String(obj.lumpSumAmount ?? '');
    if (obj.lumpSumMonth !== undefined && obj.lumpSumMonth !== null) lumpSumMonthEl.value = String(obj.lumpSumMonth);
  }

  function initDefaults() {
    updateDepositHint();

    const fromQuery = loadFromQueryParams();
    if (fromQuery) {
      setFormFromObject(fromQuery);
      autoUpdateLoanIfPossible();
      return;
    }

    const saved = loadFromLocalStorage();
    if (saved) {
      setFormFromObject(saved);
      autoUpdateLoanIfPossible();
      return;
    }

    currencyEl.value = 'GBP';
    depositModeEl.value = 'percent';
    propertyPriceEl.value = '300000';
    depositValueEl.value = '10';
    termYearsEl.value = '25';
    introRateEl.value = '4.89';
    introYearsEl.value = '2';
    followRateEl.value = '6.25';
    overpayStartMonthEl.value = '1';
    updateDepositHint();
    autoUpdateLoanIfPossible();
  }

  function runCalculation() {
    setError('');
    clearResults();

    const input = getInputsFromForm();
    const err = validateInputs(input);
    if (err) {
      setError(err);
      return;
    }

    const result = buildAmortisation(input);
    if (result.error) {
      setError(result.error);
      return;
    }

    const baseline = computeBaseline(input);

    const code = input.currency;
    const upfrontFees = input.upfrontFees;
    const totalPaidAllIn = result.totalPaid + upfrontFees;

    paymentIntroValueEl.textContent = formatMoney(code, result.paymentIntro + (input.monthlyOverpay > 0 ? input.monthlyOverpay : 0));
    paymentFollowValueEl.textContent = (input.introYears > 0 && input.introYears < input.termYears)
      ? formatMoney(code, result.paymentFollow + (input.monthlyOverpay > 0 ? input.monthlyOverpay : 0))
      : '—';

    totalInterestValueEl.textContent = formatMoney(code, result.totalInterest);
    totalPaidValueEl.textContent = formatMoney(code, totalPaidAllIn);
    payoffTimeValueEl.textContent = monthsToYearsMonths(result.payoffMonths);
    upfrontFeesValueEl.textContent = formatMoney(code, upfrontFees);
    loanShownValueEl.textContent = formatMoney(code, input.loanAmount);

    if (baseline && !baseline.error) {
      const baselineAllIn = baseline.totalPaid + upfrontFees;
      const saved = baselineAllIn - totalPaidAllIn;
      savingsValueEl.textContent = formatMoney(code, saved);
    } else {
      savingsValueEl.textContent = '—';
    }

    renderSchedule(code, result.rows);
    downloadCsvBtn.disabled = false;

    lastResult = { input, result };
    saveToLocalStorage(input);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    runCalculation();
  });

  resetBtn.addEventListener('click', function () {
    setError('');
    clearResults();

    try {
      localStorage.removeItem('toolz_mortgage_inputs');
    } catch (e) {
    }

    if (window.location.search) {
      history.replaceState(null, '', window.location.pathname);
    }

    currencyEl.value = 'GBP';

    propertyPriceEl.value = '';
    termYearsEl.value = '';

    depositModeEl.value = 'percent';
    depositValueEl.value = '';

    loanAmountEl.value = '';
    startDateEl.value = '';

    introRateEl.value = '';
    introYearsEl.value = '';
    followRateEl.value = '';

    arrangementFeeEl.value = '';
    feeModeEl.value = 'upfront';
    otherUpfrontFeesEl.value = '';

    monthlyOverpayEl.value = '';
    overpayStartMonthEl.value = '';
    overpayEndMonthEl.value = '';

    lumpSumAmountEl.value = '';
    lumpSumMonthEl.value = '';

    updateDepositHint();

    const adv = document.querySelector('details.mortgage-advanced');
    if (adv) adv.open = false;

    if (scheduleWrap) scheduleWrap.style.display = 'none';
    if (toggleScheduleBtn) toggleScheduleBtn.textContent = 'Show amortisation schedule';

    const statusEl = document.getElementById('mortgageStatus');
    const mortgageErrorEl = document.getElementById('mortgageError');
    if (mortgageErrorEl) mortgageErrorEl.textContent = '';
    if (statusEl) statusEl.textContent = 'Form cleared.';
  });

  copyLinkBtn.addEventListener('click', async function () {
    setError('');
    const input = getInputsFromForm();
    const err = validateInputs(Object.assign({}, input, { followRate: input.followRate || 0 }));
    if (err) {
      setError('Fill in the key fields (loan, term, rates), then copy the link.');
      return;
    }

    const shareUrl = buildShareUrl(input);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setError('Link copied.');
      setTimeout(() => setError(''), 1200);
    } catch (e) {
      setError('Could not copy automatically. Copy from the address bar instead.');
      history.replaceState(null, '', shareUrl);
    }
  });

  if (toggleScheduleBtn && scheduleWrap) {
    toggleScheduleBtn.addEventListener('click', function () {
      const isHidden = scheduleWrap.style.display === 'none' || scheduleWrap.style.display === '';
      if (isHidden) {
        scheduleWrap.style.display = 'block';
        toggleScheduleBtn.textContent = 'Hide amortisation schedule';
      } else {
        scheduleWrap.style.display = 'none';
        toggleScheduleBtn.textContent = 'Show amortisation schedule';
      }
    });
  }

  downloadCsvBtn.addEventListener('click', function () {
    if (!lastResult) return;
    const csv = toCsv(lastResult.result);
    downloadTextFile('mortgage-amortisation-schedule.csv', csv);
  });

  depositModeEl.addEventListener('change', function () {
    updateDepositHint();
    autoUpdateLoanIfPossible();
  });

  propertyPriceEl.addEventListener('input', function () {
    autoUpdateLoanIfPossible();
  });

  depositValueEl.addEventListener('input', function () {
    autoUpdateLoanIfPossible();
  });

  function initInstantExamples() {
    const exampleButtons = document.querySelectorAll('[data-example]');
    if (!exampleButtons || exampleButtons.length === 0) return;

    const statusEl = document.getElementById('mortgageStatus');
    const mortgageErrorEl = document.getElementById('mortgageError');

    function clearStatusRegions() {
      if (mortgageErrorEl) mortgageErrorEl.textContent = '';
      if (statusEl) statusEl.textContent = '';
    }

    function setStatus(message) {
      if (statusEl) statusEl.textContent = message || '';
    }

    function toNumOrBlank(v) {
      if (v === undefined || v === null || v === '') return '';
      const n = Number(v);
      return Number.isFinite(n) ? n : '';
    }

    function toNumOrNull(v) {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }

    function toNumOrZero(v) {
      if (v === undefined || v === null || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    exampleButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        clearStatusRegions();
        setError('');

        const d = btn.dataset || {};

        const obj = {};

        if (d.currency) obj.currency = String(d.currency);

        if (d.propertyPrice !== undefined) obj.propertyPrice = toNumOrBlank(d.propertyPrice);
        if (d.termYears !== undefined) obj.termYears = toNumOrBlank(d.termYears);

        if (d.depositMode) obj.depositMode = String(d.depositMode);
        if (d.depositValue !== undefined) obj.depositValueRaw = toNumOrBlank(d.depositValue);

        if (d.introRate !== undefined) obj.introRate = toNumOrBlank(d.introRate);
        if (d.introYears !== undefined) obj.introYears = toNumOrBlank(d.introYears);
        if (d.followRate !== undefined) obj.followRate = toNumOrBlank(d.followRate);

        if (d.arrangementFee !== undefined) obj.arrangementFee = toNumOrZero(d.arrangementFee);
        if (d.feeMode) obj.feeMode = String(d.feeMode);

        if (d.otherUpfrontFees !== undefined) obj.otherUpfrontFees = toNumOrZero(d.otherUpfrontFees);

        if (d.monthlyOverpay !== undefined) obj.monthlyOverpay = toNumOrZero(d.monthlyOverpay);
        if (d.overpayStartMonth !== undefined) obj.overpayStartMonth = toNumOrBlank(d.overpayStartMonth);
        if (d.overpayEndMonth !== undefined) obj.overpayEndMonth = toNumOrNull(d.overpayEndMonth);

        if (d.lumpSumAmount !== undefined) obj.lumpSumAmount = toNumOrZero(d.lumpSumAmount);
        if (d.lumpSumMonth !== undefined) obj.lumpSumMonth = toNumOrNull(d.lumpSumMonth);

        obj.baseLoanAmount = '';

        setFormFromObject(obj);
        updateDepositHint();
        autoUpdateLoanIfPossible();

        setStatus('Example loaded. Results updated.');
        runCalculation();

        if (paymentIntroValueEl) {
          paymentIntroValueEl.setAttribute('tabindex', '-1');
          paymentIntroValueEl.focus({ preventScroll: false });
        }
      });
    });
  }

function initExamplesDropdown() {
  const card = document.getElementById('instantExamples');
  if (!card) return;

  const header = card.querySelector(':scope > .card-header');
  if (!header) return;

  const content = card.querySelector(':scope > .kpi');
  if (!content) return;

  const duration = 260;

  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'false');

  const cs = window.getComputedStyle(content);
  const padTop = cs.paddingTop;
  const padBottom = cs.paddingBottom;

  let open = false;
  let animating = false;

  content.style.overflow = 'hidden';
  content.style.height = '0px';
  content.style.opacity = '0';
  content.style.transform = 'translateY(-6px)';
  content.style.paddingTop = '0px';
  content.style.paddingBottom = '0px';
  content.style.willChange = 'height, opacity, transform, padding';

  function setExpanded(v) {
    header.setAttribute('aria-expanded', v ? 'true' : 'false');
  }

  function openPanel() {
    if (animating || open) return;
    animating = true;
    open = true;

    card.classList.add('open');
    setExpanded(true);

    content.style.transition = 'none';
    content.style.height = '0px';
    content.style.opacity = '0';
    content.style.transform = 'translateY(-6px)';
    content.style.paddingTop = '0px';
    content.style.paddingBottom = '0px';

    requestAnimationFrame(() => {
      const target = content.scrollHeight;

      content.style.transition =
        `height ${duration}ms ease, opacity 170ms ease, transform 170ms ease, padding-top ${duration}ms ease, padding-bottom ${duration}ms ease`;

      content.style.height = target + 'px';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
      content.style.paddingTop = padTop;
      content.style.paddingBottom = padBottom;

      const done = () => {
        content.removeEventListener('transitionend', onEnd);
        content.style.height = 'auto';
        animating = false;
      };

      const onEnd = (e) => {
        if (e.propertyName === 'height') done();
      };

      content.addEventListener('transitionend', onEnd);
      setTimeout(done, duration + 120);
    });
  }

  function closePanel() {
    if (animating || !open) return;
    animating = true;
    open = false;

    setExpanded(false);

    const currentH = content.getBoundingClientRect().height || content.scrollHeight;

    content.style.transition = 'none';
    content.style.height = currentH + 'px';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
    content.style.paddingTop = padTop;
    content.style.paddingBottom = padBottom;

    requestAnimationFrame(() => {
      content.style.transition =
        `height ${duration}ms ease, opacity 120ms ease, transform 120ms ease, padding-top ${duration}ms ease, padding-bottom ${duration}ms ease`;

      content.style.height = '0px';
      content.style.opacity = '0';
      content.style.transform = 'translateY(-6px)';
      content.style.paddingTop = '0px';
      content.style.paddingBottom = '0px';

      const done = () => {
        content.removeEventListener('transitionend', onEnd);
        card.classList.remove('open');
        animating = false;
      };

      const onEnd = (e) => {
        if (e.propertyName === 'height') done();
      };

      content.addEventListener('transitionend', onEnd);
      setTimeout(done, duration + 120);
    });
  }

  function toggle() {
    if (open) closePanel();
    else openPanel();
  }

  header.addEventListener('click', toggle);

  header.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  card.classList.remove('open');
  setExpanded(false);
}

  initInstantExamples();
  initExamplesDropdown();
  initDefaults();
})();