# hexagone — mappa ibis & ibis Styles in Francia

[![Sito pubblicato](https://img.shields.io/badge/demo-GitHub%20Pages-d0006f)](https://calca.github.io/hexagone/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**🌐 Sito live: https://calca.github.io/hexagone/**
**📦 Repository: https://github.com/calca/hexagone**

Pipeline Python + sito statico che mostra tutti gli hotel **ibis** e **ibis
Styles** in Francia, raggruppati per citta'. Per ogni citta' vengono
mostrati popolazione, cenni storici e cosa visitare in un giorno.

- **Dati hotel**: OpenStreetMap (Overpass API) — licenza ODbL
- **Risoluzione del comune di appartenenza di ogni hotel** (per nome o per coordinate): API geografica del governo francese ([geo.api.gouv.fr](https://geo.api.gouv.fr/)) — dati pubblici INSEE/IGN, licenza Etalab Open Licence 2.0
- **Popolazione**: Wikidata (SPARQL) — licenza CC0
- **Storia e attrazioni**: Wikipedia e Wikivoyage in francese — licenza CC BY-SA
- **Frontend**: HTML/CSS/JS statico con mappa Leaflet (vendorizzata in `docs/vendor/`, nessuna dipendenza da CDN esterne), pubblicabile su GitHub Pages
- **Licenza**: [MIT](LICENSE) per codice e sito. I dati restano soggetti alle licenze delle rispettive fonti (ODbL / Etalab / CC0 / CC BY-SA elencate sopra).

## Struttura del progetto

```
scripts/
  overpass_client.py    client HTTP verso Overpass API (con failover su piu' mirror)
  fetch_hotels.py        step 1: scarica gli hotel ibis/ibis Styles in Francia
  resolve_cities.py      step 2: raggruppa per comune, risolve INSEE via geo.api.gouv.fr
                          (per nome, o per coordinate per hotel senza addr:city, con
                          cache resumibile su disco)
  enrich_wikidata.py     step 3: popolazione via SPARQL (batch)
  enrich_wikimedia.py    step 4: storia (Wikipedia) e attrazioni (Wikivoyage), con cache
  build_dataset.py       step 5: genera docs/data.json (il "DB" del sito)
  pipeline.py            esegue tutti gli step in sequenza
docs/                    sito statico (GitHub Pages), installabile come PWA
  index.html / style.css / app.js
  about.html               pagina "Info & note legali" (fonti dati, disclaimer di non affiliazione)
  manifest.webmanifest     manifest PWA (nome, icone, colori)
  sw.js                    service worker (cache offline dell'app shell + dati)
  icons/                   favicon e icone dell'app (incl. varianti maskable)
  data.json               dataset consumato dal frontend (contiene DATI DI ESEMPIO finche' non esegui la pipeline)
  vendor/leaflet/          libreria Leaflet vendorizzata
.github/workflows/
  refresh-data.yml        rigenera docs/data.json (schedulato + manuale) e lo committa
  pages.yml               pubblica docs/ su GitHub Pages ad ogni push su main
```

## ⚠️ Nota sui dati inclusi nel repo

Il file `docs/data.json` committato per default contiene **7 citta' di
esempio** con dati illustrativi (indirizzi hotel segnaposto), solo per
mostrare subito l'interfaccia funzionante. Per generare il dataset reale
con tutti gli hotel ibis/ibis Styles di Francia devi eseguire la pipeline
(in locale o tramite la GitHub Action), che ha bisogno di accesso a
internet verso Overpass API, Wikidata, Wikipedia e Wikivoyage.

## Eseguire la pipeline in locale

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# esecuzione completa (hotel -> citta' -> popolazione -> storia/attrazioni -> dataset)
python scripts/pipeline.py

# giro veloce senza storia/attrazioni (piu' rapido, utile per iterare)
python scripts/pipeline.py --skip-wikimedia

# riesegue solo uno step (usa i file gia' presenti in data/cache/)
python scripts/pipeline.py --only wikidata
```

Il risultato finale e' scritto in `docs/data.json`. I file intermedi (in
`data/cache/`, non versionati) permettono di riprendere/ripetere singoli
step senza rifare tutto da capo.

Tempo indicativo: la fase Overpass richiede qualche minuto, l'arricchimento
Wikipedia/Wikivoyage (uno per citta') e' la piu' lenta — con ~250-350
citta' puo' richiedere 5-15 minuti (rate limiting incluso per rispettare
le policy di Wikimedia/OSM).

## Pubblicare su GitHub Pages

1. Fai push del branch su GitHub e fai merge su `main`.
2. In **Settings → Pages**, imposta *Source: GitHub Actions* (il workflow
   `pages.yml` e' gia' pronto e pubblica automaticamente la cartella `docs/`
   ad ogni push su `main`).
3. Per aggiornare i dati periodicamente, il workflow `refresh-data.yml`
   gira ogni lunedi' alle 03:00 UTC (o puoi lanciarlo manualmente da
   Actions → *Refresh dataset* → *Run workflow*): esegue la pipeline con
   accesso internet completo (i runner GitHub Actions non hanno le
   restrizioni di rete di eventuali sandbox), e se `docs/data.json` cambia
   lo committa su `main`, il che fa scattare automaticamente un nuovo
   deploy di Pages.

## Schema di `docs/data.json`

```jsonc
{
  "generated_at": "2026-08-11T...",
  "stats": { "cities": 250, "hotels": 480, "ibis": 400, "ibis_styles": 80 },
  "cities": [
    {
      "id": "paris",
      "name": "Paris",
      "insee": "75056",
      "wikidata": "Q90",
      "lat": 48.8566, "lon": 2.3522,
      "population": 2133111,
      "population_year": "2021",
      "history_summary": "...",
      "attractions": ["Torre Eiffel", "..."],
      "wikipedia_url": "https://fr.wikipedia.org/wiki/Paris",
      "hotel_count": 12,
      "hotels": [
        { "osm_id": "node/123", "name": "ibis Paris Bastille", "brand": "ibis",
          "address": "...", "postcode": "75011", "lat": 48.85, "lon": 2.37,
          "phone": null, "website": null }
      ]
    }
  ]
}
```

Nel frontend, la **popolazione** e' la colonna usata per ordinare/filtrare
l'elenco citta' (campo "Popolazione minima" e ordinamento nella sidebar).

## Limiti noti

- La corrispondenza citta' → comune ufficiale (per popolazione/INSEE) si
  basa sul nome (`addr:city` dell'hotel) disambiguato per dipartimento e,
  in subordine, per vicinanza geografica: casi limite (comuni omonimi nello
  stesso dipartimento, frazioni non censite come comune) potrebbero non
  risolversi e restano nel dataset con popolazione/storia mancanti invece
  di essere scartati.
- "Cosa visitare in un giorno" dipende dalla presenza e qualita' della
  sezione "Voir" nella pagina Wikivoyage francese della citta'; per centri
  minori potrebbe essere vuoto.
- Rispetta le policy di utilizzo di Overpass API e Wikimedia (User-Agent
  identificativo gia' impostato negli script, non aumentare la frequenza
  delle richieste).

## Licenza

Codice e sito sono rilasciati con licenza [MIT](LICENSE). I dati mostrati
provengono da fonti terze con licenze proprie e vanno attribuiti di
conseguenza: OpenStreetMap (ODbL), Wikidata (CC0), Wikipedia/Wikivoyage in
francese (CC BY-SA) — vedi i link diretti nella scheda di ogni citta' sul
sito.
