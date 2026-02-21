import { parseNumber, roundTo, fmtPct, setText, setError } from "./utils.js";

function fmtNum(n){
  if (!isFinite(n)) return "—";
  const v = roundTo(n, 4);
  const txt = Math.abs(v) >= 1000 ? v.toLocaleString("en-GB") : String(v);
  return txt;
}

const p1a = document.getElementById("p1_a");
const p1b = document.getElementById("p1_b");

const p2a = document.getElementById("p2_a");
const p2b = document.getElementById("p2_b");

const p3a = document.getElementById("p3_a");
const p3b = document.getElementById("p3_b");

const p4a = document.getElementById("p4_a");
const p4b = document.getElementById("p4_b");

const p5a = document.getElementById("p5_a");
const p5b = document.getElementById("p5_b");

const p6mode = document.getElementById("p6_mode");
const p6a = document.getElementById("p6_a");
const p6b = document.getElementById("p6_b");

function calc1(){
  const A = parseNumber(p1a.value);
  const B = parseNumber(p1b.value);
  if (!isFinite(A) || !isFinite(B)){
    setText("p1_out", "—");
    setText("p1_frac", "—");
    return;
  }
  const frac = A / 100;
  setText("p1_out", fmtNum(frac * B));
  setText("p1_frac", fmtNum(frac));
}

function calc2(){
  const A = parseNumber(p2a.value);
  const B = parseNumber(p2b.value);
  if (!isFinite(A) || !isFinite(B)){
    setError("p2_err", "");
    setText("p2_out", "—");
    setText("p2_ratio", "—");
    return;
  }
  if (B === 0){
    setError("p2_err", "B cannot be 0.");
    setText("p2_out", "—");
    setText("p2_ratio", "—");
    return;
  }
  setError("p2_err", "");
  const ratio = A / B;
  setText("p2_out", fmtPct(ratio * 100, 2));
  setText("p2_ratio", fmtNum(ratio));
}

function calc3(){
  const A = parseNumber(p3a.value);
  const B = parseNumber(p3b.value);
  if (!isFinite(A) || !isFinite(B)){
    setText("p3_out", "—");
    setText("p3_delta", "—");
    return;
  }
  const delta = (A / 100) * B;
  setText("p3_out", fmtNum(B + delta));
  setText("p3_delta", fmtNum(delta));
}

function calc4(){
  const A = parseNumber(p4a.value);
  const B = parseNumber(p4b.value);
  if (!isFinite(A) || !isFinite(B)){
    setText("p4_out", "—");
    setText("p4_delta", "—");
    return;
  }
  const delta = (A / 100) * B;
  setText("p4_out", fmtNum(B - delta));
  setText("p4_delta", fmtNum(delta));
}

function calc5(){
  const A = parseNumber(p5a.value);
  const B = parseNumber(p5b.value);
  if (!isFinite(A) || !isFinite(B)){
    setError("p5_err", "");
    setText("p5_out", "—");
    setText("p5_delta", "—");
    return;
  }
  if (A === 0){
    setError("p5_err", "Old value (A) cannot be 0.");
    setText("p5_out", "—");
    setText("p5_delta", "—");
    return;
  }
  setError("p5_err", "");
  const delta = B - A;
  const pct = (delta / A) * 100;
  const sign = pct > 0 ? "+" : "";
  setText("p5_out", `${sign}${fmtPct(pct, 2)}`);
  setText("p5_delta", fmtNum(delta));
}

function calc6(){
  const mode = p6mode.value;
  const A = parseNumber(p6a.value);
  const B = parseNumber(p6b.value);
  if (!isFinite(A) || !isFinite(B)){
    setError("p6_err", "");
    setText("p6_out", "—");
    setText("p6_mult", "—");
    return;
  }
  const m = A / 100;
  const mult = mode === "inc" ? (1 + m) : (1 - m);
  if (mult === 0){
    setError("p6_err", "Multiplier cannot be 0.");
    setText("p6_out", "—");
    setText("p6_mult", "—");
    return;
  }
  setError("p6_err", "");
  setText("p6_out", fmtNum(B / mult));
  setText("p6_mult", fmtNum(mult));
}

[p1a,p1b].forEach(el => el.addEventListener("input", calc1));
[p2a,p2b].forEach(el => el.addEventListener("input", calc2));
[p3a,p3b].forEach(el => el.addEventListener("input", calc3));
[p4a,p4b].forEach(el => el.addEventListener("input", calc4));
[p5a,p5b].forEach(el => el.addEventListener("input", calc5));
[p6mode,p6a,p6b].forEach(el => el.addEventListener("input", calc6));
p6mode.addEventListener("change", calc6);

calc1(); calc2(); calc3(); calc4(); calc5(); calc6();
