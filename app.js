const DATA_BASE = "data/";
const MAX_RESULTS = 6;

let stations = {};
let services = {};
let entries = [];

async function load() {
  try {
    const [s, d] = await Promise.all([
      fetch(DATA_BASE + "stations.json").then(r => r.json()),
      fetch(DATA_BASE + "direct_services.json").then(r => r.json()),
    ]);
    stations = s;
    services = d;
  } catch (err) {
    document.getElementById("results").innerHTML =
      "<p>Couldn't load timetable data. If you've just cloned the repo, run the build step first.</p>";
    return;
  }

  entries = Object.entries(stations)
    .map(([crs, info]) => ({
      crs,
      name: info.name,
      nameLower: info.name.toLowerCase(),
      crsLower: crs.toLowerCase(),
      words: info.name.toLowerCase().split(/\s+/),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  createCombobox(document.getElementById("from-combo"));
  createCombobox(document.getElementById("to-combo"));
}

function rank(q, e) {
  if (!q) return 100;
  if (e.nameLower.startsWith(q)) return 0;
  if (e.words.some(w => w.startsWith(q))) return 1;
  if (e.crsLower.startsWith(q)) return 2;
  if (e.nameLower.includes(q)) return 3;
  return -1;
}

function search(query) {
  const q = query.trim().toLowerCase();
  const scored = [];
  for (const e of entries) {
    const s = rank(q, e);
    if (s >= 0) scored.push({ e, s });
  }
  scored.sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, MAX_RESULTS).map(x => x.e);
}

function createCombobox(root) {
  const input = root.querySelector("input");
  const clearBtn = root.querySelector(".combo-clear");
  const list = root.querySelector(".combo-list");
  let items = [];
  let highlight = -1;
  let selected = null;

  function renderOptions(next) {
    items = next;
    list.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "combo-empty";
      li.textContent = "No matches";
      list.appendChild(li);
      open();
      highlight = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const li = document.createElement("li");
      li.id = `${list.id}-opt-${i}`;
      li.setAttribute("role", "option");
      li.dataset.index = String(i);
      li.innerHTML = `${escapeHtml(items[i].name)}<span class="crs">${items[i].crs}</span>`;
      list.appendChild(li);
    }
    open();
    setHighlight(0);
  }

  function open() {
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    highlight = -1;
  }

  function setHighlight(i) {
    const nodes = list.querySelectorAll('li[role="option"]');
    if (!nodes.length) return;
    if (highlight >= 0 && nodes[highlight]) nodes[highlight].classList.remove("hl");
    highlight = Math.max(0, Math.min(nodes.length - 1, i));
    const node = nodes[highlight];
    node.classList.add("hl");
    input.setAttribute("aria-activedescendant", node.id);
    node.scrollIntoView({ block: "nearest" });
  }

  function choose(entry) {
    selected = entry.crs;
    input.value = `${entry.name} (${entry.crs})`;
    input.readOnly = true;
    root.classList.add("is-selected");
    clearBtn.hidden = false;
    close();
  }

  function clearSelection({ focus = true } = {}) {
    selected = null;
    input.value = "";
    input.readOnly = false;
    root.classList.remove("is-selected");
    clearBtn.hidden = true;
    if (focus) {
      input.focus();
      renderOptions(search(""));
    }
  }

  let blurTimer = null;

  input.addEventListener("focus", () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    if (!selected) renderOptions(search(input.value));
  });

  input.addEventListener("input", () => {
    if (selected) return;
    renderOptions(search(input.value));
  });

  input.addEventListener("keydown", (e) => {
    if (selected) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        clearSelection();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.hidden) renderOptions(search(input.value));
      else setHighlight(highlight + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!list.hidden) setHighlight(highlight - 1);
    } else if (e.key === "Enter") {
      if (!list.hidden && highlight >= 0 && items[highlight]) {
        e.preventDefault();
        choose(items[highlight]);
      }
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Tab") {
      close();
    }
  });

  input.addEventListener("blur", () => {
    blurTimer = setTimeout(() => { close(); blurTimer = null; }, 120);
  });

  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    e.preventDefault();
    const idx = Number(li.dataset.index);
    if (items[idx]) choose(items[idx]);
  });

  list.addEventListener("mouseover", (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    setHighlight(Number(li.dataset.index));
  });

  clearBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    clearSelection();
  });

  input.addEventListener("invalid", () => {
    setTimeout(() => {
      if (document.activeElement === input) {
        input.blur();
        input.focus();
      }
    }, 1500);
  });

  root._getCrs = () => selected;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function bfs(start) {
  const dist = new Map();
  dist.set(start, 0);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    const next = dist.get(node) + 1;
    for (const n of services[node] || []) {
      if (!dist.has(n)) {
        dist.set(n, next);
        queue.push(n);
      }
    }
  }
  return dist;
}

