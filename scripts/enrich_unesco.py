"""Step aggiuntivo della pipeline: arricchisce le citta' con i siti UNESCO
che le riguardano.

Lista statica curata a mano (data/unesco_sites_fr.json), abbinata per nome
comune normalizzato. La Francia ne ha una cinquantina; qui sono inclusi
solo quelli che corrispondono chiaramente a un singolo comune (niente siti
seriali su decine di comuni o siti naturali senza una citta' di
riferimento), quindi la lista NON e' esaustiva.

Nota storica: questo step arricchiva anche i monumenti storici classificati
(Base Merimee, via data.culture.gouv.fr), rimossi dopo tre tentativi falliti
di far funzionare quell'API (endpoint dismesso, poi risposte con corpo
vuoto su ogni chiamata, senza un modo di verificarlo dal vivo da questo
ambiente di sviluppo - vedi la history di questo file). In pausa finche'
non si trova un modo di verificare l'API dal vivo.

Uso:
    python scripts/enrich_unesco.py \
        --cities data/cache/cities.json --out data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from fetch_hotels import normalize

UNESCO_FILE = Path(__file__).resolve().parent.parent / "data" / "unesco_sites_fr.json"


def load_unesco_sites() -> dict[str, list[dict]]:
    if not UNESCO_FILE.exists():
        return {}
    raw = json.loads(UNESCO_FILE.read_text(encoding="utf-8"))
    by_commune: dict[str, list[dict]] = {}
    for site in raw:
        for commune in site.get("communes_norm", []):
            key = normalize(commune).lower()
            by_commune.setdefault(key, []).append({"name": site["name"], "year": site.get("year")})
    return by_commune


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="data/cache/cities.json")
    args = parser.parse_args()

    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))
    unesco_by_commune = load_unesco_sites()

    with_unesco = 0
    for city in cities:
        key = normalize(city.get("name") or "").lower()
        unesco = unesco_by_commune.get(key)
        if unesco:
            city["unesco_sites"] = unesco
            with_unesco += 1

    Path(args.out).write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Siti UNESCO trovati per {with_unesco}/{len(cities)} citta'.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
