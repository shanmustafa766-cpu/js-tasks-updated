"use strict";

const guessInput = document.getElementById("guess");
const guessBtn = document.getElementById("guessBtn");
const playAgainBtn = document.getElementById("playAgain");
const answer = document.getElementById("answer");
const atm = document.getElementById("attempt");
const cmt = document.getElementById("comment");
const bestEl = document.getElementById("best");
const form = document.getElementById("guessForm");

const BEST_KEY = "guessBest";
const min = 1;
const max = 15;

function newTarget() {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let target = newTarget();
let attempt = 0;
const guessed = new Set();

function loadBest() {
    try {
        const value = Number(localStorage.getItem(BEST_KEY));
        return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

function saveBest(value) {
    try {
        localStorage.setItem(BEST_KEY, String(value));
    } catch {
        // Storage not available; the score simply isn't remembered.
    }
}

let best = loadBest();

function showBest() {
    bestEl.textContent = best === null ? "" : "Best: " + best + (best === 1 ? " attempt" : " attempts");
}

showBest();

form.addEventListener("submit", (e) => {
    e.preventDefault();
    guessing();
});

playAgainBtn.addEventListener("click", startNewRound);

function attemptLabel(n) {
    return (n === 1 ? "Attempt: " : "Attempts: ") + n;
}

function rejectGuess(text) {
    answer.textContent = text;
    guessInput.value = "";
    guessInput.focus();
}

function guessing() {
    const raw = guessInput.value.trim();
    const guess = Number(raw);

    // Whole numbers only, inside the range.
    if (!/^\d+$/.test(raw) || guess < min || guess > max) {
        rejectGuess("⚠ Please enter a whole number between " + min + " and " + max + ".");
        return;
    }

    if (guessed.has(guess)) {
        rejectGuess("⚠ You already tried " + guess + "!");
        return;
    }

    guessed.add(guess);
    attempt++;
    cmt.textContent = "Your guess: " + guess;
    atm.textContent = attemptLabel(attempt);

    if (guess < target) {
        answer.textContent = "Too low!";
    } else if (guess > target) {
        answer.textContent = "Too high!";
    } else {
        finishRound(guess);
        return;
    }

    guessInput.value = "";
    guessInput.focus();
}

function finishRound(guess) {
    answer.textContent = "🥇 Correct! " + guess + " was right. You got it in " +
        attempt + (attempt === 1 ? " attempt." : " attempts.");

    if (best === null || attempt < best) {
        best = attempt;
        saveBest(best);
    }
    showBest();

    guessInput.value = "";
    guessInput.disabled = true;
    guessBtn.disabled = true;
    playAgainBtn.hidden = false;
    playAgainBtn.focus();
}

function startNewRound() {
    target = newTarget();
    attempt = 0;
    guessed.clear();

    cmt.textContent = "";
    atm.textContent = "";
    answer.textContent = "I picked a new number between " + min + " and " + max + ".";

    guessInput.disabled = false;
    guessBtn.disabled = false;
    playAgainBtn.hidden = true;
    guessInput.focus();
}