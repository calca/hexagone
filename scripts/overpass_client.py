"""Client minimale per l'Overpass API (OpenStreetMap), con failover su piu'
mirror pubblici.
"""
from __future__ import annotations

import sys
import time

import requests

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)

# (connect timeout, read timeout): se un mirror e' irraggiungibile falliamo in
# fretta (10s) invece di aspettare fino al timeout di lettura; una volta
# stabilita la connessione, alle query pesanti (tutta la Francia) resta
# comunque parecchio tempo per rispondere.
REQUEST_TIMEOUT = (10, 180)


def run_query(query: str, retries: int = 2, pause: float = 2.0) -> dict:
    """Esegue una query Overpass QL, tentando i mirror in ordine.

    Ritorna il JSON decodificato ({"elements": [...]}).
    """
    last_error: Exception | None = None
    for mirror in MIRRORS:
        for attempt in range(retries):
            try:
                resp = requests.post(
                    mirror,
                    data={"data": query},
                    headers={"User-Agent": USER_AGENT},
                    timeout=REQUEST_TIMEOUT,
                )
                if resp.status_code == 200:
                    return resp.json()
                last_error = RuntimeError(f"{mirror} -> HTTP {resp.status_code}")
            except requests.RequestException as exc:
                last_error = exc
            print(f"  Overpass {mirror} tentativo {attempt + 1}/{retries} fallito: {last_error}", file=sys.stderr)
            time.sleep(pause * (attempt + 1))
    raise RuntimeError(f"Tutti i mirror Overpass hanno fallito: {last_error}")
