"""Esegue l'intera pipeline in ordine: hotel -> citta' -> popolazione ->
storia/attrazioni -> dataset finale.

Uso:
    python scripts/pipeline.py
    python scripts/pipeline.py --skip-wikimedia   # per un giro rapido senza storia/attrazioni
    python scripts/pipeline.py --only wikimedia    # riesegue solo uno step (usa la cache esistente)

Richiede una connessione internet non filtrata verso: overpass-api.de (o
mirror), query.wikidata.org, fr.wikipedia.org, fr.wikivoyage.org.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "cache"

STEPS = ["hotels", "cities", "addresses", "wikidata", "unesco", "wikimedia", "build"]


def run(step: str) -> None:
    script = {
        "hotels": SCRIPTS / "fetch_hotels.py",
        "cities": SCRIPTS / "resolve_cities.py",
        "addresses": SCRIPTS / "enrich_addresses.py",
        "wikidata": SCRIPTS / "enrich_wikidata.py",
        "unesco": SCRIPTS / "enrich_unesco.py",
        "wikimedia": SCRIPTS / "enrich_wikimedia.py",
        "build": SCRIPTS / "build_dataset.py",
    }[step]
    print(f"\n=== Step: {step} ===", file=sys.stderr)
    subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=STEPS, help="esegue solo questo step")
    parser.add_argument("--skip-wikimedia", action="store_true", help="salta storia/attrazioni (piu' veloce)")
    args = parser.parse_args()

    CACHE.mkdir(parents=True, exist_ok=True)

    if args.only:
        run(args.only)
        return 0

    for step in STEPS:
        if step == "wikimedia" and args.skip_wikimedia:
            continue
        run(step)

    print("\nPipeline completata. Output: docs/data.json", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
