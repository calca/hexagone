"""Step 3 della pipeline: arricchisce le citta' con la popolazione (e il
titolo della voce Wikipedia in francese) interrogando Wikidata via SPARQL,
in batch, usando gli id Wikidata gia' risolti da resolve_cities.py.

Uso:
    python scripts/enrich_wikidata.py \
        --cities data/cache/cities.json --out data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
BATCH_SIZE = 50

QUERY_TEMPLATE = """
SELECT ?city ?population ?date ?article WHERE {{
  VALUES ?city {{ {values} }}
  OPTIONAL {{
    ?city p:P1082 ?stmt .
    ?stmt ps:P1082 ?population .
    OPTIONAL {{ ?stmt pq:P585 ?date . }}
  }}
  OPTIONAL {{
    ?article schema:about ?city ;
             schema:isPartOf <https://fr.wikipedia.org/> .
  }}
}}
"""

# Le citta' risolte via geo.api.gouv.fr (fallback per hotel senza addr:city)
# hanno il codice INSEE ma non l'id Wikidata: lo recuperiamo qui tramite la
# proprieta' P374 (codice INSEE del comune), cosi' anche per loro si arriva
# alla popolazione/voce Wikipedia come per le altre citta'.
QID_BY_INSEE_TEMPLATE = """
SELECT ?city ?insee WHERE {{
  VALUES ?insee {{ {values} }}
  ?city wdt:P374 ?insee .
}}
"""


def run_sparql(qids: list[str]) -> list[dict]:
    values = " ".join(f"wd:{q}" for q in qids)
    query = QUERY_TEMPLATE.format(values=values)
    resp = requests.get(
        SPARQL_ENDPOINT,
        params={"query": query, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["results"]["bindings"]


def resolve_qids_by_insee(insee_codes: list[str]) -> dict[str, str]:
    values = " ".join(f'"{code}"' for code in insee_codes)
    query = QID_BY_INSEE_TEMPLATE.format(values=values)
    resp = requests.get(
        SPARQL_ENDPOINT,
        params={"query": query, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=120,
    )
    resp.raise_for_status()
    qid_by_insee: dict[str, str] = {}
    for b in resp.json()["results"]["bindings"]:
        qid = b["city"]["value"].rsplit("/", 1)[-1]
        insee = b["insee"]["value"]
        qid_by_insee[insee] = qid
    return qid_by_insee


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="data/cache/cities.json")
    args = parser.parse_args()

    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))

    missing_qid = [c for c in cities if not c.get("wikidata") and c.get("insee")]
    if missing_qid:
        print(f"{len(missing_qid)} citta' senza id Wikidata: risolvo via codice INSEE...", file=sys.stderr)
        insee_codes = sorted({c["insee"] for c in missing_qid})
        qid_by_insee: dict[str, str] = {}
        for i in range(0, len(insee_codes), BATCH_SIZE):
            batch = insee_codes[i : i + BATCH_SIZE]
            try:
                qid_by_insee.update(resolve_qids_by_insee(batch))
            except requests.RequestException as exc:
                print(f"  ERRORE batch INSEE: {exc}", file=sys.stderr)
            time.sleep(1)
        for c in missing_qid:
            qid = qid_by_insee.get(c["insee"])
            if qid:
                c["wikidata"] = qid
        print(f"  {len(qid_by_insee)}/{len(insee_codes)} codici INSEE risolti a un id Wikidata.", file=sys.stderr)

    with_qid = [c for c in cities if c.get("wikidata")]
    print(f"{len(with_qid)}/{len(cities)} citta' con id Wikidata da interrogare.", file=sys.stderr)

    # popolazione piu' recente per QID, e titolo voce wikipedia francese
    best_population: dict[str, tuple[str, str | None]] = {}
    wiki_title: dict[str, str] = {}

    qids = [c["wikidata"] for c in with_qid]
    for i in range(0, len(qids), BATCH_SIZE):
        batch = qids[i : i + BATCH_SIZE]
        print(f"  SPARQL batch {i // BATCH_SIZE + 1}/{(len(qids) - 1) // BATCH_SIZE + 1}", file=sys.stderr)
        try:
            bindings = run_sparql(batch)
        except requests.RequestException as exc:
            print(f"  ERRORE batch: {exc}", file=sys.stderr)
            time.sleep(5)
            continue

        for b in bindings:
            qid = b["city"]["value"].rsplit("/", 1)[-1]
            if "article" in b:
                title = b["article"]["value"].rsplit("/wiki/", 1)[-1]
                wiki_title[qid] = requests.utils.unquote(title).replace("_", " ")
            if "population" in b:
                pop = b["population"]["value"]
                date = b.get("date", {}).get("value")
                current = best_population.get(qid)
                if current is None or (date and (current[1] is None or date > current[1])):
                    best_population[qid] = (pop, date)
        time.sleep(1)  # rispetto del rate limit di query.wikidata.org

    for city in cities:
        qid = city.get("wikidata")
        if not qid:
            continue
        if qid in best_population:
            pop_value, pop_date = best_population[qid]
            city["population"] = int(float(pop_value))
            city["population_year"] = pop_date[:4] if pop_date else None
        if qid in wiki_title:
            city["wikipedia_title"] = wiki_title[qid]

    Path(args.out).write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding="utf-8")
    resolved_pop = sum(1 for c in cities if c.get("population"))
    print(f"Popolazione trovata per {resolved_pop}/{len(cities)} citta'. Scritto {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
