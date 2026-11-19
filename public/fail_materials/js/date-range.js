(() => {
  "use strict";

  const input = document.getElementById("timeFilter");
  const toggle = document.getElementById("calendarToggle");
  const calendar = document.getElementById("dateRangeCalendar");
  const days = document.getElementById("calendarDays");
  const heading = document.getElementById("calendarMonth");
  const hint = document.getElementById("calendarHint");
  let month = new Date();
  month = new Date(month.getFullYear(), month.getMonth(), 1);
  let start = "";
  let end = "";
  let selectingEnd = false;
  let syncing = false;

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function displayDate(value) {
    return value.split("-").reverse().join("/");
  }

  function sync() {
    input.setCustomValidity("");
    input.dataset.startDate = start;
    input.dataset.endDate = end || start;
    input.value = start ? displayDate(start) + (end && end !== start ? ` – ${displayDate(end)}` : "") : "";
    syncing = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    syncing = false;
  }

  function render() {
    heading.textContent = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    hint.textContent = selectingEnd ? "Select end date, or Done for one day" : "Select start date";
    days.replaceChildren();
    const offset = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < offset; i++) days.append(document.createElement("span"));
    for (let day = 1; day <= count; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const key = dateKey(date);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = day;
      button.dataset.date = key;
      button.setAttribute("aria-label", date.toLocaleDateString("en-GB", { dateStyle: "full" }));
      button.setAttribute("aria-pressed", String(key === start || key === end));
      if (key === start || key === end) button.classList.add("selected");
      if (start && end && key > start && key < end) button.classList.add("in-range");
      if (key === dateKey(new Date())) button.setAttribute("aria-current", "date");
      days.append(button);
    }
  }

  function close(restoreFocus = false) {
    calendar.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) input.focus();
  }

  function open() {
    calendar.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    render();
    const target = days.querySelector(`[data-date="${start || dateKey(new Date())}"]`) || days.querySelector("button");
    target.focus();
  }

  toggle.addEventListener("click", () => calendar.hidden ? open() : close());
  function parseInput(normalize = true) {
    if (syncing) return;
    const value = input.value.trim()
      .replace(/\s*–\s*__\/__\/____$/, "")
      .replace(/^__\/__\/____$/, "");
    if (!value) {
      clear();
      return;
    }
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*[–—-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4}))?$/);
    const parse = (day, monthNumber, year) => {
      const key = `${year}-${monthNumber.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const date = new Date(`${key}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key
        && key >= "0001-01-01" && key < "9999-12-31" ? key : "";
    };
    const first = match ? parse(match[1], match[2], match[3]) : "";
    const last = match ? (match[4] ? parse(match[4], match[5], match[6]) : first) : "";
    if (!first || !last || last < first) {
      input.setCustomValidity("Enter dd/mm/yyyy or dd/mm/yyyy – dd/mm/yyyy, with the end date on or after the start date.");
      return;
    }
    start = first;
    end = last;
    selectingEnd = false;
    month = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
    if (normalize) sync();
    else {
      input.dataset.startDate = start;
      input.dataset.endDate = end;
      input.setCustomValidity("");
    }
    render();
  }
  function formatTypedDate(digits) {
    const padded = digits.padEnd(8, "_");
    return `${padded.slice(0, 2)}/${padded.slice(2, 4)}/${padded.slice(4, 8)}`;
  }

  input.addEventListener("focus", () => {
    if (!input.value) {
      input.value = "__/__/____ – __/__/____";
      input.setSelectionRange(0, 0);
    }
  });
  input.addEventListener("blur", () => parseInput());
  input.addEventListener("input", (event) => {
    if (!event.isComposing && !event.inputType?.startsWith("delete")) {
      const caret = input.selectionStart;
      const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, "").length;
      const digits = input.value.replace(/\D/g, "").slice(0, 16);
      input.value = formatTypedDate(digits.slice(0, 8))
        + " – " + formatTypedDate(digits.slice(8));
      let position = 0;
      let count = 0;
      while (position < input.value.length && count < digitsBeforeCaret) {
        if (/\d/.test(input.value[position])) count++;
        position++;
      }
      while (position < input.value.length && /[/ –]/.test(input.value[position])) position++;
      input.setSelectionRange(position, position);
    }
    input.setCustomValidity("");
    parseInput(false);
  });
  input.addEventListener("change", parseInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open();
    }
  });
  days.addEventListener("click", (event) => {
    const key = event.target.dataset.date;
    if (!key) return;
    if (!selectingEnd) {
      start = key;
      end = "";
      selectingEnd = true;
    } else {
      end = key;
      if (end < start) [start, end] = [end, start];
      selectingEnd = false;
    }
    sync();
    render();
    if (!selectingEnd) close(true);
    else days.querySelector(`[data-date="${key}"]`).focus();
  });
  document.getElementById("calendarPrev").addEventListener("click", () => {
    month.setMonth(month.getMonth() - 1);
    render();
  });
  document.getElementById("calendarNext").addEventListener("click", () => {
    month.setMonth(month.getMonth() + 1);
    render();
  });
  function clear() {
    start = end = "";
    selectingEnd = false;
    sync();
    render();
  }
  document.getElementById("calendarClear").addEventListener("click", clear);
  document.getElementById("calendarDone").addEventListener("click", () => {
    selectingEnd = false;
    close(true);
  });
  input.addEventListener("date-range-reset", () => {
    clear();
    close();
  });
  document.addEventListener("click", (event) => {
    if (!event.composedPath().includes(toggle) && !event.composedPath().includes(calendar) && event.target !== input) close();
  });
  calendar.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("focusin", (event) => {
    if (!event.target.closest(".date-range-field")) close();
  });
})();
