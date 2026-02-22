export function parseNumber(v){
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return NaN;
  return Number(s);
}

export function roundTo(n, dp = 2){
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function fmtMoney(n, currency = "GBP", locale = "en-GB"){
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, { style:"currency", currency }).format(n);
}

export function fmtPct(n, dp = 2){
  if (!isFinite(n)) return "—";
  return `${roundTo(n, dp)}%`;
}

export function setText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function setError(id, msg){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", function(){
  var el = document.querySelectorAll("[data-currency]");
  if(!el.length) return;
  var locale = (navigator.language || "").toLowerCase();
  var symbol = locale.includes("gb") ? "£" : "$";
  for(var i=0;i<el.length;i++){
    el[i].textContent = symbol;
  }
});