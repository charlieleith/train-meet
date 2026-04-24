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

type Group = { changes: number[]; arr: string[] };
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
  crses: string[],
  maxChanges: number,
): Result {
  const dists = crses.map((c) => bfs(services, c));
  const inputs = new Set(crses);
  const direct =
    crses.length === 2 && (services[crses[0]] || []).includes(crses[1]);
  const candidates: { crs: string; changes: number[] }[] = [];
  const smallest = dists.reduce((m, d) => (d.size < m.size ? d : m), dists[0]);
  for (const [crs] of smallest) {
    if (inputs.has(crs)) continue;
    const changes: number[] = [];
    let ok = true;
    for (const d of dists) {
      const dist = d.get(crs);
      if (dist === undefined) {
        ok = false;
        break;
      }
      const ch = dist - 1;
      if (ch > maxChanges) {
        ok = false;
        break;
      }
      changes.push(ch);
    }
    if (ok) candidates.push({ crs, changes });
  }
  const groupMap = new Map<string, Group>();
  for (const c of candidates) {
    const key = c.changes.join(",");
    let g = groupMap.get(key);
    if (!g) {
      g = { changes: c.changes, arr: [] };
      groupMap.set(key, g);
    }
    g.arr.push(c.crs);
  }
  const groups = [...groupMap.values()];
  groups.sort((a, b) => {
    const maxA = Math.max(...a.changes);
    const maxB = Math.max(...b.changes);
    if (maxA !== maxB) return maxA - maxB;
    const sumA = a.changes.reduce((s, x) => s + x, 0);
    const sumB = b.changes.reduce((s, x) => s + x, 0);
    if (sumA !== sumB) return sumA - sumB;
    for (let i = 0; i < a.changes.length; i++) {
      if (a.changes[i] !== b.changes[i]) return a.changes[i] - b.changes[i];
    }
    return 0;
  });
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
  inputs: Entry[];
  maxChanges: number;
  result: Result;
};

function ResultView({ stations, inputs, maxChanges, result }: ResultViewProps) {
  const total = result.groups.reduce((n, g) => n + g.arr.length, 0);
  const isPair = inputs.length === 2;
  return (
    <>
      {isPair &&
        (result.direct ? (
          <p className="direct">
            ✓ Direct trains run between <strong>{inputs[0].name}</strong> and{" "}
            <strong>{inputs[1].name}</strong>.
          </p>
        ) : (
          <p className="nodirect">
            No direct service between <strong>{inputs[0].name}</strong> and{" "}
            <strong>{inputs[1].name}</strong>.
          </p>
        ))}
      {total === 0 ? (
        <p>
          No meeting points{" "}
          {maxChanges === 0
            ? "with a direct service from all"
            : `within ${changesLabel(maxChanges)} each`}
          .
        </p>
      ) : (
        <>
          <h2>
            Meeting points <small>({total})</small>
          </h2>
          {result.groups.map((g) => (
            <section key={g.changes.join(",")}>
              <h3>
                {g.changes
                  .map((ch, i) => `${inputs[i].name} ${changesLabel(ch)}`)
                  .join(" · ")}{" "}
                <small>({g.arr.length})</small>
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

type Slot = { id: string; value: Entry | null };

function letter(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

const PLACEHOLDERS = ["e.g. London Kings Cross", "e.g. Edinburgh"];

function SlotRow({
  label,
  placeholder,
  entries,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  placeholder: string;
  entries: Entry[];
  value: Entry | null;
  onChange: (e: Entry | null) => void;
  onRemove?: () => void;
}) {
  if (!onRemove) {
    return (
      <Combobox
        label={label}
        placeholder={placeholder}
        entries={entries}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <div className="slot-row">
      <Combobox
        label={label}
        placeholder={placeholder}
        entries={entries}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="slot-remove"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </div>
  );
}

export default function TrainMeet({
  stations,
  services,
}: {
  stations: Stations;
  services: Services;
}) {
  const idCounter = useRef(2);
  const [slots, setSlots] = useState<Slot[]>([
    { id: "slot-0", value: null },
    { id: "slot-1", value: null },
  ]);
  const [maxChanges, setMaxChanges] = useState(1);

  const [submitted, setSubmitted] = useState<{
    inputs: Entry[];
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

  const setSlotValue = (idx: number, value: Entry | null) => {
    setSlots((s) =>
      s.map((slot, i) => (i === idx ? { ...slot, value } : slot)),
    );
  };

  const addSlot = () => {
    setSlots((s) => [
      ...s,
      { id: `slot-${idCounter.current++}`, value: null },
    ]);
  };

  const removeSlot = (idx: number) => {
    setSlots((s) => (s.length <= 2 ? s : s.filter((_, i) => i !== idx)));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const filled = slots.map((s) => s.value);
    if (filled.some((v) => v === null)) {
      setValidationMessage("Pick a station from the dropdown for every field.");
      setSubmitted(null);
      return;
    }
    const inputs = filled as Entry[];
    const crses = inputs.map((v) => v.crs);
    if (new Set(crses).size !== crses.length) {
      setValidationMessage("Pick different stations for each field.");
      setSubmitted(null);
      return;
    }
    setValidationMessage(null);
    const result = findMeetingPoints(stations, services, crses, maxChanges);
    setSubmitted({ inputs, maxChanges, result });
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        {slots.map((slot, idx) => (
          <SlotRow
            key={slot.id}
            label={`Station ${letter(idx)}`}
            placeholder={PLACEHOLDERS[idx] ?? ""}
            entries={entries}
            value={slot.value}
            onChange={(v) => setSlotValue(idx, v)}
            onRemove={slots.length > 2 ? () => removeSlot(idx) : undefined}
          />
        ))}
        <button type="button" className="add-station" onClick={addSlot}>
          + Add station
        </button>
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
