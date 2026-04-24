#!/usr/bin/env python3
"""Parse an ATOC/RDG CIF timetable file into station + direct-service JSON.

CIF (Common Interface File) is a fixed-width 80-char-per-record format. The
record types we care about:

    TI  TIPLOC Insert           Station master data (TIPLOC -> CRS + name)
    BS  Basic Schedule          Start of a train schedule block
    LO  Origin Location         First stop on a schedule
    LI  Intermediate Location   A mid-route location (may be a stop or pass-through)
    LT  Terminating Location    Last stop on a schedule

Byte offsets below are 0-indexed per the RSPS5046 spec.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


def parse_cif(cif_path: Path):
    tiplocs: dict[str, dict] = {}
    direct_pairs: dict[str, set] = defaultdict(set)
    current_train: list | None = None
    skip_current = False

    def flush():
        nonlocal current_train, skip_current
        if current_train and not skip_current:
            _emit_pairs(current_train, tiplocs, direct_pairs)
        current_train = None
        skip_current = False

    with cif_path.open("r", encoding="latin-1") as f:
        for line in f:
            rec = line[:2]

            if rec == "TI":
                tiploc = line[2:9].strip()
                crs = line[53:56].strip()
                # CAPRI short description (16 chars) — falls back to TPS description.
                name = line[56:72].strip() or line[18:44].strip()
                if tiploc and crs:
                    tiplocs[tiploc] = {"name": name, "crs": crs}

            elif rec == "BS":
                flush()
                # STP indicator at byte 79: P=permanent, N=new STP, O=overlay, C=cancel.
                stp = line[79:80]
                if stp == "C":
                    skip_current = True
                    current_train = None
                else:
                    current_train = []

            elif rec == "LO" and current_train is not None:
                current_train.append(line[2:9].strip())

            elif rec == "LI" and current_train is not None:
                # A public stop has a non-zero public arrival or departure time.
                pub_arr = line[25:29].strip()
                pub_dep = line[29:33].strip()
                if pub_arr not in ("", "0000") or pub_dep not in ("", "0000"):
                    current_train.append(line[2:9].strip())

            elif rec == "LT" and current_train is not None:
                current_train.append(line[2:9].strip())
                flush()

            elif rec == "ZZ":
                flush()

    flush()
    return tiplocs, direct_pairs


def _emit_pairs(tiploc_list, tiplocs, direct_pairs):
    seen = set()
    crs_list = []
    for t in tiploc_list:
        info = tiplocs.get(t)
        if not info:
            continue
        crs = info["crs"]
        if crs in seen:
            continue
        seen.add(crs)
        crs_list.append(crs)

    for i, a in enumerate(crs_list):
        for b in crs_list[i + 1:]:
            direct_pairs[a].add(b)
            direct_pairs[b].add(a)


def main():
    if len(sys.argv) != 3:
        print("Usage: parse_cif.py <cif_file> <out_dir>", file=sys.stderr)
        sys.exit(1)

    cif_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    tiplocs, direct_pairs = parse_cif(cif_path)

    stations: dict[str, dict] = {}
    for info in tiplocs.values():
        crs = info["crs"]
        if crs not in stations:
            stations[crs] = {"name": info["name"]}

    # Drop nodes that only appear as tiplocs but have no direct connections
    # (e.g., depots, junctions that never see a public stop).
    stations = {crs: info for crs, info in stations.items() if crs in direct_pairs}

    services = {crs: sorted(n) for crs, n in direct_pairs.items()}

    (out_dir / "stations.json").write_text(
        json.dumps(stations, separators=(",", ":"), sort_keys=True)
    )
    (out_dir / "direct_services.json").write_text(
        json.dumps(services, separators=(",", ":"), sort_keys=True)
    )

    print(
        f"Wrote {len(stations)} stations; graph has {sum(len(v) for v in services.values()) // 2} edges",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
