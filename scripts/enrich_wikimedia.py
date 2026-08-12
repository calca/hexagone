"""Step 4 della pipeline: per ogni citta' scarica un estratto storico da
Wikipedia (sezione "Histoire", con fallback al riassunto iniziale) e
l'elenco dei luoghi da vedere dalla sezione "Voir" di Wikivoyage in
francese, da usare come base per "cosa visitare in un giorno".

Usa una cache su disco (data/cache/wiki_cache.json) per essere idempotente
e non ripetere le chiamate ad ogni riesecuzione.

Uso:
    python scripts/enrich_wikimedia.py \
        --cities data/cache/cities.json --out data/cache/cities.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

USER_AGENT = (
    "hexagone-ibis-scraper/1.0 "
    "(+https://github.com/calca/hexagone; contact: gianluigi.calcaterra@gmail.com)"
)
HEADERS = {"User-Agent": USER_AGENT}
REQUEST_DELAY = 0.25
MAX_HISTORY_CHARS = 900
MAX_ATTRACTIONS = 6


class WikiCache:
    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        if path.exists():
            self.data = json.loads(path.read_text(encoding="utf-8"))

    def get(self, key: str):
        return self.data.get(key)

    def set(self, key: str, value):
        self.data[key] = value

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_wikitext(text: str) -> str:
    # Righe di titolo/sottotitolo (== Storia ==, === Preistoria e Antichita' ===):
    # l'API extracts le lascia in sintassi wiki quando serve per individuare i
    # confini delle sezioni (exsectionformat=wiki), ma non vanno mostrate cosi'
    # com'e' in un paragrafo di prosa continua.
    text = re.sub(r"^=+\s*.*?\s*=+$", "", text, flags=re.M)
    text = re.sub(r"'''?", "", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    # righe vuote multiple lasciate dalla rimozione dei titoli
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def fetch_history_extract(title: str, cache: WikiCache) -> str | None:
    cache_key = f"history:{title}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached or None

    text = None
    try:
        resp = requests.get(
            "https://fr.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "prop": "extracts",
                "explaintext": 1,
                "exsectionformat": "wiki",
                "titles": title,
                "format": "json",
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        full_text = next(iter(pages.values()), {}).get("extract", "")
        match = re.search(
            r"\n==\s*Histoire\s*==\n(.*?)(\n==[^=]|\Z)", full_text, flags=re.S | re.I
        )
        if match:
            text = clean_wikitext(match.group(1))
        elif full_text:
            text = clean_wikitext(full_text.split("\n\n")[0])
    except requests.RequestException as exc:
        print(f"  WARN wikipedia '{title}': {exc}", file=sys.stderr)

    if not text:
        try:
            resp = requests.get(
                f"https://fr.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}",
                headers=HEADERS,
                timeout=30,
            )
            if resp.status_code == 200:
                text = resp.json().get("extract")
        except requests.RequestException as exc:
            print(f"  WARN wikipedia summary '{title}': {exc}", file=sys.stderr)

    if text and len(text) > MAX_HISTORY_CHARS:
        text = text[:MAX_HISTORY_CHARS].rsplit(" ", 1)[0] + "…"

    cache.set(cache_key, text or "")
    return text


def fetch_attractions(title: str, cache: WikiCache) -> list[str]:
    cache_key = f"voir:{title}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    names: list[str] = []
    try:
        resp = requests.get(
            "https://fr.wikivoyage.org/w/api.php",
            params={"action": "parse", "page": title, "prop": "sections", "format": "json"},
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        payload = resp.json()
        if "error" in payload:
            cache.set(cache_key, [])
            return []
        sections = payload.get("parse", {}).get("sections", [])
        target = next(
            (s for s in sections if s["line"].strip().lower() in ("voir", "à voir", "a voir")),
            None,
        )
        if target:
            resp2 = requests.get(
                "https://fr.wikivoyage.org/w/api.php",
                params={
                    "action": "parse",
                    "page": title,
                    "prop": "wikitext",
                    "section": target["index"],
                    "format": "json",
                },
                headers=HEADERS,
                timeout=30,
            )
            resp2.raise_for_status()
            wikitext = resp2.json().get("parse", {}).get("wikitext", {}).get("*", "")

            # Le "listing" di Wikivoyage usano il parametro nom=
            for m in re.finditer(r"nom\s*=\s*([^|\}\n]+)", wikitext):
                candidate = clean_wikitext(m.group(1))
                if candidate and candidate not in names:
                    names.append(candidate)

            if not names:
                # fallback: righe puntate "* '''Nome''' ..."
                for line in wikitext.splitlines():
                    line = line.strip()
                    if line.startswith("*"):
                        bold = re.match(r"\*\s*'''([^']+)'''", line)
                        candidate = clean_wikitext(bold.group(1) if bold else line.lstrip("* "))
                        candidate = candidate.split(".")[0].split(",")[0].strip()
                        if candidate and len(candidate) < 80 and candidate not in names:
                            names.append(candidate)
    except requests.RequestException as exc:
        print(f"  WARN wikivoyage '{title}': {exc}", file=sys.stderr)

    names = names[:MAX_ATTRACTIONS]
    cache.set(cache_key, names)
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", default="data/cache/cities.json")
    parser.add_argument("--out", default="data/cache/cities.json")
    parser.add_argument("--cache", default="data/cache/wiki_cache.json")
    args = parser.parse_args()

    cities = json.loads(Path(args.cities).read_text(encoding="utf-8"))
    cache = WikiCache(Path(args.cache))

    for idx, city in enumerate(cities):
        title = city.get("wikipedia_title") or city.get("name")
        if not title:
            continue
        print(f"[{idx + 1}/{len(cities)}] {title}", file=sys.stderr)

        city["history_summary"] = fetch_history_extract(title, cache)
        time.sleep(REQUEST_DELAY)
        city["attractions"] = fetch_attractions(title, cache)
        time.sleep(REQUEST_DELAY)

        if idx % 20 == 0:
            cache.save()

    cache.save()
    Path(args.out).write_text(json.dumps(cities, ensure_ascii=False, indent=2), encoding="utf-8")
    with_history = sum(1 for c in cities if c.get("history_summary"))
    with_attractions = sum(1 for c in cities if c.get("attractions"))
    print(
        f"Storia trovata per {with_history}/{len(cities)}, attrazioni per {with_attractions}/{len(cities)}.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