function findMeetingPoints(from, to, maxChanges) {
  const distA = bfs(from);
  const distB = bfs(to);
  const direct = (services[from] || []).includes(to);
  const points = [];
  for (const [crs, dA] of distA) {
    if (crs === from || crs === to) continue;
    const dB = distB.get(crs);
    if (dB === undefined) continue;
    const chA = dA - 1;
    const chB = dB - 1;
    if (chA > maxChanges || chB > maxChanges) continue;
    points.push({ crs, chA, chB });
  }
  const groupMap = new Map();
  for (const p of points) {
    const key = `${p.chA},${p.chB}`;
    if (!groupMap.has(key)) groupMap.set(key, { chA: p.chA, chB: p.chB, arr: [] });
    groupMap.get(key).arr.push(p.crs);
  }
  const groups = [...groupMap.values()];
  groups.sort((a, b) =>
    Math.max(a.chA, a.chB) - Math.max(b.chA, b.chB) ||
    (a.chA + a.chB) - (b.chA + b.chB) ||
    a.chA - b.chA
  );
  for (const g of groups) {
    g.arr.sort((x, y) => stations[x].name.localeCompare(stations[y].name));
  }
  return { direct, groups };
}

function changesLabel(n) {
  if (n === 0) return "direct";
  if (n === 1) return "1 change";
  return `${n} changes`;
}

function stationLabel(crs) {
  const info = stations[crs];
  return info ? `${escapeHtml(info.name)} <small>(${crs})</small>` : crs;
}

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const results = document.getElementById("results");
  const from = document.getElementById("from-combo")._getCrs();
  const to = document.getElementById("to-combo")._getCrs();

  if (!from || !to) {
    results.innerHTML = "<p>Pick a station from the dropdown for both fields.</p>";
    return;
  }
  if (from === to) {
    results.innerHTML = "<p>Pick two different stations.</p>";
    return;
  }

  const maxChanges = Number(document.getElementById("max-changes").value);
  const { direct, groups } = findMeetingPoints(from, to, maxChanges);
  const fromName = escapeHtml(stations[from].name);
  const toName = escapeHtml(stations[to].name);
  let html = "";

  if (direct) {
    html += `<p class="direct">✓ Direct trains run between <strong>${fromName}</strong> and <strong>${toName}</strong>.</p>`;
  } else {
    html += `<p class="nodirect">No direct service between <strong>${fromName}</strong> and <strong>${toName}</strong>.</p>`;
  }

  const total = groups.reduce((n, g) => n + g.arr.length, 0);
  if (!total) {
    const limit = maxChanges === 0
      ? "with a direct service from both"
      : `within ${changesLabel(maxChanges)} each`;
    html += `<p>No meeting points ${limit}.</p>`;
  } else {
    html += `<h2>Meeting points <small>(${total})</small></h2>`;
    for (const g of groups) {
      const label = `${fromName} ${changesLabel(g.chA)} · ${toName} ${changesLabel(g.chB)}`;
      html += `<h3>${label} <small>(${g.arr.length})</small></h3><ul>`;
      for (const crs of g.arr) html += `<li>${stationLabel(crs)}</li>`;
      html += `</ul>`;
    }
  }

  results.innerHTML = html;
});

load();
