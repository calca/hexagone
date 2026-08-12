"""Step aggiuntivo della pipeline: arricchisce le citta' con siti UNESCO e
monumenti storici classificati/iscritti.

- Siti UNESCO: lista statica curata a mano (data/unesco_sites_fr.json),
  abbinata per nome comune normalizzato. La Francia ne ha una cinquantina;
  qui sono inclusi solo quelli che corrispondono chiaramente a un singolo
  comune (niente siti seriali su decine di comuni o siti naturali senza
  una citta' di riferimento), quindi la lista NON e' esaustiva.
- Monumenti storici: Base Merimee del Ministero della Cultura francese, via
  l'API open data data.culture.gouv.fr. Un fallimento verso questa API
  (irraggiungibile, formato cambiato) non e' mai fatale: la citta' resta
  senza il dato invece di far fallire l'intera pipeline.

Uso:
    python scripts/enrich_heritage.py \
        --cities data/cache/cities.json --out data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

from fetch_hotels import normalize

UNESCO_FILE = Path(__file__).resolve().parent.parent / "data" / "unesco_sites_fr.json"

MONUMENTS_API_URL = "https://data.culture.gouv.fr/api/records/1.0/search/"
MONUMENTS_DATASET = "liste-des-immeubles-proteges-au-titre-des-monuments-historiques"
# Candidati per il campo nome/titolo del monumento nel record: lo schema
# esatto di questo dataset (Base Merimee via Ministero della Cultura) non e'
# stato verificabile con una chiamata live da questo ambiente di sviluppo
# (dominio bloccato dalla policy di rete della sandbox), quindi si prova una
# lista di nomi plausibili invece di assumerne uno solo.
MONUMENT_NAME_FIELDS = ["appellation_courante", "denomination", "appellation", "titre_courant", "edifice"]
USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
REQUEST_PAUSE = 0.3
MAX_MONUMENTS = 8


class HeritageCache:
    """Cache su disco (per INSEE) resumibile tra run separate, come per la
    geocodifica: se il processo viene interrotto, una riesecuzione salta i
    comuni gia' processati.
    """

    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        if path.exists():
            self.data = json.loads(path.read_text(encoding="utf-8"))

    def get(self, insee: str):
        return self.data.get(insee, "__missing__")

    def set(self, insee: str, value) -> None:
        self.data[insee] = value

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")


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


_schema_logged = False


def fetch_monuments(insee: str, commune_name: str | None) -> list[str] | None:
    """Ritorna i nomi dei monumenti storici del comune, [] se nessuno, None
    se la query e' fallita (network/formato) - da non confondere con "zero
    monumenti", per non scrivere in cache un falso "nessun monumento".

    Usa una ricerca full-text (`q=`) sul nome del comune invece di un filtro
    su un campo esatto (es. "insee"): lo schema preciso del dataset non e'
    verificabile da questo ambiente, e una ricerca full-text e' piu' tollerante
    a differenze di nomenclatura dei campi.
    """
    if not commune_name:
        return None
    try:
        resp = requests.get(
            MONUMENTS_API_URL,
            params={
                "dataset": MONUMENTS_DATASET,
                "q": f'commune:"{commune_name}"',
                "rows": MAX_MONUMENTS,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=20,
        )
        resp.raise_for_status()
        payload = resp.json()
        records = payload.get("records", [])

        global _schema_logged
        if not _schema_logged and records:
            _schema_logged = True
            print(f"  [diagnostica] campi disponibili nel primo record: {sorted(records[0].get('fields', {}).keys())}", file=sys.stderr)

        names: list[str] = []
        for record in records:
            fields = record.get("fields", {})
            name = next((fields[f] for f in MONUMENT_NAME_FIELDS if fields.get(f)), None)
            if name and name not in names:
                names.append(name)
        return names
    except requests.RequestException as exc:
        print(f"  WARN monumenti storici '{commune_name}' ({insee}): {exc}", file=sys.stderr)
        return None
    except (ValueError, KeyError) as exc:
        print(f"  WARN risposta inattesa monumenti storici '{commune_name}' ({insee}): {exc}", file=sys.stderr)
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="data/cache/cities.json")
    parser.add_argument("--cache", default="data/cache/heritage_cache.json")
    args = parser.parse_args()

    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))
    unesco_by_commune = load_unesco_sites()
    cache = HeritageCache(Path(args.cache))

    with_unesco = 0
    with_monuments = 0

    for idx, city in enumerate(cities):
        key = normalize(city.get("name") or "").lower()
        unesco = unesco_by_commune.get(key)
        if unesco:
            city["unesco_sites"] = unesco
            with_unesco += 1

        insee = city.get("insee")
        if not insee:
            continue

        if idx and idx % 30 == 0:
            print(f"  ...{idx}/{len(cities)} comuni processati", file=sys.stderr)
            cache.save()

        cached = cache.get(insee)
        if cached == "__missing__":
            monuments = fetch_monuments(insee, city.get("name"))
            # Si scrive in cache solo un esito valido (anche [] = "zero
            # monumenti confermato"): un fallimento (None) non va cachato,
            # altrimenti una prossima run lo scambierebbe per "gia' provato"
            # e non ritenterebbe mai piu' quel comune.
            if monuments is not None:
                cache.set(insee, monuments)
            time.sleep(REQUEST_PAUSE)
        else:
            monuments = cached

        if monuments:
            city["monuments_historiques"] = monuments
            with_monuments += 1

    cache.save()
    Path(args.out).write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Siti UNESCO trovati per {with_unesco}/{len(cities)} citta', "
        f"monumenti storici per {with_monuments}/{len(cities)}.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
