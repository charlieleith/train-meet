"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type StationInfo = { name: string };
export type Stations = Record<string, StationInfo>;
export type Services = Record<string, string[]>;

type Entry = {
  crs: string;
  name: string;
  nameLower: string;
  crsLower: string;
  words: string[];
};

type Group = { chA: number; chB: number; arr: string[] };
type Result = { direct: boolean; groups: Group[] };

const MAX_RESULTS = 6;

function rank(q: string, e: Entry): number {
  if (!q) return 100;
  if (e.nameLower.startsWith(q)) return 0;
  if (e.words.some((w) => w.startsWith(q))) return 1;
  if (e.crsLower.startsWith(q)) return 2;
  if (e.nameLower.includes(q)) return 3;
  return -1;
}

function search(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase();
  const scored: { e: Entry; s: number }[] = [];
  for (const e of entries) {
    const s = rank(q, e);
    if (s >= 0) scored.push({ e, s });
  }
  scored.sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, MAX_RESULTS).map((x) => x.e);
}

function bfs(services: Services, start: string): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(start, 0);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    const next = (dist.get(node) as number) + 1;
    for (const n of services[node] || []) {
      if (!dist.has(n)) {
        dist.set(n, next);
        queue.push(n);
      }
    }
  }
  return dist;
}

function findMeetingPoints(
  stations: Stations,
  services: Services,
  from: string,
  to: string,
  maxChanges: number,
): Result {
  const distA = bfs(services, from);
  const distB = bfs(services, to);
  const direct = (services[from] || []).includes(to);
  const points: { crs: string; chA: number; chB: number }[] = [];
  for (const [crs, dA] of distA) {
    if (crs === from || crs === to) continue;
    const dB = distB.get(crs);
    if (dB === undefined) continue;
    const chA = dA - 1;
    const chB = dB - 1;
    if (chA > maxChanges || chB > maxChanges) continue;
    points.push({ crs, chA, chB });
  }
  const groupMap = new Map<string, Group>();
  for (const p of points) {
    const key = `${p.chA},${p.chB}`;
    let g = groupMap.get(key);
    if (!g) {
      g = { chA: p.chA, chB: p.chB, arr: [] };
      groupMap.set(key, g);
    }
    g.arr.push(p.crs);
  }
  const groups = [...groupMap.values()];
  groups.sort(
    (a, b) =>
      Math.max(a.chA, a.chB) - Math.max(b.chA, b.chB) ||
      a.chA + a.chB - (b.chA + b.chB) ||
      a.chA - b.chA,
  );
  for (const g of groups) {
    g.arr.sort((x, y) => stations[x].name.localeCompare(stations[y].name));
  }
  return { direct, groups };
}

function changesLabel(n: number): string {
  if (n === 0) return "direct";
  if (n === 1) return "1 change";
  return `${n} changes`;
}

type ComboProps = {
  label: string;
  placeholder: string;
  entries: Entry[];
  value: Entry | null;
  onChange: (e: Entry | null) => void;
};

