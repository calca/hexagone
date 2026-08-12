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
    minpop: document.getElementById("minpop"),
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
    const minPop = Number(els.minpop.value) || 0;
    const sort = els.sort.value;

    let list = state.cities.filter((c) => {
      const matchesName = !q || c.name.toLowerCase().includes(q);
      const matchesPop = (c.population || 0) >= minPop;
      return matchesName && matchesPop;
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
      <h2>${escapeHtml(city.name)}</h2>
      <div class="subtitle">
        ${numberFmt(city.population)} abitanti${city.population_year ? " (" + city.population_year + ")" : ""}
        ${city.wikipedia_url ? ` · <a href="${city.wikipedia_url}" target="_blank" rel="noopener">Wikipedia</a>` : ""}
      </div>

      <div class="detail-section">
        <h3>Cenni storici</h3>
        <p>${escapeHtml(city.history_summary) || "Nessun estratto disponibile."}</p>
      </div>

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
  els.minpop.addEventListener("input", applyFilters);

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
      buildMarkers();
      applyFilters();
    })
    .catch((err) => {
      els.stats.textContent = "Errore nel caricamento di data.json";
      console.error(err);
    });
})();
