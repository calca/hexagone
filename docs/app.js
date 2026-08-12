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
    department: document.getElementById("department"),
    unescoFilter: document.getElementById("unesco-filter"),
    maxpop: document.getElementById("maxpop"),
    maxpopValue: document.getElementById("maxpop-value"),
    maxpopFill: document.getElementById("maxpop-fill"),
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

  function departmentCodeFromInsee(insee) {
    if (!insee) return null;
    if (insee.startsWith("2A") || insee.startsWith("2B")) return insee.slice(0, 2);
    if (insee.startsWith("97") || insee.startsWith("98")) return insee.slice(0, 3);
    return insee.slice(0, 2);
  }

  function populateDepartments(cities) {
    const codes = new Set();
    cities.forEach((c) => {
      const code = departmentCodeFromInsee(c.insee);
      if (code) codes.add(code);
    });
    const sorted = [...codes].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    const frag = document.createDocumentFragment();
    sorted.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${code} — ${DEPARTMENTS[code] || "?"}`;
      frag.appendChild(opt);
    });
    els.department.appendChild(frag);
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
      setTimeout(() => map.invalidateSize(), 50);
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

  function applyFilters() {
    const q = els.search.value.trim().toLowerCase();
    const maxPop = MAXPOP_STEPS[Number(els.maxpop.value)];
    const sort = els.sort.value;
    const department = els.department.value;
    const unescoMode = els.unescoFilter.value;

    let list = state.cities.filter((c) => {
      const matchesName = !q || c.name.toLowerCase().includes(q);
      const matchesPop = (c.population || 0) <= maxPop;
      const matchesDept = !department || departmentCodeFromInsee(c.insee) === department;
      const hasUnesco = (c.unesco_sites || []).length > 0;
      const matchesUnesco = !unescoMode || (unescoMode === "with" ? hasUnesco : !hasUnesco);
      return matchesName && matchesPop && matchesDept && matchesUnesco;
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

    els.detailContent.innerHTML = `
      <h2>${escapeHtml(city.name)}${unescoBadge}</h2>
      <div class="subtitle">
        ${numberFmt(city.population)} abitanti${city.population_year ? " (" + city.population_year + ")" : ""}
        ${city.wikipedia_url ? ` · <a href="${city.wikipedia_url}" target="_blank" rel="noopener">Wikipedia</a>` : ""}
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
  }

  els.detailClose.addEventListener("click", closeDetail);

  els.search.addEventListener("input", applyFilters);
  els.sort.addEventListener("change", applyFilters);
  els.department.addEventListener("change", applyFilters);
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
