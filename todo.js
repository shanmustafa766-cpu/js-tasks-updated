"use strict";

const STORAGE_KEY = "myTodos";
const MAX_LENGTH = 200;
const inp = document.getElementById("inp");
const msg = document.getElementById("msg");
const tbody = document.getElementById("result");
const filterBtns = document.querySelectorAll(".filters [data-filter]");
const clearCompletedBtn = document.getElementById("clearCompleted");

// Probe localStorage once. A failing setItem is the only signal that
// storage is unavailable (private mode, quota, blocked).
let storageOk = (() => {
    try {
        const test = "__probe__" + Date.now();
        localStorage.setItem(test, "1");
        localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
})();

function newId() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

// Set when loadTasks gives an ID to a task that had none.
// The caller saves immediately so the new IDs stick.
let addedIds = false;

// Read the task list from storage. Always returns an array.
// Corrupt JSON or an invalid shape yields [], without flipping storageOk.
function loadTasks() {
    if (!storageOk) return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cleaned = [];
        for (const t of parsed) {
            if (!t || typeof t.content !== "string") continue;
            const hasId = typeof t.id === "string" && t.id;
            if (!hasId) addedIds = true;
            cleaned.push({
                id: hasId ? t.id : newId(),
                content: t.content,
                completed: t.completed === true
            });
        }
        return cleaned;
    } catch {
        return [];
    }
}

function saveToStorage() {
    if (!storageOk) {
        msg.textContent = "Changes are temporary (storage unavailable).";
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        addedIds = false;
        msg.textContent = "";
    } catch {
        storageOk = false;
        msg.textContent = "Changes are temporary (storage unavailable).";
    }
}

let tasks = loadTasks();
if (addedIds) saveToStorage();

let editingId = null;
let editDraft = null;
let pendingDeleteId = null;
let deleteTimer = null;
let focusRequest = null;
let currentFilter = "all";

let pendingClear = false;
let clearTimer = null;

renderTasks();

// Reload from storage, then look up by id. Avoids acting on a stale index.
function getTaskById(id) {
    if (storageOk) tasks = loadTasks();
    return tasks.find((t) => t.id === id);
}

// Keep two open tabs in sync.
window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    tasks = loadTasks();
    if (addedIds) saveToStorage();
    if (editingId && !tasks.some((t) => t.id === editingId)) editingId = null;
    if (pendingDeleteId && !tasks.some((t) => t.id === pendingDeleteId)) pendingDeleteId = null;
    renderTasks();
});

filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;
        // Changing the filter can hide the row being edited.
        editingId = null;
        editDraft = null;
        filterBtns.forEach((b) => {
            const on = b === btn;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", String(on));
        });
        renderTasks();
    });
});

// Two-click confirm instead of blocking confirm().
clearCompletedBtn.addEventListener("click", () => {
    if (storageOk) tasks = loadTasks();
    const doneCount = tasks.filter((t) => t.completed).length;
    if (doneCount === 0) return;

    if (!pendingClear) {
        pendingClear = true;
        clearCompletedBtn.textContent = "Sure? (" + doneCount + ")";
        clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
            pendingClear = false;
            clearCompletedBtn.textContent = "Clear completed";
        }, 3000);
        return;
    }

    clearTimeout(clearTimer);
    pendingClear = false;
    clearCompletedBtn.textContent = "Clear completed";
    tasks = tasks.filter((t) => !t.completed);
    saveToStorage();
    renderTasks();
});

document.getElementById("todoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addTask();
});

function addTask() {
    const text = inp.value.trim();
    if (text === "") {
        msg.textContent = "Please enter a task.";
        inp.focus();
        return;
    }
    if (storageOk) tasks = loadTasks();
    tasks.push({ id: newId(), content: text, completed: false });
    inp.value = "";
    saveToStorage();
    renderTasks();
    inp.focus();
}

function toggleStatus(id) {
    const task = getTaskById(id);
    if (task) {
        task.completed = !task.completed;
        saveToStorage();
    }
    // Under "Active", a completed task disappears from view.
    // Send focus to the input instead of losing it to the page body.
    if (currentFilter === "active") {
        focusRequest = { id: null, selector: null, fallback: "inp" };
    } else {
        focusRequest = { id, selector: "input[type='checkbox']" };
    }
    renderTasks();
}

function startEdit(id) {
    editingId = id;
    pendingDeleteId = null;
    msg.textContent = "";
    focusRequest = { id, selector: ".edit-input" };
    renderTasks();
}

function cancelEdit(id) {
    editingId = null;
    editDraft = null;
    msg.textContent = "";
    focusRequest = { id, selector: ".edit-btn" };
    renderTasks();
}

