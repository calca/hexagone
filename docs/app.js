(() => {
  "use strict";

  const state = {
    cities: [],
    filtered: [],
    markers: new Map(), // city.id -> L.Marker
    activeId: null,
  };

  const els = {
    stats: document.getElementById("stats"),
    search: document.getElementById("search"),
    sort: document.getElementById("sort"),
    region: document.getElementById("region"),
    department: document.getElementById("department"),
    unescoFilter: document.getElementById("unesco-filter"),
    maxpop: document.getElementById("maxpop"),
    maxpopValue: document.getElementById("maxpop-value"),
    maxpopFill: document.getElementById("maxpop-fill"),
    filters: document.querySelector(".filters"),
    filtersBadge: document.getElementById("filters-badge"),
    list: document.getElementById("city-list"),
    listMeta: document.getElementById("list-meta"),
    layout: document.getElementById("layout"),
    viewTabs: document.getElementById("view-tabs"),
    detail: document.getElementById("detail"),
    detailContent: document.getElementById("detail-content"),
    detailClose: document.getElementById("detail-close"),
    detailBackdrop: document.getElementById("detail-backdrop"),
  };

  const mobileQuery = window.matchMedia("(max-width: 860px)");

  const DEPARTMENTS = {
    "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
    "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardeche", "08": "Ardennes",
    "09": "Ariege", "10": "Aube", "11": "Aude", "12": "Aveyron",
    "13": "Bouches-du-Rhone", "14": "Calvados", "15": "Cantal", "16": "Charente",
    "17": "Charente-Maritime", "18": "Cher", "19": "Correze", "2A": "Corse-du-Sud",
    "2B": "Haute-Corse", "21": "Cote-d'Or", "22": "Cotes-d'Armor", "23": "Creuse",
    "24": "Dordogne", "25": "Doubs", "26": "Drome", "27": "Eure",
    "28": "Eure-et-Loir", "29": "Finistere", "30": "Gard", "31": "Haute-Garonne",
    "32": "Gers", "33": "Gironde", "34": "Herault", "35": "Ille-et-Vilaine",
    "36": "Indre", "37": "Indre-et-Loire", "38": "Isere", "39": "Jura",
    "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
    "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne",
    "48": "Lozere", "49": "Maine-et-Loire", "50": "Manche", "51": "Marne",
    "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse",
    "56": "Morbihan", "57": "Moselle", "58": "Nievre", "59": "Nord",
    "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dome",
    "64": "Pyrenees-Atlantiques", "65": "Hautes-Pyrenees", "66": "Pyrenees-Orientales",
    "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhone", "70": "Haute-Saone",
    "71": "Saone-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
    "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
    "79": "Deux-Sevres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
    "83": "Var", "84": "Vaucluse", "85": "Vendee", "86": "Vienne",
    "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
    "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne",
    "95": "Val-d'Oise", "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
    "974": "La Reunion", "976": "Mayotte",
  };

  // Regioni amministrative francesi (riforma 2016) come raggruppamento sopra
  // ai dipartimenti - ogni dipartimento appartiene a una sola regione.
  const REGION_DEPARTMENTS = {
    "Auvergne-Rhone-Alpes": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
    "Bourgogne-Franche-Comte": ["21", "25", "39", "58", "70", "71", "89", "90"],
    "Bretagne": ["22", "29", "35", "56"],
    "Centre-Val de Loire": ["18", "28", "36", "37", "41", "45"],
    "Corse": ["2A", "2B"],
    "Grand Est": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
    "Hauts-de-France": ["02", "59", "60", "62", "80"],
    "Ile-de-France": ["75", "77", "78", "91", "92", "93", "94", "95"],
    "Normandie": ["14", "27", "50", "61", "76"],
    "Nouvelle-Aquitaine": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
    "Occitanie": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
    "Pays de la Loire": ["44", "49", "53", "72", "85"],
    "Provence-Alpes-Cote d'Azur": ["04", "05", "06", "13", "83", "84"],
    "Guadeloupe": ["971"],
    "Martinique": ["972"],
    "Guyane": ["973"],
    "La Reunion": ["974"],
    "Mayotte": ["976"],
  };
  const DEPT_TO_REGION = {};
  Object.entries(REGION_DEPARTMENTS).forEach(([region, codes]) => {
    codes.forEach((code) => { DEPT_TO_REGION[code] = region; });
  });

  function departmentCodeFromInsee(insee) {
    if (!insee) return null;
    if (insee.startsWith("2A") || insee.startsWith("2B")) return insee.slice(0, 2);
    if (insee.startsWith("97") || insee.startsWith("98")) return insee.slice(0, 3);
    return insee.slice(0, 2);
  }

  function populateRegions(cities) {
    const regions = new Set();
    cities.forEach((c) => {
      const code = departmentCodeFromInsee(c.insee);
      const region = code && DEPT_TO_REGION[code];
      if (region) regions.add(region);
    });
    const sorted = [...regions].sort((a, b) => a.localeCompare(b, "fr"));
    const frag = document.createDocumentFragment();
    sorted.forEach((region) => {
      const opt = document.createElement("option");
      opt.value = region;
      opt.textContent = region;
      frag.appendChild(opt);
    });
    els.region.appendChild(frag);
  }

  // Popola il dropdown Dipartimento, opzionalmente ristretto a una sola
  // regione (filtro a cascata): ricostruisce le opzioni ogni volta che
  // cambia la regione selezionata, preservando il dipartimento scelto se
  // appartiene ancora alla nuova regione.
  function populateDepartments(cities, regionFilter, preserveValue) {
    const codes = new Set();
    cities.forEach((c) => {
      const code = departmentCodeFromInsee(c.insee);
      if (!code) return;
      if (regionFilter && DEPT_TO_REGION[code] !== regionFilter) return;
      codes.add(code);
    });
    const sorted = [...codes].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    els.department.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "Tutti";
    els.department.appendChild(allOpt);
    const frag = document.createDocumentFragment();
    sorted.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${code} — ${DEPARTMENTS[code] || "?"}`;
      frag.appendChild(opt);
    });
    els.department.appendChild(frag);
    els.department.value = preserveValue && codes.has(preserveValue) ? preserveValue : "";
  }

  // step non lineari: da un tetto basso fino a nessun limite ("Tutte") a destra,
  // cosi' trascinare verso destra allenta sempre il filtro (mai il contrario)
  const MAXPOP_STEPS = [10000, 20000, 50000, 100000, 250000, 500000, Infinity];
  const MAXPOP_LABELS = ["10 Mila", "20 Mila", "50 Mila", "100 Mila", "250 Mila", "500 Mila", "Tutte"];

  function updateMaxpopUI() {
    const idx = Number(els.maxpop.value);
    els.maxpopValue.textContent = MAXPOP_LABELS[idx];
    els.maxpopFill.style.width = `${(idx / (MAXPOP_STEPS.length - 1)) * 100}%`;
  }

  function setView(view) {
    els.layout.dataset.view = view;
    els.viewTabs.querySelectorAll("button").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    if (view === "map") {
      // Sincrono, non differito: leggere/scrivere le dimensioni forza comunque
      // un reflow immediato. Un setTimeout qui lasciava una finestra in cui un
      // successivo map.flyTo() (es. da showDetail) partiva mentre la mappa
      // pensava ancora di avere dimensioni 0x0 (nascosta via display:none fino
      // a un attimo prima), causando un errore "Invalid LatLng (NaN, NaN)" che
      // interrompeva silenziosamente il resto della funzione chiamante.
      map.invalidateSize();
    }
  }

  els.viewTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (btn) setView(btn.dataset.view);
  });

  function closeDetail() {
    els.detail.hidden = true;
    els.detailBackdrop.hidden = true;
    state.activeId = null;
    renderList();
  }

  els.detailBackdrop.addEventListener("click", closeDetail);

  const map = L.map("map", { zoomControl: true }).setView([46.6, 2.4], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  function numberFmt(n) {
    return n == null ? "n/d" : new Intl.NumberFormat("it-IT").format(n);
  }

  function markerRadius(hotelCount) {
    return Math.min(6 + hotelCount * 2, 22);
  }

  function buildMarkers() {
    state.cities.forEach((city) => {
      const marker = L.circleMarker([city.lat, city.lon], {
        radius: markerRadius(city.hotel_count),
        color: "#d0006f",
        weight: 1,
        fillColor: "#d0006f",
        fillOpacity: 0.55,
      });
      marker.bindPopup(popupHtml(city));
      marker.on("popupopen", () => {
        const btn = document.getElementById(`open-${city.id}`);
        if (btn) btn.addEventListener("click", () => showDetail(city.id));
      });
      state.markers.set(city.id, marker);
    });
  }

  function popupHtml(city) {
    return `
      <strong>${escapeHtml(city.name)}</strong><br>
      Popolazione: ${numberFmt(city.population)}${city.population_year ? " (" + city.population_year + ")" : ""}<br>
      Hotel: ${city.hotel_count}
      <br><button id="open-${city.id}" type="button">Vedi dettagli</button>
    `;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function renderList() {
    els.listMeta.textContent = state.filtered.length === 1
      ? "1 citta' trovata"
      : `${numberFmt(state.filtered.length)} citta' trovate`;

    if (!state.filtered.length) {
      els.list.innerHTML = `<li class="empty-state" style="cursor:default">Nessuna citta' corrisponde ai filtri.</li>`;
      return;
    }

    els.list.innerHTML = "";
    const frag = document.createDocumentFragment();
    state.filtered.forEach((city) => {
      const li = document.createElement("li");
      li.dataset.id = city.id;
      if (city.id === state.activeId) li.classList.add("active");
      li.innerHTML = `
        <span class="city-name">${escapeHtml(city.name)}</span>
        <span class="city-meta">${numberFmt(city.population)} ab. · ${city.hotel_count} hotel</span>
      `;
      li.addEventListener("click", () => showDetail(city.id, true));
      frag.appendChild(li);
    });
    els.list.appendChild(frag);
  }

  function updateFiltersBadge(region, department, unescoMode, maxpopIdx) {
    const active = [region, department, unescoMode, maxpopIdx < MAXPOP_STEPS.length - 1 ? "x" : ""].filter(Boolean).length;
    els.filtersBadge.textContent = String(active);
    els.filtersBadge.hidden = active === 0;
  }

  function applyFilters() {
    const q = els.search.value.trim().toLowerCase();
    const maxpopIdx = Number(els.maxpop.value);
    const maxPop = MAXPOP_STEPS[maxpopIdx];
    const sort = els.sort.value;
    const region = els.region.value;
    const department = els.department.value;
    const unescoMode = els.unescoFilter.value;
    updateFiltersBadge(region, department, unescoMode, maxpopIdx);

    let list = state.cities.filter((c) => {
      const matchesName = !q || c.name.toLowerCase().includes(q);
      const matchesPop = (c.population || 0) <= maxPop;
      const deptCode = departmentCodeFromInsee(c.insee);
      const matchesRegion = !region || DEPT_TO_REGION[deptCode] === region;
      const matchesDept = !department || deptCode === department;
      const hasUnesco = (c.unesco_sites || []).length > 0;
      const matchesUnesco = !unescoMode || (unescoMode === "with" ? hasUnesco : !hasUnesco);
      return matchesName && matchesPop && matchesRegion && matchesDept && matchesUnesco;
    });

    const sorters = {
      "population-desc": (a, b) => (b.population || 0) - (a.population || 0),
      "population-asc": (a, b) => (a.population || 0) - (b.population || 0),
      "name-asc": (a, b) => a.name.localeCompare(b.name, "fr"),
      "hotels-desc": (a, b) => b.hotel_count - a.hotel_count,
    };
    list.sort(sorters[sort] || sorters["population-desc"]);

    state.filtered = list;
    renderList();

    // aggiorna i marker visibili sulla mappa in base al filtro
    const visibleIds = new Set(list.map((c) => c.id));
    state.markers.forEach((marker, id) => {
      const shouldShow = visibleIds.has(id);
      const isOnMap = map.hasLayer(marker);
      if (shouldShow && !isOnMap) marker.addTo(map);
      if (!shouldShow && isOnMap) map.removeLayer(marker);
    });
  }

  const commonsGalleryCache = new Map(); // city.id -> array di immagini, o null se non trovate/fallito

  function renderGallery(cityId, images) {
    if (state.activeId !== cityId) return; // l'utente ha gia' aperto un'altra citta'
    const el = document.getElementById("gallery");
    if (!el) return;
    if (!images || !images.length) {
      el.innerHTML = `<p class="gallery-empty">Nessuna foto trovata su Wikimedia Commons.</p>`;
      return;
    }
    el.innerHTML = images
      .map(
        (img) => `
        <a href="${escapeHtml(img.pageUrl)}" target="_blank" rel="noopener" class="gallery-item" title="${escapeHtml(img.title)}">
          <img src="${escapeHtml(img.thumb)}" alt="${escapeHtml(img.title)}" loading="lazy">
        </a>`
      )
      .join("");
  }

  async function loadCityGallery(city) {
    if (commonsGalleryCache.has(city.id)) {
      renderGallery(city.id, commonsGalleryCache.get(city.id));
      return;
    }
    try {
      const query = encodeURIComponent(`${city.name} France filetype:bitmap`);
      const url =
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=8` +
        `&gsrsearch=${query}&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json&origin=*`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const pages = Object.values((data.query && data.query.pages) || {});
      // l'ordine delle chiavi dell'oggetto "pages" (pageid) NON riflette la
      // rilevanza della ricerca: MediaWiki fornisce "index" per riordinare.
      pages.sort((a, b) => (a.index || 0) - (b.index || 0));
      const images = pages
        .filter((p) => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl)
        .map((p) => ({
          thumb: p.imageinfo[0].thumburl,
          pageUrl: p.imageinfo[0].descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          title: (p.title || "").replace(/^File:/, ""),
        }));
      commonsGalleryCache.set(city.id, images);
      renderGallery(city.id, images);
    } catch (err) {
      console.error("Errore galleria Wikimedia Commons", err);
      commonsGalleryCache.set(city.id, null);
      renderGallery(city.id, null);
    }
  }

  function showDetail(cityId, panMap) {
    const city = state.cities.find((c) => c.id === cityId);
    if (!city) return;
    state.activeId = cityId;
    renderList();

    if (panMap) {
      if (mobileQuery.matches) setView("map");
      map.flyTo([city.lat, city.lon], Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
    const marker = state.markers.get(cityId);
    if (marker) marker.openPopup();

    const attractionsHtml = (city.attractions || []).length
      ? `<ul class="attractions">${city.attractions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
      : `<p>Nessuna segnalazione disponibile su Wikivoyage.</p>`;

    const unescoSites = city.unesco_sites || [];
    const monuments = city.monuments_historiques || [];
    const unescoBadge = unescoSites.length
      ? ` <span class="badge unesco" title="${escapeHtml(unescoSites.map((s) => s.name).join(", "))}">Patrimonio UNESCO</span>`
      : "";
    const heritageHtml = monuments.length
      ? `<div class="detail-section">
          <h3>Monumenti storici</h3>
          <ul class="attractions monuments">${monuments.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
        </div>`
      : "";

    const hotelsHtml = city.hotels
      .map((h) => {
        const badgeClass = h.brand === "ibis Styles" ? "styles" : "ibis";
        const searchQuery = encodeURIComponent(`${h.name} ${city.name}`);
        const links = [];
        if (h.website) links.push(`<a href="${escapeHtml(h.website)}" target="_blank" rel="noopener">Sito</a>`);
        if (h.phone) links.push(`<a href="tel:${escapeHtml(h.phone)}">${escapeHtml(h.phone)}</a>`);
        const bookLinks = [
          `<a class="book-link" href="https://all.accor.com/search/index.en.shtml?destination=${searchQuery}" target="_blank" rel="noopener sponsored">Prenota su ibis</a>`,
          `<a class="book-link" href="https://www.booking.com/searchresults.html?ss=${searchQuery}" target="_blank" rel="noopener sponsored">Prenota su Booking</a>`,
        ];
        return `
          <div class="hotel-card">
            <div class="name">${escapeHtml(h.name)} <span class="badge ${badgeClass}">${escapeHtml(h.brand)}</span></div>
            <div class="address">${escapeHtml(h.address || "Indirizzo non disponibile")}</div>
            ${links.length ? `<div class="links">${links.join("")}</div>` : ""}
            <div class="links book-links">${bookLinks.join("")}</div>
          </div>
        `;
      })
      .join("");

    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(city.name + " Francia")}`;

    els.detailContent.innerHTML = `
      <h2>${escapeHtml(city.name)}${unescoBadge}</h2>
      <div class="subtitle">
        ${numberFmt(city.population)} abitanti${city.population_year ? " (" + city.population_year + ")" : ""}
        ${city.wikipedia_url ? ` · <a href="${city.wikipedia_url}" target="_blank" rel="noopener">Wikipedia</a>` : ""}
      </div>

      <div class="detail-section gallery-section">
        <div class="gallery-header">
          <h3>Foto</h3>
          <a href="${googleImagesUrl}" target="_blank" rel="noopener" class="gallery-google-link">Cerca su Google Images ↗</a>
        </div>
        <div class="gallery" id="gallery"><p class="gallery-loading">Caricamento foto…</p></div>
        <p class="gallery-credit">Foto da <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>, licenze varie (vedi ogni foto)</p>
      </div>

      <div class="detail-section">
        <h3>Cenni storici</h3>
        <p>${escapeHtml(city.history_summary) || "Nessun estratto disponibile."}</p>
      </div>

      ${heritageHtml}

      <div class="detail-section">
        <h3>Cosa visitare in un giorno</h3>
        ${attractionsHtml}
      </div>

      <div class="detail-section">
        <h3>Hotel ibis / ibis Styles (${city.hotel_count})</h3>
        ${hotelsHtml}
      </div>
    `;
    els.detail.hidden = false;
    els.detailBackdrop.hidden = false;
    loadCityGallery(city);
  }

  els.detailClose.addEventListener("click", closeDetail);

  // Chiude i filtri appena si scorre la lista, per non sottrarle spazio.
  els.list.addEventListener(
    "scroll",
    () => {
      if (els.filters.open) els.filters.open = false;
    },
    { passive: true }
  );

  els.search.addEventListener("input", applyFilters);
  els.sort.addEventListener("change", applyFilters);
  els.region.addEventListener("change", () => {
    // cascata verso il basso: la regione restringe le opzioni di dipartimento
    populateDepartments(state.cities, els.region.value || null, els.department.value);
    applyFilters();
  });
  els.department.addEventListener("change", () => {
    // cascata verso l'alto: scegliere un dipartimento imposta/mostra la sua regione
    const region = DEPT_TO_REGION[els.department.value] || "";
    if (els.region.value !== region) {
      els.region.value = region;
      populateDepartments(state.cities, region || null, els.department.value);
    }
    applyFilters();
  });
  els.unescoFilter.addEventListener("change", applyFilters);
  els.maxpop.addEventListener("input", () => {
    updateMaxpopUI();
    applyFilters();
  });
  updateMaxpopUI();

  fetch("data.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      state.cities = data.cities || [];
      const sampleNote = data.sample ? " — ⚠ DATI DI ESEMPIO, esegui la pipeline per i dati reali" : "";
      els.stats.textContent =
        `${numberFmt(data.stats.cities)} citta' · ${numberFmt(data.stats.hotels)} hotel ` +
        `(${numberFmt(data.stats.ibis)} ibis, ${numberFmt(data.stats.ibis_styles)} ibis Styles)${sampleNote}`;
      populateRegions(state.cities);
      populateDepartments(state.cities);
      buildMarkers();
      applyFilters();
    })
    .catch((err) => {
      els.stats.textContent = "Errore nel caricamento di data.json";
      console.error(err);
    });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.error("SW registration failed", err));
    });
  }
})();
