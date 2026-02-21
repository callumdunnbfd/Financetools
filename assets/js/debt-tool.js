(() => {
  const STORAGE_KEY = "debt_tool_v2";

  const els = {
    form: document.getElementById("debtForm"),
    currency: document.getElementById("currency"),
    startMonth: document.getElementById("startMonth"),
    startYear: document.getElementById("startYear"),
    extraPayment: document.getElementById("extraPayment"),
    errExtraPayment: document.getElementById("errExtraPayment"),
    roundPennies: document.getElementById("roundPennies"),
    tbody: document.getElementById("debtsTbody"),
    btnAddDebt: document.getElementById("btnAddDebt"),
    btnAddExamples: document.getElementById("btnAddExamples"),
    btnClearSaved: document.getElementById("btnClearSaved"),
    btnReset: document.getElementById("btnReset"),
    formErrors: document.getElementById("formErrors"),
    resultsCard: document.getElementById("results"),
    summaryStrip: document.getElementById("summaryStrip"),
    snowballSummary: document.getElementById("snowballSummary"),
    avalancheSummary: document.getElementById("avalancheSummary"),
    differenceSummary: document.getElementById("differenceSummary"),
    scheduleTbody: document.getElementById("scheduleTbody"),
    payoffTbody: document.getElementById("payoffTbody"),
    byDebtThead: document.getElementById("byDebtThead"),
    byDebtTbody: document.getElementById("byDebtTbody"),
    btnViewSnowball: document.getElementById("btnViewSnowball"),
    btnViewAvalanche: document.getElementById("btnViewAvalanche"),
    btnScrollTop: document.getElementById("btnScrollTop"),
    resultsLink: document.getElementById("resultsLink"),
    chart: document.getElementById("balanceChart"),
    tooltip: document.getElementById("chartTooltip"),
    monthScrub: document.getElementById("monthScrub"),
    scrubReadout: document.getElementById("scrubReadout")
  };

  const state = {
    debts: [],
    settings: {
      currency: "GBP",
      startMonth: null,
      startYear: null,
      extraPayment: 0,
      roundPennies: true
    },
    results: {
      snowball: null,
      avalanche: null
    },
    viewMethod: "snowball"
  };

  const currencyMeta = {
    GBP: { symbol: "£", decimals: 2 },
    USD: { symbol: "$", decimals: 2 },
    EUR: { symbol: "€", decimals: 2 },
    INR: { symbol: "₹", decimals: 2 }
  };

  function nowMonthYearUTC() {
    const d = new Date();
    return { m: d.getMonth(), y: d.getFullYear() };
  }

  function monthLabel(year, monthIndex) {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
    return fmt.format(d);
  }

  function addMonthsUTC(year, monthIndex, add) {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    d.setUTCMonth(d.getUTCMonth() + add);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  }

  function roundMoney(value, enabled) {
    if (!enabled) return value;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function clampNumber(n, min, max) {
    if (Number.isNaN(n)) return NaN;
    return Math.min(max, Math.max(min, n));
  }

  function parseNumberLoose(raw) {
    const s = String(raw ?? "").replace(/[^\d.]/g, "");
    if (!s) return NaN;
    const parts = s.split(".");
    if (parts.length > 2) return NaN;
    const normalized = parts.length === 1 ? parts[0] : parts[0] + "." + parts[1];
    return Number(normalized);
  }

  function formatCurrency(amount, code) {
    const meta = currencyMeta[code] || currencyMeta.GBP;
    const v = Number.isFinite(amount) ? amount : 0;
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    const fixed = abs.toFixed(meta.decimals);
    const [intPart, decPart] = fixed.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return meta.decimals ? `${sign}${meta.symbol}${withCommas}.${decPart}` : `${sign}${meta.symbol}${withCommas}`;
  }

  function formatPercent(apr) {
    if (!Number.isFinite(apr)) return "—";
    const v = Math.round(apr * 100) / 100;
    return `${v}%`;
  }

  function keepCursorStableCurrency(inputEl, formatter) {
    const raw = inputEl.value;
    const selStart = inputEl.selectionStart ?? raw.length;

    const digitsBefore = raw.slice(0, selStart).replace(/[^\d]/g, "").length;
    const newValue = formatter(raw);

    inputEl.value = newValue;

    let pos = 0;
    let digitCount = 0;
    while (pos < newValue.length && digitCount < digitsBefore) {
      if (/\d/.test(newValue[pos])) digitCount += 1;
      pos += 1;
    }
    inputEl.setSelectionRange(pos, pos);
  }

  function currencyInputFormatterFactory(code) {
    const meta = currencyMeta[code] || currencyMeta.GBP;
    return (raw) => {
      const n = parseNumberLoose(raw);
      if (!Number.isFinite(n)) return "";
      const rounded = Math.round(n * Math.pow(10, meta.decimals)) / Math.pow(10, meta.decimals);
      const fixed = rounded.toFixed(meta.decimals);
      const [intPart, decPart] = fixed.split(".");
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return meta.decimals ? `${meta.symbol}${withCommas}.${decPart}` : `${meta.symbol}${withCommas}`;
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cryptoId() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return "d" + a[0].toString(16) + a[1].toString(16);
    }
    return "d" + Math.random().toString(16).slice(2);
  }

  function createDebtRow(debt) {
    const tr = document.createElement("tr");
    tr.dataset.id = debt.id;

    tr.innerHTML = `
      <td>
        <input class="cell-input" type="text" inputmode="text" autocomplete="off" placeholder="(Optional)" data-field="name" value="${escapeHtml(debt.name || "")}" />
        <div class="cell-error" data-err="name"></div>
      </td>
      <td>
        <input class="cell-input" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-field="balance" value="" />
        <div class="cell-error" data-err="balance"></div>
      </td>
      <td>
        <input class="cell-input" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-field="apr" value="${debt.apr === null ? "" : escapeHtml(String(debt.apr))}" />
        <div class="cell-error" data-err="apr"></div>
      </td>
      <td>
        <input class="cell-input" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-field="minPayment" value="" />
        <div class="cell-error" data-err="minPayment"></div>
      </td>
      <td class="col-actions">
        <div class="cell-actions">
          <button type="button" class="icon-btn icon-btn-danger" data-action="delete" aria-label="Delete debt">✕</button>
        </div>
      </td>
    `;

    const balInput = tr.querySelector('input[data-field="balance"]');
    const minInput = tr.querySelector('input[data-field="minPayment"]');

    const code = state.settings.currency;
    const fmt = currencyInputFormatterFactory(code);

    balInput.value = debt.balance ? formatCurrency(debt.balance, code) : "";
    minInput.value = debt.minPayment ? formatCurrency(debt.minPayment, code) : "";

    balInput.addEventListener("input", () => keepCursorStableCurrency(balInput, fmt));
    minInput.addEventListener("input", () => keepCursorStableCurrency(minInput, fmt));

    tr.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      const field = target.dataset.field;
      if (!field) return;

      const d = state.debts.find(x => x.id === debt.id);
      if (!d) return;

      if (field === "name") d.name = target.value.trim();
      if (field === "balance") d.balance = parseNumberLoose(target.value);
      if (field === "apr") d.apr = parseNumberLoose(target.value);
      if (field === "minPayment") d.minPayment = parseNumberLoose(target.value);

      saveToStorage();
    });

    tr.addEventListener("click", (e) => {
      const btn = e.target;
      if (!(btn instanceof HTMLElement)) return;
      if (btn.dataset.action === "delete") removeDebt(debt.id);
    });

    return tr;
  }

  function addDebt(partial = {}) {
    const debt = {
      id: cryptoId(),
      name: partial.name ?? "",
      balance: Number.isFinite(partial.balance) ? partial.balance : NaN,
      apr: Number.isFinite(partial.apr) ? partial.apr : NaN,
      minPayment: Number.isFinite(partial.minPayment) ? partial.minPayment : NaN
    };
    state.debts.push(debt);
    els.tbody.appendChild(createDebtRow(debt));
    saveToStorage();
  }

  function removeDebt(id) {
    state.debts = state.debts.filter(d => d.id !== id);
    const row = els.tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) row.remove();
    saveToStorage();
  }

  function populateStartSelectors() {
    const months = Array.from({ length: 12 }, (_, i) => i);
    els.startMonth.innerHTML = months.map(m => `<option value="${m}">${monthLabel(2000, m).split(" ")[0]}</option>`).join("");

    const now = nowMonthYearUTC();
    const years = [];
    for (let y = now.y - 1; y <= now.y + 20; y += 1) years.push(y);
    els.startYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");

    els.startMonth.value = String(now.m);
    els.startYear.value = String(now.y);

    state.settings.startMonth = now.m;
    state.settings.startYear = now.y;
  }

  function getCurrencyCode() {
    return els.currency.value;
  }

  function setCurrencyCode(code) {
    els.currency.value = code;
    state.settings.currency = code;
    rerenderCurrencyFields();
  }

  function rerenderCurrencyFields() {
    const code = state.settings.currency;
    const fmt = currencyInputFormatterFactory(code);

    const extra = parseNumberLoose(els.extraPayment.value);
    els.extraPayment.value = Number.isFinite(extra) && extra !== 0 ? formatCurrency(extra, code) : "";

    const rows = els.tbody.querySelectorAll("tr");
    rows.forEach(row => {
      const id = row.dataset.id;
      const d = state.debts.find(x => x.id === id);
      if (!d) return;

      const balInput = row.querySelector('input[data-field="balance"]');
      const minInput = row.querySelector('input[data-field="minPayment"]');

      if (balInput) {
        balInput.value = Number.isFinite(d.balance) ? formatCurrency(d.balance, code) : "";
        balInput.oninput = null;
        balInput.addEventListener("input", () => keepCursorStableCurrency(balInput, fmt));
      }
      if (minInput) {
        minInput.value = Number.isFinite(d.minPayment) ? formatCurrency(d.minPayment, code) : "";
        minInput.oninput = null;
        minInput.addEventListener("input", () => keepCursorStableCurrency(minInput, fmt));
      }
    });

    saveToStorage();
  }

  function clearInlineErrors() {
    els.formErrors.style.display = "none";
    els.formErrors.textContent = "";
    els.errExtraPayment.textContent = "";

    const rowErrs = els.tbody.querySelectorAll(".cell-error, .cell-warn");
    rowErrs.forEach(e => {
      e.textContent = "";
      e.classList.remove("cell-warn");
      e.classList.add("cell-error");
    });
  }

  function showFormError(msg) {
    els.formErrors.style.display = "block";
    els.formErrors.textContent = msg;
  }

  function setRowMessage(debtId, field, msg, type) {
    const row = els.tbody.querySelector(`tr[data-id="${CSS.escape(debtId)}"]`);
    if (!row) return;
    const el = row.querySelector(`[data-err="${CSS.escape(field)}"]`);
    if (!el) return;

    el.textContent = msg || "";
    el.classList.remove("cell-error");
    el.classList.remove("cell-warn");
    if (type === "warn") el.classList.add("cell-warn");
    else el.classList.add("cell-error");
  }

  function validateInputs() {
    clearInlineErrors();

    const code = getCurrencyCode();
    state.settings.currency = code;

    const extra = parseNumberLoose(els.extraPayment.value);
    if (!Number.isFinite(extra)) {
      state.settings.extraPayment = 0;
    } else {
      const clamped = clampNumber(extra, 0, 1e12);
      state.settings.extraPayment = clamped;
      if (clamped !== extra) els.errExtraPayment.textContent = "Extra payment must be 0 or more.";
    }

    state.settings.roundPennies = !!els.roundPennies.checked;

    const startM = Number(els.startMonth.value);
    const startY = Number(els.startYear.value);
    state.settings.startMonth = Number.isFinite(startM) ? startM : nowMonthYearUTC().m;
    state.settings.startYear = Number.isFinite(startY) ? startY : nowMonthYearUTC().y;

    if (!state.debts.length) {
      showFormError("Add at least one debt to calculate a payoff plan.");
      return { ok: false };
    }

    let hasErrors = false;

    const cleaned = state.debts.map((d, idx) => {
      const name = (d.name || "").trim() || `Debt ${idx + 1}`;

      const balance = d.balance;
      const apr = d.apr;
      const minPayment = d.minPayment;

      if (!Number.isFinite(balance) || balance <= 0) {
        setRowMessage(d.id, "balance", "Enter a balance greater than 0.", "error");
        hasErrors = true;
      }

      if (!Number.isFinite(apr) || apr < 0 || apr > 100) {
        setRowMessage(d.id, "apr", "Enter an APR between 0 and 100.", "error");
        hasErrors = true;
      }

      if (!Number.isFinite(minPayment) || minPayment <= 0) {
        setRowMessage(d.id, "minPayment", "Enter a minimum payment greater than 0.", "error");
        hasErrors = true;
      }

      return {
        id: d.id,
        name,
        balance: Number.isFinite(balance) ? balance : NaN,
        apr: Number.isFinite(apr) ? apr : NaN,
        minPayment: Number.isFinite(minPayment) ? minPayment : NaN
      };
    });

    if (hasErrors) return { ok: false };

    cleaned.forEach(d => {
      const r = (d.apr / 100) / 12;
      const monthlyInterest = d.balance * r;
      if (Number.isFinite(monthlyInterest) && d.minPayment <= monthlyInterest + 0.005 && d.apr > 0) {
        setRowMessage(
          d.id,
          "minPayment",
          "Warning: this minimum may not cover one month’s interest at this balance. You may need extra payment (or a lower APR) to make progress.",
          "warn"
        );
      }
    });

    const baseMinSum = cleaned.reduce((sum, d) => sum + d.minPayment, 0);
    const monthlyBudget = baseMinSum + state.settings.extraPayment;

    const totalInterest0 = cleaned.reduce((sum, d) => {
      const r = (d.apr / 100) / 12;
      return sum + d.balance * r;
    }, 0);

    if (monthlyBudget <= totalInterest0 + 0.005) {
      showFormError(
        "Your total monthly payment is not enough to cover the interest being added each month. Increase your extra payment, increase minimum payments, or reduce APR (where possible) so balances decrease."
      );
      return { ok: false };
    }

    return { ok: true, debts: cleaned, monthlyBudget, baseMinSum };
  }

  function runSimulation(method, inputDebts, settings, monthlyBudget, capMonths = 1200) {
    const debts = inputDebts.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minPayment: d.minPayment,
      startBalance: d.balance
    }));

    const start = { y: settings.startYear, m: settings.startMonth };

    let monthIndex = 0;
    let totalInterestPaid = 0;
    let totalPaid = 0;

    const schedule = [];
    const byDebtBalances = [];
    const payoffInfo = debts.map(d => ({ id: d.id, name: d.name, payoffMonthIndex: null, monthsToPayoff: null }));

    while (monthIndex < capMonths) {
      const active = debts.filter(d => d.balance > 0.0000001);
      const totalBalanceBefore = active.reduce((s, d) => s + d.balance, 0);
      if (totalBalanceBefore <= 0.005) break;

      const monthDate = addMonthsUTC(start.y, start.m, monthIndex);

      let interestAccrued = 0;
      active.forEach(d => {
        const r = (d.apr / 100) / 12;
        const interest = d.balance * r;
        d.balance += interest;
        interestAccrued += interest;
      });

      let remainingBudget = monthlyBudget;
      let actualPaidThisMonth = 0;

      active.forEach(d => {
        const pay = Math.min(d.minPayment, d.balance, remainingBudget);
        d.balance -= pay;
        remainingBudget -= pay;
        actualPaidThisMonth += pay;
      });

      remainingBudget = Math.max(0, remainingBudget);

      const ordered = active
        .filter(d => d.balance > 0.0000001)
        .sort((a, b) => {
          if (method === "avalanche") {
            if (b.apr !== a.apr) return b.apr - a.apr;
            if (b.balance !== a.balance) return b.balance - a.balance;
            return a.name.localeCompare(b.name);
          }
          if (a.balance !== b.balance) return a.balance - b.balance;
          if (b.apr !== a.apr) return b.apr - a.apr;
          return a.name.localeCompare(b.name);
        });

      let i = 0;
      while (remainingBudget > 0.0000001 && i < ordered.length) {
        const d = ordered[i];
        if (d.balance <= 0.0000001) {
          i += 1;
          continue;
        }
        const pay = Math.min(remainingBudget, d.balance);
        d.balance -= pay;
        remainingBudget -= pay;
        actualPaidThisMonth += pay;
        if (d.balance <= 0.0000001) i += 1;
      }

      debts.forEach(d => {
        if (d.balance <= 0.0000001 && d.startBalance > 0) {
          const p = payoffInfo.find(x => x.id === d.id);
          if (p && p.payoffMonthIndex === null) {
            p.payoffMonthIndex = monthIndex;
            p.monthsToPayoff = monthIndex + 1;
          }
        }
      });

      const totalBalanceAfter = debts.reduce((s, d) => s + Math.max(0, d.balance), 0);

      const paidRounded = roundMoney(actualPaidThisMonth, settings.roundPennies);
      const interestRounded = roundMoney(interestAccrued, settings.roundPennies);
      const principalRounded = roundMoney(Math.max(0, paidRounded - interestRounded), settings.roundPennies);
      const remainingRounded = roundMoney(totalBalanceAfter, settings.roundPennies);

      totalInterestPaid += interestRounded;
      totalPaid += paidRounded;

      schedule.push({
        idx: monthIndex,
        year: monthDate.y,
        month: monthDate.m,
        label: monthLabel(monthDate.y, monthDate.m),
        payment: paidRounded,
        interest: interestRounded,
        principal: principalRounded,
        remaining: remainingRounded
      });

      const rowBalances = { idx: monthIndex, label: monthLabel(monthDate.y, monthDate.m) };
      debts.forEach(d => {
        rowBalances[d.id] = roundMoney(Math.max(0, d.balance), settings.roundPennies);
      });
      byDebtBalances.push(rowBalances);

      monthIndex += 1;

      if (totalBalanceAfter <= 0.005) break;
    }

    const completed = debts.reduce((s, d) => s + Math.max(0, d.balance), 0) <= 0.01;

    const monthsToDebtFree = completed ? schedule.length : null;
    const debtFreeDate = completed
      ? addMonthsUTC(settings.startYear, settings.startMonth, monthsToDebtFree - 1)
      : null;

    const totalInterest = roundMoney(totalInterestPaid, settings.roundPennies);
    const totalPaidRounded = roundMoney(totalPaid, settings.roundPennies);

    return {
      method,
      completed,
      monthsToDebtFree,
      debtFreeDate,
      totalInterest,
      totalPaid: totalPaidRounded,
      schedule,
      payoffInfo,
      debtsSnapshot: inputDebts.map(d => ({ ...d })),
      byDebtBalances
    };
  }

  function renderSummaryStrip() {
    const code = state.settings.currency;

    const s = state.results.snowball;
    const a = state.results.avalanche;

    const strip = els.summaryStrip;
    const pills = strip.querySelectorAll(".pill");
    if (pills.length < 3) return;

    const snowV = pills[0].querySelector(".pill-v");
    const avaV = pills[1].querySelector(".pill-v");
    const savedV = pills[2].querySelector(".pill-v");

    if (!s || !a) {
      snowV.textContent = "—";
      avaV.textContent = "—";
      savedV.textContent = "—";
      return;
    }

    const snowText = s.completed ? `${s.monthsToDebtFree} mo` : "Not paid off";
    const avaText = a.completed ? `${a.monthsToDebtFree} mo` : "Not paid off";

    const interestSaved = (s.totalInterest - a.totalInterest);
    const best = interestSaved > 0 ? a : s;
    const saved = Math.abs(interestSaved);

    snowV.textContent = snowText;
    avaV.textContent = avaText;
    savedV.textContent = s.completed && a.completed ? formatCurrency(saved, code) : "—";

    pills[2].classList.remove("pill-muted");
    pills[0].classList.remove("pill-muted");
    pills[1].classList.remove("pill-muted");

    const savedKey = pills[2].querySelector(".pill-k");
    savedKey.textContent = best.method === "avalanche" ? "Interest saved (Avalanche vs Snowball)" : "Interest saved (Snowball vs Avalanche)";
  }

  function renderMethodSummary(targetDl, result) {
    const code = state.settings.currency;
    const rows = targetDl.querySelectorAll(".kv-row");
    if (rows.length < 4) return;

    const dd0 = rows[0].querySelector("dd");
    const dd1 = rows[1].querySelector("dd");
    const dd2 = rows[2].querySelector("dd");
    const dd3 = rows[3].querySelector("dd");

    if (!result || !result.completed) {
      dd0.textContent = "—";
      dd1.textContent = "—";
      dd2.textContent = "—";
      dd3.textContent = "—";
      return;
    }

    dd0.textContent = `${result.monthsToDebtFree}`;
    dd1.textContent = monthLabel(result.debtFreeDate.y, result.debtFreeDate.m);
    dd2.textContent = formatCurrency(result.totalInterest, code);
    dd3.textContent = formatCurrency(result.totalPaid, code);
  }

  function renderDifferenceSummary() {
    const code = state.settings.currency;
    const s = state.results.snowball;
    const a = state.results.avalanche;

    const rows = els.differenceSummary.querySelectorAll(".kv-row");
    if (rows.length < 3) return;

    const dd0 = rows[0].querySelector("dd");
    const dd1 = rows[1].querySelector("dd");
    const dd2 = rows[2].querySelector("dd");

    if (!s || !a || !s.completed || !a.completed) {
      dd0.textContent = "—";
      dd1.textContent = "—";
      dd2.textContent = "—";
      return;
    }

    const saved = s.totalInterest - a.totalInterest;
    const absSaved = Math.abs(saved);

    dd0.textContent = formatCurrency(absSaved, code) + (saved > 0 ? " (Avalanche)" : saved < 0 ? " (Snowball)" : "");
    const diffMonths = s.monthsToDebtFree - a.monthsToDebtFree;
    dd1.textContent = diffMonths === 0 ? "Same" : `${Math.abs(diffMonths)} month${Math.abs(diffMonths) === 1 ? "" : "s"} ${diffMonths > 0 ? "faster (Avalanche)" : "faster (Snowball)"}`;

    const baseMinSum = s.debtsSnapshot.reduce((sum, d) => sum + d.minPayment, 0);
    const monthlyBudget = baseMinSum + state.settings.extraPayment;
    dd2.textContent = formatCurrency(monthlyBudget, code) + " / month";
  }

  function renderScheduleTable(result) {
    const code = state.settings.currency;
    els.scheduleTbody.innerHTML = result.schedule.map(r => `
      <tr>
        <td>${escapeHtml(r.label)}</td>
        <td>${escapeHtml(formatCurrency(r.payment, code))}</td>
        <td>${escapeHtml(formatCurrency(r.interest, code))}</td>
        <td>${escapeHtml(formatCurrency(r.principal, code))}</td>
        <td>${escapeHtml(formatCurrency(r.remaining, code))}</td>
      </tr>
    `).join("");
  }

  function renderPayoffTable(result) {
    const code = state.settings.currency;
    const debts = result.debtsSnapshot;

    els.payoffTbody.innerHTML = result.payoffInfo.map(p => {
      const d = debts.find(x => x.id === p.id);
      const months = p.monthsToPayoff;
      const payoffMonth = months ? addMonthsUTC(state.settings.startYear, state.settings.startMonth, months - 1) : null;

      return `
        <tr>
          <td>${escapeHtml(d.name || p.name)}</td>
          <td>${escapeHtml(formatCurrency(d.balance, code))}</td>
          <td>${escapeHtml(formatPercent(d.apr))}</td>
          <td>${escapeHtml(formatCurrency(d.minPayment, code))}</td>
          <td>${months ? `${months} mo` : "—"}</td>
          <td>${payoffMonth ? escapeHtml(monthLabel(payoffMonth.y, payoffMonth.m)) : "—"}</td>
        </tr>
      `;
    }).join("");
  }

  function renderByDebtTable(result, maxRows = 240) {
    const code = state.settings.currency;
    const debts = result.debtsSnapshot;

    els.byDebtThead.innerHTML = `
      <tr>
        <th scope="col">Month</th>
        ${debts.map(d => `<th scope="col">${escapeHtml(d.name)}</th>`).join("")}
      </tr>
    `;

    const rows = result.byDebtBalances.slice(0, maxRows).map(r => {
      const tds = debts.map(d => `<td>${escapeHtml(formatCurrency(r[d.id] ?? 0, code))}</td>`).join("");
      return `<tr><td>${escapeHtml(r.label)}</td>${tds}</tr>`;
    }).join("");

    const truncated = result.byDebtBalances.length > maxRows
      ? `<tr><td colspan="${debts.length + 1}">Showing first ${maxRows} months only.</td></tr>`
      : "";

    els.byDebtTbody.innerHTML = rows + truncated;
  }

  function scrollToResults() {
    els.resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setViewMethod(method) {
    state.viewMethod = method;

    els.btnViewSnowball.classList.toggle("is-active", method === "snowball");
    els.btnViewAvalanche.classList.toggle("is-active", method === "avalanche");

    const result = method === "snowball" ? state.results.snowball : state.results.avalanche;
    if (!result) return;

    renderScheduleTable(result);
    renderPayoffTable(result);
    renderByDebtTable(result);

    updateScrubReadout(Number(els.monthScrub.value || 0));
  }

  function renderAllResults() {
    renderSummaryStrip();
    renderMethodSummary(els.snowballSummary, state.results.snowball);
    renderMethodSummary(els.avalancheSummary, state.results.avalanche);
    renderDifferenceSummary();

    els.resultsCard.hidden = false;

    setViewMethod("snowball");
    initScrubber();
    drawChart();

    scrollToResults();
  }

  function initScrubber() {
    const s = state.results.snowball;
    const a = state.results.avalanche;
    if (!s || !a) return;

    const maxMonths = Math.max(s.schedule.length, a.schedule.length);
    els.monthScrub.min = "0";
    els.monthScrub.max = String(Math.max(0, maxMonths - 1));
    els.monthScrub.value = "0";

    els.monthScrub.oninput = () => {
      const idx = Number(els.monthScrub.value);
      updateScrubReadout(idx);
      drawChart(idx);
    };
  }

  function updateScrubReadout(idx) {
    const code = state.settings.currency;

    const s = state.results.snowball;
    const a = state.results.avalanche;
    if (!s || !a) {
      els.scrubReadout.textContent = "—";
      return;
    }

    const sRow = s.schedule[Math.min(idx, s.schedule.length - 1)];
    const aRow = a.schedule[Math.min(idx, a.schedule.length - 1)];

    if (!sRow || !aRow) {
      els.scrubReadout.textContent = "—";
      return;
    }

    els.scrubReadout.textContent =
      `${sRow.label} · Snowball ${formatCurrency(sRow.remaining, code)} · Avalanche ${formatCurrency(aRow.remaining, code)}`;
  }

  function drawChart(highlightIdx = null) {
    const canvas = els.chart;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const s = state.results.snowball;
    const a = state.results.avalanche;
    if (!s || !a) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = canvas.clientWidth || 900;
    const cssH = Math.round(cssW * 0.40);

    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = cssW;
    const h = cssH;

    const padL = 54;
    const padR = 18;
    const padT = 16;
    const padB = 34;

    const sVals = s.schedule.map(x => x.remaining);
    const aVals = a.schedule.map(x => x.remaining);

    const maxMonths = Math.max(sVals.length, aVals.length);
    const maxY = Math.max(1, ...sVals, ...aVals);

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#e5eaf2";
    ctx.lineWidth = 1;

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i += 1) {
      const y = padT + (plotH * i / gridLines);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif";

    const code = state.settings.currency;
    for (let i = 0; i <= gridLines; i += 1) {
      const v = maxY - (maxY * i / gridLines);
      const y = padT + (plotH * i / gridLines);
      ctx.fillText(formatCurrency(v, code), 8, y + 4);
    }

    const xFor = (idx) => {
      if (maxMonths <= 1) return padL;
      return padL + (plotW * idx / (maxMonths - 1));
    };

    const yFor = (val) => {
      const t = val / maxY;
      return padT + plotH * (1 - t);
    };

    drawLine(ctx, sVals, xFor, yFor, "#2563eb");
    drawLine(ctx, aVals, xFor, yFor, "#0f766e");

    if (typeof highlightIdx === "number") {
      const idx = clampNumber(highlightIdx, 0, maxMonths - 1);
      const x = xFor(idx);
      ctx.strokeStyle = "rgba(15,23,42,.25)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, h - padB);
      ctx.stroke();
    }

    ctx.fillStyle = "#475569";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Arial, sans-serif";
    ctx.fillText("Month", w - padR - 44, h - 10);
  }

  function drawLine(ctx, values, xFor, yFor, stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < values.length; i += 1) {
      const x = xFor(i);
      const y = yFor(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function attachChartHover() {
    const canvas = els.chart;
    const tooltip = els.tooltip;

    const onMove = (e) => {
      const s = state.results.snowball;
      const a = state.results.avalanche;
      if (!s || !a) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const padL = 54;
      const padR = 18;
      const plotW = rect.width - padL - padR;

      const maxMonths = Math.max(s.schedule.length, a.schedule.length);
      if (maxMonths <= 0) return;

      const t = clampNumber((x - padL) / Math.max(1, plotW), 0, 1);
      const idx = Math.round(t * (maxMonths - 1));

      els.monthScrub.value = String(idx);
      updateScrubReadout(idx);
      drawChart(idx);

      const code = state.settings.currency;
      const sRow = s.schedule[Math.min(idx, s.schedule.length - 1)];
      const aRow = a.schedule[Math.min(idx, a.schedule.length - 1)];

      tooltip.hidden = false;
      tooltip.innerHTML = `
        <div style="font-weight:800;margin-bottom:6px">${escapeHtml(sRow?.label || "—")}</div>
        <div><span style="font-weight:800;color:#2563eb">Snowball</span> · ${escapeHtml(formatCurrency(sRow?.remaining ?? 0, code))}</div>
        <div><span style="font-weight:800;color:#0f766e">Avalanche</span> · ${escapeHtml(formatCurrency(aRow?.remaining ?? 0, code))}</div>
      `;

      const ttW = 210;
      const left = Math.min(rect.width - ttW - 8, Math.max(8, x + 10));
      tooltip.style.left = left + "px";
      tooltip.style.top = "10px";
    };

    const onLeave = () => {
      tooltip.hidden = true;
      drawChart(Number(els.monthScrub.value || 0));
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) onMove(e.touches[0]);
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches[0]) onMove(e.touches[0]);
    }, { passive: true });
    canvas.addEventListener("touchend", onLeave);
  }

  function saveToStorage() {
    const payload = {
      settings: {
        currency: state.settings.currency,
        startMonth: state.settings.startMonth,
        startYear: state.settings.startYear,
        extraPayment: state.settings.extraPayment,
        roundPennies: state.settings.roundPennies
      },
      debts: state.debts.map(d => ({
        id: d.id,
        name: d.name,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment
      }))
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);

      if (parsed && parsed.settings) {
        const s = parsed.settings;
        state.settings.currency = s.currency || "GBP";
        state.settings.startMonth = Number.isFinite(s.startMonth) ? s.startMonth : nowMonthYearUTC().m;
        state.settings.startYear = Number.isFinite(s.startYear) ? s.startYear : nowMonthYearUTC().y;
        state.settings.extraPayment = Number.isFinite(s.extraPayment) ? s.extraPayment : 0;
        state.settings.roundPennies = s.roundPennies !== false;
      }

      if (Array.isArray(parsed.debts)) {
        state.debts = parsed.debts.map(d => ({
          id: d.id || cryptoId(),
          name: d.name || "",
          balance: Number.isFinite(d.balance) ? d.balance : NaN,
          apr: Number.isFinite(d.apr) ? d.apr : NaN,
          minPayment: Number.isFinite(d.minPayment) ? d.minPayment : NaN
        }));
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  function clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function rebuildDebtTable() {
    els.tbody.innerHTML = "";
    state.debts.forEach(d => {
      els.tbody.appendChild(createDebtRow(d));
    });
    rerenderCurrencyFields();
  }

  function addExampleDebts() {
    state.debts = [];
    rebuildDebtTable();

    addDebt({ name: "Credit card A", balance: 1850, apr: 29.9, minPayment: 55 });
    addDebt({ name: "Credit card B", balance: 4200, apr: 22.9, minPayment: 120 });
    addDebt({ name: "Personal loan", balance: 7800, apr: 9.9, minPayment: 210 });

    const code = getCurrencyCode();
    const fmt = currencyInputFormatterFactory(code);
    els.extraPayment.value = fmt("150");
    keepCursorStableCurrency(els.extraPayment, fmt);
  }

  function hardResetForm() {
    clearInlineErrors();
    state.results.snowball = null;
    state.results.avalanche = null;
    state.viewMethod = "snowball";
    els.resultsCard.hidden = true;

    state.debts = [];
    rebuildDebtTable();
    addDebt();

    const now = nowMonthYearUTC();
    els.startMonth.value = String(now.m);
    els.startYear.value = String(now.y);
    state.settings.startMonth = now.m;
    state.settings.startYear = now.y;

    els.extraPayment.value = "";
    state.settings.extraPayment = 0;

    els.roundPennies.checked = true;
    state.settings.roundPennies = true;

    setCurrencyCode("GBP");
    renderSummaryStrip();

    saveToStorage();
  }

  function calculateAndRender() {
    const v = validateInputs();
    if (!v.ok) return;

    const settings = {
      currency: state.settings.currency,
      startMonth: state.settings.startMonth,
      startYear: state.settings.startYear,
      extraPayment: state.settings.extraPayment,
      roundPennies: state.settings.roundPennies
    };

    const snowball = runSimulation("snowball", v.debts, settings, v.monthlyBudget);
    const avalanche = runSimulation("avalanche", v.debts, settings, v.monthlyBudget);

    if (!snowball.completed || !avalanche.completed) {
      showFormError(
        "The simulation hit the safety cap before paying everything off. Try increasing your extra payment or minimums. This tool stops after 1200 months to avoid endless projections."
      );
      return;
    }

    state.results.snowball = snowball;
    state.results.avalanche = avalanche;

    renderAllResults();
  }

  function attachEvents() {
    els.currency.addEventListener("change", () => setCurrencyCode(getCurrencyCode()));

    const fmt = () => currencyInputFormatterFactory(getCurrencyCode());
    els.extraPayment.addEventListener("input", () => keepCursorStableCurrency(els.extraPayment, fmt()));

    els.startMonth.addEventListener("change", () => {
      state.settings.startMonth = Number(els.startMonth.value);
      saveToStorage();
    });

    els.startYear.addEventListener("change", () => {
      state.settings.startYear = Number(els.startYear.value);
      saveToStorage();
    });

    els.roundPennies.addEventListener("change", () => {
      state.settings.roundPennies = !!els.roundPennies.checked;
      saveToStorage();
    });

    els.btnAddDebt.addEventListener("click", () => addDebt());
    els.btnAddExamples.addEventListener("click", () => {
      addExampleDebts();
      saveToStorage();
    });

    els.btnClearSaved.addEventListener("click", () => {
      clearStorage();
      hardResetForm();
    });

    els.btnReset.addEventListener("click", () => hardResetForm());

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateAndRender();
    });

    els.btnViewSnowball.addEventListener("click", () => setViewMethod("snowball"));
    els.btnViewAvalanche.addEventListener("click", () => setViewMethod("avalanche"));

    els.btnScrollTop.addEventListener("click", () => {
      document.getElementById("calculator").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    els.resultsLink.addEventListener("click", (e) => {
      if (els.resultsCard.hidden) e.preventDefault();
    });

    attachChartHover();
  }

  function init() {
    populateStartSelectors();

    const loaded = loadFromStorage();
    if (loaded) {
      setCurrencyCode(state.settings.currency || "GBP");
      els.startMonth.value = String(state.settings.startMonth ?? nowMonthYearUTC().m);
      els.startYear.value = String(state.settings.startYear ?? nowMonthYearUTC().y);
      els.roundPennies.checked = state.settings.roundPennies !== false;

      const code = getCurrencyCode();
      els.extraPayment.value = state.settings.extraPayment ? formatCurrency(state.settings.extraPayment, code) : "";

      rebuildDebtTable();
      if (!state.debts.length) addDebt();
    } else {
      addDebt();
      setCurrencyCode("GBP");
    }

    renderSummaryStrip();
    attachEvents();
  }

  init();
})();
