"""Step 1 della pipeline: scarica da OpenStreetMap (Overpass API) tutti gli
hotel dei brand "ibis" e "ibis Styles" in Francia.

Uso:
    python scripts/fetch_hotels.py [--out data/cache/hotels.json]

Richiede accesso a internet verso overpass-api.de (o mirror). In ambienti
con rete filtrata (es. sandbox CI limitata) fallira': va eseguito in locale
o dentro la GitHub Action "refresh-data".
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

from overpass_client import run_query

# Query Overpass QL: tutti i nodi/way/relation con tourism=hotel il cui
# brand o nome corrisponde a "ibis" o "ibis Styles" (case-insensitive),
# ristretti al territorio francese (area con ISO3166-1=FR).
# Escludiamo esplicitamente "ibis budget" perche' non richiesto.
QUERY_TEMPLATE = """
[out:json][timeout:180];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
(
  nwr(area.fr)["tourism"="hotel"]["brand"~"^ibis( Styles)?$",i];
  nwr(area.fr)["tourism"="hotel"]["name"~"^ibis( Styles)?( |$)",i]["name"!~"budget",i];
);
out center tags;
"""


def normalize(text: str | None) -> str | None:
    if not text:
        return None
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.strip()


def classify_brand(tags: dict) -> str:
    name = tags.get("name", "")
    brand = tags.get("brand", "")
    haystack = f"{brand} {name}".lower()
    if "styles" in haystack:
        return "ibis Styles"
    return "ibis"


def element_latlon(element: dict) -> tuple[float | None, float | None]:
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    center = element.get("center")
    if center:
        return center.get("lat"), center.get("lon")
    return None, None


def build_address(tags: dict) -> str:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
    ]
    street = " ".join(p for p in parts if p)
    postcode = tags.get("addr:postcode", "")
    city = tags.get("addr:city", "")
    tail = " ".join(p for p in [postcode, city] if p)
    return ", ".join(p for p in [street, tail] if p)


def fetch_hotels() -> list[dict]:
    result = run_query(QUERY_TEMPLATE)
    hotels = []
    seen_ids = set()
    for element in result.get("elements", []):
        tags = element.get("tags", {})
        lat, lon = element_latlon(element)
        if lat is None or lon is None:
            continue
        osm_id = f"{element['type']}/{element['id']}"
        if osm_id in seen_ids:
            continue
        seen_ids.add(osm_id)

        city = tags.get("addr:city") or tags.get("addr:suburb")
        hotels.append(
            {
                "osm_id": osm_id,
                "name": tags.get("name", "ibis"),
                "brand": classify_brand(tags),
                "lat": lat,
                "lon": lon,
                "address": build_address(tags),
                "street": " ".join(
                    p
                    for p in [tags.get("addr:housenumber"), tags.get("addr:street")]
                    if p
                ),
                "postcode": tags.get("addr:postcode"),
                "city": city,
                "city_norm": normalize(city),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "website": tags.get("website") or tags.get("contact:website"),
            }
        )
    return hotels


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/cache/hotels.json")
    args = parser.parse_args()

    print("Interrogo Overpass API per hotel ibis / ibis Styles in Francia...", file=sys.stderr)
    hotels = fetch_hotels()

    missing_city = sum(1 for h in hotels if not h["city"])
    print(
        f"Trovati {len(hotels)} hotel ({missing_city} senza addr:city, "
        "andranno risolti per coordinate).",
        file=sys.stderr,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(hotels, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Scritto {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
