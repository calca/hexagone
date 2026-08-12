"""Step 2 della pipeline: raggruppa gli hotel per comune francese e risolve
ciascun comune al relativo confine amministrativo OSM (admin_level=8), da
cui recuperiamo il codice INSEE, l'id Wikidata e il centroide.

Uso:
    python scripts/resolve_cities.py \
        --hotels data/cache/hotels.json \
        --out-hotels data/cache/hotels_resolved.json \
        --out-cities data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

from fetch_hotels import normalize
from overpass_client import run_query

BATCH_SIZE = 25
GEO_API_GOUV_URL = "https://geo.api.gouv.fr/communes"
GEO_API_USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
GEO_QUERY_PAUSE = 0.2  # secondi tra una query per-hotel e la successiva


def dept_candidates_from_postcode(postcode: str | None) -> list[str]:
    """Ritorna i possibili prefissi INSEE del dipartimento a partire dal CAP."""
    if not postcode or len(postcode) < 2:
        return []
    if postcode.startswith("20"):
        # Corsica: il CAP non distingue 2A/2B, l'INSEE si'.
        return ["2A", "2B"]
    if postcode[:2] in ("97", "98"):
        return [postcode[:3]]
    return [postcode[:2]]


def escape_regex(name: str) -> str:
    return re.escape(name)


def query_communes_by_name(names: list[str]) -> list[dict]:
    alternation = "|".join(escape_regex(n) for n in names)
    query = f"""
