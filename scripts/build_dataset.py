"""Step 5 della pipeline: unisce hotel e citta' arricchite nel JSON finale
consumato dal sito statico (docs/data.json).

Uso:
    python scripts/build_dataset.py \
        --hotels data/cache/hotels_resolved.json \
        --cities data/cache/cities.json \
        --out docs/data.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "citta"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hotels", default="data/cache/hotels_resolved.json")
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="docs/data.json")
    args = parser.parse_args()

    hotels = json.loads(Path(args.hotels).read_text(encoding="utf-8"))
    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))

    hotels_by_city_key: dict[str, list[dict]] = defaultdict(list)
    for h in hotels:
        hotels_by_city_key[h.get("city_key")].append(h)

    used_ids: set[str] = set()
    out_cities = []
    total_ibis = total_styles = 0

    for city in cities:
        city_hotels_raw = hotels_by_city_key.get(city["city_key"], [])
        if not city_hotels_raw:
            continue

        base_id = slugify(city["name"])
        city_id = base_id
        suffix = 2
        while city_id in used_ids:
            city_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(city_id)

        city_hotels = []
        for h in sorted(city_hotels_raw, key=lambda x: x["name"]):
            if h["brand"] == "ibis Styles":
                total_styles += 1
            else:
                total_ibis += 1
            city_hotels.append(
                {
                    "osm_id": h["osm_id"],
                    "name": h["name"],
                    "brand": h["brand"],
                    "address": h["address"],
                    "postcode": h.get("postcode"),
                    "lat": h["lat"],
                    "lon": h["lon"],
                    "phone": h.get("phone"),
                    "website": h.get("website"),
                }
            )

        wiki_title = city.get("wikipedia_title") or city["name"]
        out_cities.append(
            {
                "id": city_id,
                "name": city["name"],
                "insee": city.get("insee"),
                "wikidata": city.get("wikidata"),
                "lat": city["lat"],
                "lon": city["lon"],
                "population": city.get("population"),
                "population_year": city.get("population_year"),
                "history_summary": city.get("history_summary"),
                "attractions": city.get("attractions", []),
                "wikipedia_url": (
                    f"https://fr.wikipedia.org/wiki/{wiki_title.replace(' ', '_')}"
                    if city.get("wikipedia_title")
                    else None
                ),
                "hotel_count": len(city_hotels),
                "hotels": city_hotels,
            }
        )

    out_cities.sort(key=lambda c: c["name"] or "")

    dataset = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "OpenStreetMap contributors (ODbL) · Wikidata (CC0) · Wikipedia/Wikivoyage FR (CC BY-SA)",
        "stats": {
            "cities": len(out_cities),
            "hotels": total_ibis + total_styles,
            "ibis": total_ibis,
            "ibis_styles": total_styles,
        },
        "cities": out_cities,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"docs/data.json scritto: {dataset['stats']['cities']} citta', "
        f"{dataset['stats']['hotels']} hotel "
        f"({dataset['stats']['ibis']} ibis, {dataset['stats']['ibis_styles']} ibis Styles).",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
