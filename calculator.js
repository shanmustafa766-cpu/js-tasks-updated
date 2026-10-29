"use strict";

const OPERATORS = "+-*/";
const MAX_RESULT = 1e15;
const MAX_INPUT_LENGTH = 40;

const inp = document.getElementById("inp");
const resultEl = document.getElementById("result");
let justEvaluated = false;
let errorTimer = null;

// Grammar:
//   expression := term (("+" | "-") term)*
//   term       := factor (("*" | "/") factor)*
//   factor     := ("+" | "-")* number
// Throws "bad" for a malformed expression, "div0" for x/0, "nan0" for 0/0.
function evaluate(text) {
    const expr = text.replace(/\s+/g, "");
    if (expr === "") throw new Error("bad");
    const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/]/g);
    if (!tokens || tokens.join("") !== expr) throw new Error("bad");
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function factor() {
        let sign = 1;
        while (peek() === "+" || peek() === "-") {
            if (next() === "-") sign = -sign;
        }
        const t = next();
        if (t === undefined || /^[+\-*/]$/.test(t)) throw new Error("bad");
        return sign * Number(t);
    }

    function term() {
        let value = factor();
        while (peek() === "*" || peek() === "/") {
            const op = next();
            const right = factor();
            if (op === "/" && right === 0) {
                if (value === 0) throw new Error("nan0");
                throw new Error("div0");
            }
            value = op === "*" ? value * right : value / right;
        }
        return value;
    }

    function expression() {
        let value = term();
        while (peek() === "+" || peek() === "-") {
            const op = next();
            const right = term();
            value = op === "+" ? value + right : value - right;
        }
        return value;
    }

    const result = expression();
    if (pos < tokens.length) throw new Error("bad");
    return result;
}

// Integers below 1e15 are exact, so print directly.
// Non-integers get 12 significant digits to hide float noise.
function formatResult(n) {
    if (n === 0) return "0";
    if (Number.isInteger(n)) return String(n);
    if (Math.abs(n) < 1e-12) return "0";
    let s = String(Number(n.toPrecision(12)));
    if (s.includes("e")) {
        s = n.toFixed(12);
        if (s.includes(".")) s = s.replace(/\.?0+$/, "");
    }
    return s;
}

document.querySelector(".output").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const key = btn.dataset.key;
    const action = btn.dataset.action;
    if (key) appendToDisplay(key);
    else if (action === "clear") clearDisplay();
    else if (action === "delete") deleteLast();
    else if (action === "calc") calculate();
    if (e.detail > 0) btn.blur();
});

function clearError() {
    if (errorTimer) {
        clearTimeout(errorTimer);
        errorTimer = null;
        inp.value = "";
        resultEl.textContent = "";
    }
}

function appendToDisplay(ch) {
    clearError();
    if (justEvaluated) {
        if (/[0-9.]/.test(ch)) inp.value = "";
        justEvaluated = false;
    }
    if (inp.value.length >= MAX_INPUT_LENGTH) return;
    const value = inp.value;
    const last = value.slice(-1);
    const beforeLast = value.slice(-2, -1);

    if (OPERATORS.includes(ch)) {
        if (value === "") {
            if (ch === "-") inp.value = "-";
            return;
        }
        if (OPERATORS.includes(last)) {
            if (ch === "-" && (last === "*" || last === "/")) {
                inp.value += ch;
                return;
            }
            if (OPERATORS.includes(beforeLast) && last === "-") {
                inp.value = value.slice(0, -2) + ch;
                return;
            }
            inp.value = value.slice(0, -1) + ch;
            return;
        }
        inp.value += ch;
        return;
    }

    const current = value.split(/[+\-*/]/).pop();
    if (ch === ".") {
        if (current.includes(".")) return;
        if (current === "") { inp.value += "0."; return; }
        inp.value += ".";
        return;
    }
    if (current === "0") {
        if (ch === "0" || ch === "00") return;
        inp.value = value.slice(0, -1) + ch;
        return;
    }
    if (current === "" && ch === "00") { inp.value += "0"; return; }
    inp.value += ch;
}

function clearDisplay() {
    clearError();
    inp.value = "";
    justEvaluated = false;
    resultEl.textContent = "";
}

function deleteLast() {
    clearError();
    inp.value = inp.value.slice(0, -1);
    justEvaluated = false;
}

function showError(msg) {
    inp.value = msg;
    resultEl.textContent = msg;
    justEvaluated = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
        inp.value = "";
        resultEl.textContent = "";
        errorTimer = null;
    }, 2000);
}

function calculate() {
    if (inp.value.trim() === "") return;

    // Ignore a trailing operator (5+ = 5), like most calculators.
    let expr = inp.value;
    while (expr !== "" && OPERATORS.includes(expr.slice(-1))) {
        expr = expr.slice(0, -1);
    }
    if (expr === "") return;

    try {
        const result = evaluate(expr);
        if (Number.isNaN(result)) { showError("Invalid operation"); return; }
        if (!Number.isFinite(result)) { showError("Cannot divide by 0"); return; }
        if (Math.abs(result) >= MAX_RESULT) { showError("Number too large"); return; }
        inp.value = formatResult(result);
        resultEl.textContent = inp.value;
        justEvaluated = true;
    } catch (error) {
        if (error.message === "nan0") showError("Invalid operation");
        else if (error.message === "div0") showError("Cannot divide by 0");
        else showError("ERROR!");
    }
}

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === "Enter" || e.key === " ") && e.target.closest("button")) return;
    const isDigit = /^[0-9.]$/.test(e.key);
    const isOperator = OPERATORS.includes(e.key) && e.key.length === 1;
    const isEnter = e.key === "Enter" || e.key === "=";
    const isBackspace = e.key === "Backspace";
    const isEscape = e.key === "Escape";
    if (!isDigit && !isOperator && !isEnter && !isBackspace && !isEscape) return;
    e.preventDefault();
    if (isDigit || isOperator) appendToDisplay(e.key);
    else if (isEnter) calculate();
    else if (isBackspace) deleteLast();
    else if (isEscape) clearDisplay();
});