[out:json][timeout:180];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
relation(area.fr)["admin_level"="8"]["boundary"="administrative"]["name"~"^({alternation})$",i];
out center tags;
"""
    result = run_query(query)
    communes = []
    for element in result.get("elements", []):
        tags = element.get("tags", {})
        center = element.get("center") or {}
        communes.append(
            {
                "name": tags.get("name"),
                "name_norm": normalize(tags.get("name")),
                "insee": tags.get("ref:INSEE"),
                "wikidata": tags.get("wikidata"),
                "lat": center.get("lat"),
                "lon": center.get("lon"),
            }
        )
    return communes


def query_commune_containing(lat: float, lon: float, retries: int = 3) -> dict | None:
    """Fallback per hotel senza addr:city: trova il comune che contiene il punto,
    usando l'API geografica ufficiale del governo francese (geo.api.gouv.fr).

    Molto piu' veloce e affidabile delle query Overpass punto-per-punto (nessun
    mirror da gestire, nessun linguaggio di query, un solo HTTP GET). Non
    fornisce l'id Wikidata: viene recuperato in un secondo momento (via codice
    INSEE) dallo step enrich_wikidata.
    """
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(
                GEO_API_GOUV_URL,
                params={"lat": lat, "lon": lon, "fields": "nom,code,centre"},
                headers={"User-Agent": GEO_API_USER_AGENT},
                timeout=15,
            )
            resp.raise_for_status()
            results = resp.json()
            if not results:
                return None
            commune = results[0]
            centre = commune.get("centre") or {}
            coords = centre.get("coordinates") or [lon, lat]
            return {
                "name": commune.get("nom"),
                "name_norm": normalize(commune.get("nom")),
                "insee": commune.get("code"),
                "wikidata": None,
                "lat": coords[1],
                "lon": coords[0],
            }
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(f"geo.api.gouv.fr fallito per ({lat},{lon}): {last_error}")


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class GeoLookupCache:
    """Cache su disco (per osm_id) dei risultati della geocodifica punto-per-punto.

    Resumibile tra run separate: se il processo viene interrotto (timeout,
    crash), una riesecuzione salta gli hotel gia' risolti invece di ripartire
    da zero. Il file va tracciato in git (vedi .gitignore) cosi' il progresso
    sopravvive anche tra job di GitHub Actions diversi.
    """

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


def pick_best_match(candidates: list[dict], dept_prefixes: list[str], hotel_lat, hotel_lon) -> dict | None:
    if not candidates:
        return None
    # 1) match esatto su dipartimento (prefisso INSEE)
    if dept_prefixes:
        by_dept = [c for c in candidates if c["insee"] and any(c["insee"].startswith(p) for p in dept_prefixes)]
        if len(by_dept) == 1:
            return by_dept[0]
        if len(by_dept) > 1:
            candidates = by_dept
    # 2) altrimenti il piu' vicino geograficamente all'hotel
    with_coords = [c for c in candidates if c.get("lat") is not None]
    if not with_coords:
        return candidates[0]
    return min(with_coords, key=lambda c: haversine_km(hotel_lat, hotel_lon, c["lat"], c["lon"]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hotels", default="data/cache/hotels.json")
    parser.add_argument("--out-hotels", default="data/cache/hotels_resolved.json")
    parser.add_argument("--out-cities", default="data/cache/cities.json")
    parser.add_argument("--geo-cache", default="data/cache/geo_lookup_cache.json")
    args = parser.parse_args()

    hotels = json.loads(Path(args.hotels).read_text(encoding="utf-8"))

    # Raggruppa per nome citta' normalizzato (gli hotel senza citta' sono gestiti a parte)
    by_name: dict[str, list[dict]] = defaultdict(list)
    without_city = []
    for h in hotels:
        if h.get("city_norm"):
            by_name[h["city_norm"]].append(h)
        else:
            without_city.append(h)

    unique_names = sorted(by_name.keys())
    print(f"{len(unique_names)} nomi di citta' unici da risolvere via Overpass...", file=sys.stderr)

    all_candidates: dict[str, list[dict]] = defaultdict(list)
    for i in range(0, len(unique_names), BATCH_SIZE):
        batch = unique_names[i : i + BATCH_SIZE]
        print(f"  batch {i // BATCH_SIZE + 1}: {batch}", file=sys.stderr)
        for commune in query_communes_by_name(batch):
            if commune["name_norm"]:
                all_candidates[commune["name_norm"]].append(commune)

    cities: dict[str, dict] = {}
    unresolved = []

    for name_norm, group_hotels in by_name.items():
        sample = group_hotels[0]
        dept_prefixes = dept_candidates_from_postcode(sample.get("postcode"))
        candidates = all_candidates.get(name_norm, [])
        avg_lat = sum(h["lat"] for h in group_hotels) / len(group_hotels)
        avg_lon = sum(h["lon"] for h in group_hotels) / len(group_hotels)
        match = pick_best_match(candidates, dept_prefixes, avg_lat, avg_lon)

        if match:
            city_key = match.get("insee") or f"{name_norm}|{dept_prefixes[:1]}"
            display_name = match["name"] or sample["city"]
            lat, lon = match["lat"], match["lon"]
            insee = match["insee"]
            wikidata = match["wikidata"]
        else:
            unresolved.append(name_norm)
            city_key = f"unresolved|{name_norm}"
            display_name = sample["city"]
            lat, lon = avg_lat, avg_lon
            insee = None
            wikidata = None

        if city_key not in cities:
            cities[city_key] = {
                "city_key": city_key,
                "name": display_name,
                "insee": insee,
                "wikidata": wikidata,
                "lat": lat,
                "lon": lon,
                "hotel_osm_ids": [],
            }
        for h in group_hotels:
            h["city_key"] = city_key
            cities[city_key]["hotel_osm_ids"].append(h["osm_id"])

    # Hotel senza addr:city: risolvi punto per punto (dovrebbero essere pochi)
    print(f"{len(without_city)} hotel senza addr:city, risolvo per coordinate...", file=sys.stderr)
    geo_cache = GeoLookupCache(Path(args.geo_cache))
    cached_hits = sum(1 for h in without_city if geo_cache.get(h["osm_id"]) != "__missing__")
    if cached_hits:
        print(f"  {cached_hits}/{len(without_city)} gia' in cache, riprendo da li'.", file=sys.stderr)

    for i, h in enumerate(without_city):
        if i and i % 50 == 0:
            print(f"  ...{i}/{len(without_city)} processati", file=sys.stderr)
            geo_cache.save()

        cached = geo_cache.get(h["osm_id"])
        if cached != "__missing__":
            match = cached
        else:
            try:
                match = query_commune_containing(h["lat"], h["lon"])
            except RuntimeError as exc:
                print(f"  ATTENZIONE: query fallita per hotel {h['osm_id']} ({h['lat']},{h['lon']}): {exc}", file=sys.stderr)
                match = None
            geo_cache.set(h["osm_id"], match)
            time.sleep(GEO_QUERY_PAUSE)

        if match and match["name_norm"]:
            city_key = match.get("insee") or f"{match['name_norm']}|geo"
            if city_key not in cities:
                cities[city_key] = {
                    "city_key": city_key,
                    "name": match["name"],
                    "insee": match["insee"],
                    "wikidata": match["wikidata"],
                    "lat": match["lat"],
                    "lon": match["lon"],
                    "hotel_osm_ids": [],
                }
            h["city_key"] = city_key
            h["city"] = match["name"]
            cities[city_key]["hotel_osm_ids"].append(h["osm_id"])
        else:
            city_key = f"unresolved|{h['osm_id']}"
            cities[city_key] = {
                "city_key": city_key,
                "name": h.get("city") or "Sconosciuta",
                "insee": None,
                "wikidata": None,
                "lat": h["lat"],
                "lon": h["lon"],
                "hotel_osm_ids": [h["osm_id"]],
            }
            h["city_key"] = city_key
            unresolved.append(h["osm_id"])

    geo_cache.save()

    if unresolved:
        print(f"ATTENZIONE: {len(unresolved)} citta'/hotel non risolti a un comune ufficiale: {unresolved[:20]}", file=sys.stderr)

    Path(args.out_hotels).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_hotels).write_text(json.dumps(hotels, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(args.out_cities).write_text(
        json.dumps(sorted(cities.values(), key=lambda c: c["name"] or ""), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Scritti {args.out_hotels} e {args.out_cities} ({len(cities)} citta').", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
