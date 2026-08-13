"""Step aggiuntivo della pipeline: arricchisce le citta' con i monumenti
storici (classificati/iscritti) tramite Wikidata SPARQL, in batch, usando
gli id Wikidata gia' risolti da resolve_cities.py/enrich_wikidata.py.

Sostituisce un precedente tentativo via l'API open data del Ministero della
Cultura francese (data.culture.gouv.fr, Base Merimee), abbandonato dopo tre
tentativi falliti in produzione (endpoint dismesso, poi risposte con corpo
vuoto su ogni chiamata) senza un modo di verificare quell'API dal vivo da
questo ambiente di sviluppo. query.wikidata.org e' lo stesso endpoint gia'
usato con successo da enrich_wikidata.py per la popolazione, quindi non
introduce una nuova fonte non collaudata.

Nota: i monumenti sono legati al comune tramite P131 (localita' amministrativa
di appartenenza). Per le grandi citta' con arrondissement come entita'
amministrativa propria in Wikidata (Paris, Lyon, Marseille), i monumenti
potrebbero essere collegati all'arrondissement invece che alla citta' - non
gestito qui, quindi per quelle citta' il dato potrebbe risultare incompleto.

Uso:
    python scripts/enrich_monuments.py \
        --cities data/cache/cities.json --out data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
BATCH_SIZE = 25
MAX_MONUMENTS = 8

# P131 = localita' amministrativa di appartenenza, P1435 = designazione di
# tutela patrimoniale (in Francia usata per i monumenti storici classificati/
# iscritti). Ordina per numero di sitelink (wikibase:sitelinks) decrescente,
# cosi' se un comune ne ha piu' di MAX_MONUMENTS si tengono i piu' noti/
# documentati (con piu' voci Wikipedia in altre lingue) invece di un
# sottoinsieme arbitrario.
QUERY_TEMPLATE = """
SELECT ?commune ?monument ?monumentLabel (COALESCE(?sitelinks, 0) AS ?sl) WHERE {{
  VALUES ?commune {{ {values} }}
  ?monument wdt:P131 ?commune ;
            wdt:P1435 ?designation .
  OPTIONAL {{ ?monument wikibase:sitelinks ?sitelinks . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr". }}
}}
ORDER BY ?commune DESC(?sl)
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="data/cache/cities.json")
    args = parser.parse_args()

    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))
    with_qid = [c for c in cities if c.get("wikidata")]
    print(f"{len(with_qid)}/{len(cities)} citta' con id Wikidata da interrogare per monumenti storici.", file=sys.stderr)

    monuments_by_qid: dict[str, list[str]] = defaultdict(list)
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
            commune_qid = b["commune"]["value"].rsplit("/", 1)[-1]
            label = b.get("monumentLabel", {}).get("value")
            if not label:
                continue
            names = monuments_by_qid[commune_qid]
            if label not in names and len(names) < MAX_MONUMENTS:
                names.append(label)
        time.sleep(1)  # rispetto del rate limit di query.wikidata.org

    with_monuments = 0
    for city in cities:
        qid = city.get("wikidata")
        if qid and monuments_by_qid.get(qid):
            city["monuments_historiques"] = monuments_by_qid[qid]
            with_monuments += 1

    Path(args.out).write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Monumenti storici trovati per {with_monuments}/{len(cities)} citta'.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
