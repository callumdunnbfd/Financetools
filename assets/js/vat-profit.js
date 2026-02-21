import { parseNumber, roundTo, fmtMoney, fmtPct, setText, setError } from "./utils.js";

const currency = document.getElementById("currency");
const rate = document.getElementById("rate");
const mode = document.getElementById("mode");
const cost = document.getElementById("cost");
const sell = document.getElementById("sell");
const copy = document.getElementById("copy");
const reset = document.getElementById("reset");

function renderEmpty(){
  setText("netSale", "—");
  setText("vatAmt", "—");
  setText("grossSale", "—");
  setText("profit", "—");
  setText("margin", "—");
  setText("markup", "—");
  setText("beEx", "—");
  setText("beInc", "—");
}

function calc(){
  const ccy = currency.value || "GBP";
  const rPct = parseNumber(rate.value);
  const r = isFinite(rPct) ? rPct / 100 : NaN;
  const c = parseNumber(cost.value);
  const s = parseNumber(sell.value);

  if (!isFinite(r) || r < 0 || r > 1){
    setError("err", "VAT rate must be between 0 and 100.");
    renderEmpty();
    return;
  }
  if (!isFinite(c) || c < 0){
    setError("err", "Unit cost must be 0 or more.");
    renderEmpty();
    return;
  }
  if (!isFinite(s) || s < 0){
    setError("err", "Selling price must be 0 or more.");
    renderEmpty();
    return;
  }

  setError("err", "");

  const netSale = mode.value === "inc" ? roundTo(s / (1 + r), 2) : roundTo(s, 2);
  const vatAmt = mode.value === "inc" ? roundTo(s - netSale, 2) : roundTo(netSale * r, 2);
  const grossSale = mode.value === "inc" ? roundTo(s, 2) : roundTo(netSale + vatAmt, 2);

  const profit = roundTo(netSale - c, 2);
  const marginPct = netSale > 0 ? (profit / netSale) * 100 : NaN;
  const markupPct = c > 0 ? (profit / c) * 100 : (profit > 0 ? Infinity : NaN);

  const beEx = roundTo(c, 2);
  const beInc = roundTo(beEx * (1 + r), 2);

  setText("netSale", fmtMoney(netSale, ccy));
  setText("vatAmt", fmtMoney(vatAmt, ccy));
  setText("grossSale", fmtMoney(grossSale, ccy));
  setText("profit", fmtMoney(profit, ccy));
  setText("margin", isFinite(marginPct) ? fmtPct(marginPct, 2) : "—");
  setText("markup", markupPct === Infinity ? "∞" : (isFinite(markupPct) ? fmtPct(markupPct, 2) : "—"));
  setText("beEx", fmtMoney(beEx, ccy));
  setText("beInc", fmtMoney(beInc, ccy));
}

[currency, rate, mode, cost, sell].forEach((el) => {
  el.addEventListener("input", calc);
  el.addEventListener("change", calc);
});

copy.addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText(window.location.href);
    const old = copy.textContent;
    copy.textContent = "Copied";
    setTimeout(() => copy.textContent = old, 900);
  }catch{
    setError("err", "Clipboard blocked. Copy the URL from the address bar.");
  }
});

reset.addEventListener("click", () => {
  currency.value = "GBP";
  rate.value = "20";
  mode.value = "inc";
  cost.value = "";
  sell.value = "";
  setError("err", "");
  calc();
});

calc();