function Combobox({ label, placeholder, entries, value, onChange }: ComboProps) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const items = useMemo(
    () => (value ? [] : search(entries, query)),
    [entries, query, value],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlight >= items.length) setHighlight(Math.max(0, items.length - 1));
  }, [items, highlight]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(
      `li[data-index="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const choose = useCallback(
    (entry: Entry) => {
      onChange(entry);
      setQuery("");
      setOpen(false);
    },
    [onChange],
  );

  const clear = useCallback(
    ({ focus = true } = {}) => {
      onChange(null);
      setQuery("");
      if (focus) {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          setOpen(true);
        });
      }
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (value) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        clear();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(items.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && items[highlight]) {
        e.preventDefault();
        choose(items[highlight]);
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };

  const displayValue = value ? `${value.name} (${value.crs})` : query;
  const activeId =
    open && items.length > 0 ? `${listId}-opt-${highlight}` : undefined;

  return (
    <div className={`combobox${value ? " is-selected" : ""}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className="combo-control">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          required
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          placeholder={placeholder}
          value={displayValue}
          readOnly={!!value}
          onFocus={() => {
            if (blurTimer.current) {
              clearTimeout(blurTimer.current);
              blurTimer.current = null;
            }
            if (!value) setOpen(true);
          }}
          onChange={(e) => {
            if (value) return;
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              blurTimer.current = null;
            }, 120);
          }}
        />
        {value && (
          <button
            type="button"
            className="combo-clear"
            aria-label="Clear"
            onMouseDown={(e) => {
              e.preventDefault();
              clear();
            }}
          >
            ×
          </button>
        )}
      </div>
      <ul
        ref={listRef}
        id={listId}
        className="combo-list"
        role="listbox"
        hidden={!open || !!value}
        onMouseDown={(e) => {
          const li = (e.target as HTMLElement).closest<HTMLLIElement>(
            'li[role="option"]',
          );
          if (!li) return;
          e.preventDefault();
          const idx = Number(li.dataset.index);
          if (items[idx]) choose(items[idx]);
        }}
        onMouseOver={(e) => {
          const li = (e.target as HTMLElement).closest<HTMLLIElement>(
            'li[role="option"]',
          );
          if (!li) return;
          setHighlight(Number(li.dataset.index));
        }}
      >
        {items.length === 0 ? (
          <li className="combo-empty">No matches</li>
        ) : (
          items.map((item, i) => (
            <li
              key={item.crs}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === highlight}
              data-index={i}
              className={i === highlight ? "hl" : undefined}
            >
              {item.name}
              <span className="crs">{item.crs}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

type ResultViewProps = {
  stations: Stations;
  from: Entry;
  to: Entry;
  maxChanges: number;
  result: Result;
};

function ResultView({ stations, from, to, maxChanges, result }: ResultViewProps) {
  const total = result.groups.reduce((n, g) => n + g.arr.length, 0);
  return (
    <>
      {result.direct ? (
        <p className="direct">
          ✓ Direct trains run between <strong>{from.name}</strong> and{" "}
          <strong>{to.name}</strong>.
        </p>
      ) : (
        <p className="nodirect">
          No direct service between <strong>{from.name}</strong> and{" "}
          <strong>{to.name}</strong>.
        </p>
      )}
      {total === 0 ? (
        <p>
          No meeting points{" "}
          {maxChanges === 0
            ? "with a direct service from both"
            : `within ${changesLabel(maxChanges)} each`}
          .
        </p>
      ) : (
        <>
          <h2>
            Meeting points <small>({total})</small>
          </h2>
          {result.groups.map((g) => (
            <section key={`${g.chA},${g.chB}`}>
              <h3>
                {from.name} {changesLabel(g.chA)} · {to.name}{" "}
                {changesLabel(g.chB)} <small>({g.arr.length})</small>
              </h3>
              <ul>
                {g.arr.map((crs) => (
                  <li key={crs}>
                    {stations[crs]?.name ?? crs} <small>({crs})</small>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}

export default function TrainMeet({
  stations,
  services,
}: {
  stations: Stations;
  services: Services;
}) {
  const [from, setFrom] = useState<Entry | null>(null);
  const [to, setTo] = useState<Entry | null>(null);
  const [maxChanges, setMaxChanges] = useState(1);

  const [submitted, setSubmitted] = useState<{
    from: Entry;
    to: Entry;
    maxChanges: number;
    result: Result;
  } | null>(null);

  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(
    () =>
      Object.entries(stations)
        .map(([crs, info]) => ({
          crs,
          name: info.name,
          nameLower: info.name.toLowerCase(),
          crsLower: crs.toLowerCase(),
          words: info.name.toLowerCase().split(/\s+/),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stations],
  );

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!from || !to) {
      setValidationMessage("Pick a station from the dropdown for both fields.");
      setSubmitted(null);
      return;
    }
    if (from.crs === to.crs) {
      setValidationMessage("Pick two different stations.");
      setSubmitted(null);
      return;
    }
    setValidationMessage(null);
    const result = findMeetingPoints(stations, services, from.crs, to.crs, maxChanges);
    setSubmitted({ from, to, maxChanges, result });
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        <Combobox
          label="From"
          placeholder="e.g. London Kings Cross"
          entries={entries}
          value={from}
          onChange={setFrom}
        />
        <button
          type="button"
          className="swap"
          onClick={swap}
          disabled={!from && !to}
          aria-label="Swap from and to"
        >
          ⇅ Swap
        </button>
        <Combobox
          label="To"
          placeholder="e.g. Edinburgh"
          entries={entries}
          value={to}
          onChange={setTo}
        />
        <div className="field">
          <label htmlFor="max-changes">Max changes each</label>
          <select
            id="max-changes"
            value={maxChanges}
            onChange={(e) => setMaxChanges(Number(e.target.value))}
          >
            <option value={0}>Direct only</option>
            <option value={1}>Up to 1 change</option>
            <option value={2}>Up to 2 changes</option>
            <option value={3}>Up to 3 changes</option>
          </select>
        </div>
        <button type="submit">Find meeting points</button>
      </form>

      <section id="results" aria-live="polite">
        {validationMessage && <p>{validationMessage}</p>}
        {submitted && <ResultView stations={stations} {...submitted} />}
      </section>
    </>
  );
}