function saveEdit(id, value) {
    const text = value.trim();
    if (text === "") {
        msg.textContent = "Task can't be empty.";
        return;
    }
    if (text.length > MAX_LENGTH) {
        msg.textContent = "Task is too long (max " + MAX_LENGTH + " characters).";
        return;
    }
    const task = getTaskById(id);
    if (task) {
        task.content = text;
        saveToStorage();
        msg.textContent = "";
    } else {
        msg.textContent = "That task no longer exists.";
    }
    editingId = null;
    editDraft = null;
    focusRequest = { id, selector: ".edit-btn" };
    renderTasks();
}

// A single click marks the row "Sure?"; a second click within 3s deletes it.
function requestDelete(id) {
    if (pendingDeleteId !== id) {
        pendingDeleteId = id;
        clearTimeout(deleteTimer);
        deleteTimer = setTimeout(() => {
            pendingDeleteId = null;
            renderTasks();
        }, 3000);
        focusRequest = { id, selector: ".delete-btn" };
        renderTasks();
        return;
    }
    clearTimeout(deleteTimer);
    pendingDeleteId = null;
    if (storageOk) tasks = loadTasks();
    tasks = tasks.filter((t) => t.id !== id);
    saveToStorage();
    inp.focus();
    renderTasks();
}

function renderTasks() {
    // Preserve the text typed into an open edit box across re-renders.
    if (editingId) {
        const openInput = tbody.querySelector(".edit-input");
        if (openInput) {
            editDraft = { id: openInput.dataset.id, value: openInput.value };
        }
    }

    tbody.replaceChildren();

    const visible = tasks.filter((t) => {
        if (currentFilter === "active") return !t.completed;
        if (currentFilter === "done") return t.completed;
        return true;
    });

    clearCompletedBtn.disabled = !tasks.some((t) => t.completed);

    if (visible.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "empty";
        if (tasks.length === 0) td.textContent = "No tasks yet. Add one above!";
        else if (currentFilter === "active") td.textContent = "No active tasks.";
        else if (currentFilter === "done") td.textContent = "No completed tasks.";
        else td.textContent = "No tasks to show.";
        tr.appendChild(td);
        tbody.appendChild(tr);

        // Empty list: restore focus and clear the request.
        if (focusRequest && focusRequest.fallback) {
            document.getElementById(focusRequest.fallback).focus();
        }
        focusRequest = null;
        return;
    }

    for (const task of visible) {
        const isEditing = task.id === editingId;
        const tr = document.createElement("tr");
        tr.dataset.id = task.id;

        const tdCheck = document.createElement("td");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = task.completed;
        cb.setAttribute("aria-label", "Mark task as done: " + task.content);
        cb.addEventListener("change", () => toggleStatus(task.id));
        tdCheck.appendChild(cb);

        const tdText = document.createElement("td");
        const tdEdit = document.createElement("td");
        const tdDel = document.createElement("td");

        if (isEditing) {
            const field = document.createElement("input");
            field.type = "text";
            field.className = "edit-input";
            field.dataset.id = task.id;
            field.maxLength = MAX_LENGTH;
            field.setAttribute("aria-label", "Edit task text");
            field.value = (editDraft && editDraft.id === task.id)
                ? editDraft.value
                : task.content;
            field.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit(task.id, field.value);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit(task.id);
                }
            });
            tdText.appendChild(field);

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "save-btn";
            saveBtn.textContent = "Save";
            saveBtn.setAttribute("aria-label", "Save changes");
            saveBtn.addEventListener("click", () => saveEdit(task.id, field.value));
            tdEdit.appendChild(saveBtn);

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "cancel-btn";
            cancelBtn.textContent = "Cancel";
            cancelBtn.setAttribute("aria-label", "Cancel editing");
            cancelBtn.addEventListener("click", () => cancelEdit(task.id));
            tdDel.appendChild(cancelBtn);
        } else {
            tdText.textContent = task.content;
            if (task.completed) tdText.classList.add("completed");

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "edit-btn";
            editBtn.textContent = "Edit";
            editBtn.setAttribute("aria-label", "Edit task: " + task.content);
            editBtn.addEventListener("click", () => startEdit(task.id));
            tdEdit.appendChild(editBtn);

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "delete-btn";
            const confirming = task.id === pendingDeleteId;
            delBtn.textContent = confirming ? "Sure?" : "X";
            delBtn.setAttribute(
                "aria-label",
                (confirming ? "Click again to delete task: " : "Delete task: ") + task.content
            );
            delBtn.addEventListener("click", () => requestDelete(task.id));
            tdDel.appendChild(delBtn);
        }

        tr.append(tdCheck, tdText, tdEdit, tdDel);
        tbody.appendChild(tr);
    }

    // Restore focus after the table is rebuilt.
    if (focusRequest) {
        const row = focusRequest.id
            ? [...tbody.children].find((r) => r.dataset.id === focusRequest.id)
            : null;
        const el = row && focusRequest.selector
            ? row.querySelector(focusRequest.selector)
            : null;
        if (el) {
            el.focus();
            if (el.select) el.select();
        } else if (focusRequest.fallback) {
            document.getElementById(focusRequest.fallback).focus();
        }
        focusRequest = null;
    }
}