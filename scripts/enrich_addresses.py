"""Step pipeline (dopo "cities"): riempie l'indirizzo degli hotel che non
lo hanno perche' OSM non aveva i tag addr:housenumber/addr:street, usando
il reverse geocoding della Base Adresse Nationale francese
(api-adresse.data.gouv.fr) sulle coordinate dell'hotel.

Al momento dell'introduzione di questo step, 338 hotel su 622 (54%) nel
dataset non avevano un indirizzo per questo motivo.

Uso:
    python scripts/enrich_addresses.py \
        --hotels data/cache/hotels_resolved.json \
        --out data/cache/hotels_resolved.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

from resolve_cities import haversine_km

BAN_REVERSE_URL = "https://api-adresse.data.gouv.fr/reverse/"
BAN_USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
BAN_QUERY_PAUSE = 0.2  # secondi tra una query e la successiva
# Oltre questa distanza dal punto dell'hotel, l'indirizzo piu' vicino
# trovato da BAN e' probabilmente quello sbagliato (hotel isolato, zona
# industriale, area senza indirizzi civici vicini): meglio lasciare il
# campo vuoto (comportamento attuale) che mostrare un indirizzo errato.
MAX_DISTANCE_KM = 0.3


def format_address(props: dict) -> str:
    """Replica lo stile di fetch_hotels.build_address() a partire dalle
    proprieta' BAN: "{via}, {CAP} {citta'}"."""
    street = props.get("name") or ""
    postcode = props.get("postcode") or ""
    city = props.get("city") or ""
    tail = " ".join(p for p in [postcode, city] if p)
    return ", ".join(p for p in [street, tail] if p)


def reverse_geocode(lat: float, lon: float, retries: int = 3) -> dict | None:
    """Ritorna {"address": str, "distance_km": float} per l'indirizzo piu'
    vicino al punto, o None se non trovato / troppo lontano per essere
    affidabile. Solleva RuntimeError sui soli errori di rete/HTTP (cosi'
    il chiamante puo' distinguere "nessun indirizzo qui" da "query fallita"
    e non cachare quest'ultimo caso)."""
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(
                BAN_REVERSE_URL,
                params={"lon": lon, "lat": lat},
                headers={"User-Agent": BAN_USER_AGENT},
                timeout=15,
            )
            resp.raise_for_status()
            features = resp.json().get("features") or []
            if not features:
                return None
            best = features[0]
            props = best.get("properties") or {}
            coords = (best.get("geometry") or {}).get("coordinates") or [None, None]
            point_lon, point_lat = coords
            if point_lat is None or point_lon is None:
                return None
            distance_km = haversine_km(lat, lon, point_lat, point_lon)
            if distance_km > MAX_DISTANCE_KM:
                return None
            address = format_address(props)
            if not address:
                return None
            return {"address": address, "distance_km": distance_km}
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"api-adresse.data.gouv.fr fallito per ({lat},{lon}): {last_error}")


class AddressCache:
    """Stesso pattern resumibile delle altre cache della pipeline (vedi
    GeoLookupCache in resolve_cities.py): si cachano solo gli esiti validi
    (incluso "nessun indirizzo affidabile qui", cioe' None), mai i
    fallimenti di query, altrimenti un fix o un retry successivo non
    ritenterebbe gli hotel falliti."""

    def __init__(self, path: Path):
        self.path = path
        self.data: dict[str, dict | None] = {}
        if path.exists():
            self.data = json.loads(path.read_text(encoding="utf-8"))

    def get(self, osm_id: str):
        return self.data.get(osm_id, "__missing__")

    def set(self, osm_id: str, value: dict | None) -> None:
        self.data[osm_id] = value

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hotels", default="data/cache/hotels_resolved.json")
    parser.add_argument("--out", default="data/cache/hotels_resolved.json")
    parser.add_argument("--cache", default="data/cache/address_cache.json")
    args = parser.parse_args()

    hotels = json.loads(Path(args.hotels).read_text(encoding="utf-8"))
    todo = [h for h in hotels if not h.get("address")]
    print(f"{len(todo)}/{len(hotels)} hotel senza indirizzo, provo il reverse geocoding BAN...", file=sys.stderr)

    cache = AddressCache(Path(args.cache))
    cached_hits = sum(1 for h in todo if cache.get(h["osm_id"]) != "__missing__")
    if cached_hits:
        print(f"  {cached_hits}/{len(todo)} gia' in cache, riprendo da li'.", file=sys.stderr)

    filled = 0
    for i, h in enumerate(todo):
        if i and i % 50 == 0:
            print(f"  ...{i}/{len(todo)} processati", file=sys.stderr)
            cache.save()

        cached = cache.get(h["osm_id"])
        if cached != "__missing__":
            result = cached
        else:
            try:
                result = reverse_geocode(h["lat"], h["lon"])
                cache.set(h["osm_id"], result)
            except RuntimeError as exc:
                print(f"  ATTENZIONE: query fallita per hotel {h['osm_id']}: {exc}", file=sys.stderr)
                result = None
            time.sleep(BAN_QUERY_PAUSE)

        if result:
            h["address"] = result["address"]
            filled += 1

    cache.save()

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(hotels, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indirizzo riempito per {filled}/{len(todo)} hotel. Scritto {args.out}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
