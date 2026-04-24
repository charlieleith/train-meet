#!/usr/bin/env python3
"""Write hand-crafted sample data to data/ for local testing.

Each entry in ROUTES is the stop sequence for a real-ish UK service. Every
station on a route gets a direct edge to every other station on that route.
"""

import json
from collections import defaultdict
from pathlib import Path

STATIONS = {
    "KGX": "London Kings Cross",
    "EUS": "London Euston",
    "PAD": "London Paddington",
    "LST": "London Liverpool Street",
    "WAT": "London Waterloo",
    "VIC": "London Victoria",
    "STP": "London St Pancras International",
    "RDG": "Reading",
    "OXF": "Oxford",
    "CAM": "Cambridge",
    "BTN": "Brighton",
    "SOU": "Southampton Central",
    "BRI": "Bristol Temple Meads",
    "BTH": "Bath Spa",
    "EXD": "Exeter St Davids",
    "PLY": "Plymouth",
    "PNZ": "Penzance",
    "CDF": "Cardiff Central",
    "BHM": "Birmingham New Street",
    "CRE": "Crewe",
    "DBY": "Derby",
    "SHF": "Sheffield",
    "MAN": "Manchester Piccadilly",
    "LIV": "Liverpool Lime Street",
    "LDS": "Leeds",
    "YRK": "York",
    "NCL": "Newcastle",
    "PRE": "Preston",
    "EDB": "Edinburgh",
    "GLC": "Glasgow Central",
    "NRW": "Norwich",
}

ROUTES = [
    # East Coast Main Line (LNER)
    ["KGX", "YRK", "NCL", "EDB"],
    ["KGX", "LDS"],
    # West Coast Main Line (Avanti)
    ["EUS", "BHM", "CRE", "PRE", "GLC"],
    ["EUS", "PRE", "EDB"],
    ["EUS", "CRE", "MAN"],
    ["EUS", "CRE", "LIV"],
    # Great Western (GWR)
    ["PAD", "RDG", "BTH", "BRI"],
    ["PAD", "RDG", "BRI", "CDF"],
    ["PAD", "RDG", "EXD", "PLY", "PNZ"],
    ["PAD", "RDG", "OXF"],
    # CrossCountry (the great meeting-point maker)
    ["EDB", "NCL", "YRK", "SHF", "DBY", "BHM", "BRI", "EXD", "PLY"],
    ["MAN", "CRE", "BHM", "OXF", "RDG", "SOU"],
    ["LDS", "SHF", "DBY", "BHM", "BRI"],
    # TransPennine Express
    ["LIV", "MAN", "LDS", "YRK", "NCL"],
    ["PRE", "MAN", "LDS", "YRK"],
    ["MAN", "PRE", "EDB"],
    ["MAN", "PRE", "GLC"],
    # East Midlands Railway
    ["STP", "DBY", "SHF"],
    # South Western Railway
    ["WAT", "SOU"],
    ["WAT", "EXD"],
    # Greater Anglia
    ["LST", "NRW"],
    ["LST", "CAM"],
    # Southern
    ["VIC", "BTN"],
]


def main():
    pairs: dict[str, set] = defaultdict(set)
    for route in ROUTES:
        for i, a in enumerate(route):
            for b in route[i + 1:]:
                pairs[a].add(b)
                pairs[b].add(a)

    out = Path(__file__).resolve().parent.parent / "data"
    out.mkdir(exist_ok=True)

    stations = {crs: {"name": STATIONS[crs]} for crs in sorted(pairs)}
    services = {crs: sorted(n) for crs, n in pairs.items()}

    (out / "stations.json").write_text(json.dumps(stations, separators=(",", ":"), sort_keys=True))
    (out / "direct_services.json").write_text(json.dumps(services, separators=(",", ":"), sort_keys=True))

    edges = sum(len(v) for v in services.values()) // 2
    print(f"Wrote {len(stations)} stations, {edges} direct-service edges")


if __name__ == "__main__":
    main()
