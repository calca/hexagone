(() => {
  "use strict";

  // ---------- Routing (URL puliti /citta/{id}) ----------
  // Decodifica il redirect di docs/404.html (?p=/citta/lyon -> /citta/lyon)
  // PRIMA di leggere la posizione altrove in questo file: deve girare
  // subito, altrimenti il resto del codice vedrebbe ancora l'URL con la
  // query string invece del path pulito.
  (function decodeRedirectFromNotFoundPage() {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("p");
    if (p == null) return;
    params.delete("p");
    const qs = params.toString();
    const newUrl =
      window.location.pathname.replace(/\/$/, "") + p + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  })();

  // Base path del sito: "/hexagone" su GitHub Pages, "" in locale (servito
  // dalla root). Stessa logica (hardcoded sul nome del repo, non dedotta
  // dal path) di docs/404.html: deve restare identica li' e qui, altrimenti
  // le URL costruite da app.js e quelle decodificate da 404.html divergono.
  function computeBasePath() {
    const REPO_BASE = "/hexagone";
    const pathname = window.location.pathname;
    return pathname === REPO_BASE || pathname.indexOf(REPO_BASE + "/") === 0 ? REPO_BASE : "";
  }
  const BASE_PATH = computeBasePath();

  function cityPath(cityId) {
    return `${BASE_PATH}/citta/${cityId}`;
  }

  function homePath() {
    return `${BASE_PATH}/`;
  }

  function parseCityIdFromLocation() {
    const match = window.location.pathname.match(/\/citta\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  const state = {
    cities: [],
    filtered: [],
    markers: new Map(), // city.id -> L.Marker
    activeId: null,
    userMarker: null, // L.CircleMarker per "la mia posizione", creato al primo uso
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

  // ---------- i18n ----------
  // Solo l'interfaccia viene tradotta (it/fr/en): i contenuti derivati da
  // Wikipedia/Wikivoyage (storia, attrazioni) restano in francese in ogni
  // lingua, perche' tradurli richiederebbe interrogare le wiki it/en (con
  // scarsa copertura per i piccoli comuni francesi) o un servizio di
  // traduzione a pagamento, non sostenibile per un sito statico senza backend.
  const LANG_STORAGE_KEY = "hexagone-lang";
  const DEFAULT_LANG = "it";
  const NUMBER_LOCALES = { it: "it-IT", fr: "fr-FR", en: "en-GB" };

  const TRANSLATIONS = {
    it: {
      tagline: "ibis & ibis Styles — Francia",
      loading: "Caricamento dati…",
      ariaView: "Vista",
      tabList: "Elenco",
      tabMap: "Mappa",
      locateMe: "La mia posizione",
      locateDenied: "Permesso di geolocalizzazione negato.",
      locateError: "Impossibile ottenere la posizione.",
      youAreHere: "Sei qui",
      searchPlaceholder: "Cerca citta'…",
      filtersLabel: "Filtri",
      sortLabel: "Ordina per",
      sortPopDesc: "Popolazione ↓",
      sortPopAsc: "Popolazione ↑",
      sortNameAsc: "Nome A→Z",
      sortHotelsDesc: "N. hotel ↓",
      regionLabel: "Regione",
      allRegions: "Tutte",
      departmentLabel: "Dipartimento",
      allDepartments: "Tutti",
      unescoLabel: "UNESCO",
      unescoAll: "Tutte le citta'",
      unescoWith: "Solo con sito UNESCO",
      unescoWithout: "Solo senza sito UNESCO",
      maxpopLabel: "Popolazione massima",
      maxpopTickMin: "10 Mila",
      maxpopTickAll: "Tutte",
      maxpopSteps: ["10 Mila", "20 Mila", "50 Mila", "100 Mila", "250 Mila", "500 Mila", "Tutte"],
      ariaCityList: "Elenco citta'",
      close: "Chiudi",
      licenseWord: "Licenza",
      ariaUsefulLinks: "Link utili",
      footerAbout: "Info & note legali",
      langAria: "Lingua",
      notAvailable: "n/d",
      population: "Popolazione:",
      hotelsCount: "Hotel:",
      viewDetails: "Vedi dettagli",
      cityFoundOne: "1 citta' trovata",
      citiesFound: "{n} citta' trovate",
      noCitiesMatch: "Nessuna citta' corrisponde ai filtri.",
      cityMetaPop: "ab.",
      cityMetaHotels: "hotel",
      inhabitants: "abitanti",
      wikipediaLink: "Wikipedia",
      photosTitle: "Foto",
      googleImagesLink: "Cerca su Google Images ↗",
      loadingPhotos: "Caricamento foto…",
      noPhotos: "Nessuna foto trovata su Wikimedia Commons.",
      galleryCredit: "Foto da Wikimedia Commons, licenze varie (vedi ogni foto)",
      historyTitle: "Cenni storici",
      noExtract: "Nessun estratto disponibile.",
      monumentsTitle: "Monumenti storici",
      unescoBadge: "Patrimonio UNESCO",
      attractionsTitle: "Cosa visitare in un giorno",
      noAttractions: "Nessuna segnalazione disponibile su Wikivoyage.",
      hotelsTitle: "Hotel ibis / ibis Styles ({n})",
      addressUnavailable: "Indirizzo non disponibile",
      siteLink: "Sito",
      bookIbis: "Prenota su ibis",
      bookBooking: "Prenota su Booking",
      statsTemplate: "{cities} citta' · {hotels} hotel ({ibis} ibis, {styles} ibis Styles)",
      sampleDataWarning: " — ⚠ DATI DI ESEMPIO, esegui la pipeline per i dati reali",
      loadError: "Errore nel caricamento di data.json",
      pageTitleCity: "{name} — hotel ibis & ibis Styles | hexagone",
      metaDescriptionCity: "{count} hotel ibis e ibis Styles a {name} ({population} abitanti): indirizzi, prenotazione, storia e cosa visitare.",
      welcomeReopen: "Cos'è hexagone?",
      welcomePrev: "Indietro",
      welcomeNext: "Avanti",
      welcomeStart: "Inizia a esplorare",
      welcomeSteps: [
        {
          title: "Benvenuto su hexagone",
          body: "Una mappa gratuita e open source di tutti gli hotel ibis e ibis Styles in Francia — oltre 600 hotel in più di 380 città.",
        },
        {
          title: "Cerca e filtra",
          body: "Cerca una città o filtra per regione, dipartimento, popolazione massima e presenza di un sito UNESCO. Passa dalla vista elenco alla mappa quando vuoi.",
        },
        {
          title: "Ogni città, in dettaglio",
          body: "Per ogni città trovi popolazione, cenni storici, cosa visitare in un giorno, siti UNESCO e monumenti storici nelle vicinanze, con foto da Wikimedia Commons.",
        },
        {
          title: "Prenota e portala con te",
          body: "Apri l'hotel su Google Maps o prenota su ibis.com/Booking. Installa hexagone come app, funziona anche offline ed è disponibile in italiano, francese e inglese.",
        },
      ],
    },
    fr: {
      tagline: "ibis & ibis Styles — France",
      loading: "Chargement des données…",
      ariaView: "Vue",
      tabList: "Liste",
      tabMap: "Carte",
      locateMe: "Ma position",
      locateDenied: "Autorisation de géolocalisation refusée.",
      locateError: "Impossible d'obtenir la position.",
      youAreHere: "Vous êtes ici",
      searchPlaceholder: "Rechercher une ville…",
      filtersLabel: "Filtres",
      sortLabel: "Trier par",
      sortPopDesc: "Population ↓",
      sortPopAsc: "Population ↑",
      sortNameAsc: "Nom A→Z",
      sortHotelsDesc: "Nb. hôtels ↓",
      regionLabel: "Région",
      allRegions: "Toutes",
      departmentLabel: "Département",
      allDepartments: "Tous",
      unescoLabel: "UNESCO",
      unescoAll: "Toutes les villes",
      unescoWith: "Uniquement avec site UNESCO",
      unescoWithout: "Uniquement sans site UNESCO",
      maxpopLabel: "Population maximale",
      maxpopTickMin: "10 mille",
      maxpopTickAll: "Toutes",
      maxpopSteps: ["10 mille", "20 mille", "50 mille", "100 mille", "250 mille", "500 mille", "Toutes"],
      ariaCityList: "Liste des villes",
      close: "Fermer",
      licenseWord: "Licence",
      ariaUsefulLinks: "Liens utiles",
      footerAbout: "Infos & mentions légales",
      langAria: "Langue",
      notAvailable: "n/d",
      population: "Population :",
      hotelsCount: "Hôtels :",
      viewDetails: "Voir les détails",
      cityFoundOne: "1 ville trouvée",
      citiesFound: "{n} villes trouvées",
      noCitiesMatch: "Aucune ville ne correspond aux filtres.",
      cityMetaPop: "hab.",
      cityMetaHotels: "hôtels",
      inhabitants: "habitants",
      wikipediaLink: "Wikipédia",
      photosTitle: "Photos",
      googleImagesLink: "Rechercher sur Google Images ↗",
      loadingPhotos: "Chargement des photos…",
      noPhotos: "Aucune photo trouvée sur Wikimedia Commons.",
      galleryCredit: "Photos de Wikimedia Commons, licences diverses (voir chaque photo)",
      historyTitle: "Histoire",
      noExtract: "Aucun extrait disponible.",
      monumentsTitle: "Monuments historiques",
      unescoBadge: "Patrimoine UNESCO",
      attractionsTitle: "Que voir en une journée",
      noAttractions: "Aucune suggestion disponible sur Wikivoyage.",
      hotelsTitle: "Hôtels ibis / ibis Styles ({n})",
      addressUnavailable: "Adresse non disponible",
      siteLink: "Site",
      bookIbis: "Réserver sur ibis",
      bookBooking: "Réserver sur Booking",
      statsTemplate: "{cities} villes · {hotels} hôtels ({ibis} ibis, {styles} ibis Styles)",
      sampleDataWarning: " — ⚠ DONNÉES D'EXEMPLE, exécutez le pipeline pour les données réelles",
      loadError: "Erreur lors du chargement de data.json",
      pageTitleCity: "{name} — hôtels ibis & ibis Styles | hexagone",
      metaDescriptionCity: "{count} hôtels ibis et ibis Styles à {name} ({population} habitants) : adresses, réservation, histoire et que voir.",
      welcomeReopen: "Qu'est-ce que hexagone ?",
      welcomePrev: "Précédent",
      welcomeNext: "Suivant",
      welcomeStart: "Commencer à explorer",
      welcomeSteps: [
        {
          title: "Bienvenue sur hexagone",
          body: "Une carte gratuite et open source de tous les hôtels ibis et ibis Styles en France — plus de 600 hôtels dans plus de 380 villes.",
        },
        {
          title: "Recherchez et filtrez",
          body: "Recherchez une ville ou filtrez par région, département, population maximale et présence d'un site UNESCO. Passez de la liste à la carte à tout moment.",
        },
        {
          title: "Chaque ville, en détail",
          body: "Pour chaque ville : population, histoire, que voir en une journée, sites UNESCO et monuments historiques à proximité, avec des photos de Wikimedia Commons.",
        },
        {
          title: "Réservez et emportez-la avec vous",
          body: "Ouvrez l'hôtel sur Google Maps ou réservez sur ibis.com/Booking. Installez hexagone comme application, elle fonctionne aussi hors ligne et existe en italien, français et anglais.",
        },
      ],
    },
    en: {
      tagline: "ibis & ibis Styles — France",
      loading: "Loading data…",
      ariaView: "View",
      tabList: "List",
      tabMap: "Map",
      locateMe: "My location",
      locateDenied: "Location permission denied.",
      locateError: "Couldn't get your location.",
      youAreHere: "You are here",
      searchPlaceholder: "Search for a city…",
      filtersLabel: "Filters",
      sortLabel: "Sort by",
      sortPopDesc: "Population ↓",
      sortPopAsc: "Population ↑",
      sortNameAsc: "Name A→Z",
      sortHotelsDesc: "No. hotels ↓",
      regionLabel: "Region",
      allRegions: "All",
      departmentLabel: "Department",
      allDepartments: "All",
      unescoLabel: "UNESCO",
      unescoAll: "All cities",
      unescoWith: "Only with UNESCO site",
      unescoWithout: "Only without UNESCO site",
      maxpopLabel: "Maximum population",
      maxpopTickMin: "10K",
      maxpopTickAll: "All",
      maxpopSteps: ["10K", "20K", "50K", "100K", "250K", "500K", "All"],
      ariaCityList: "City list",
      close: "Close",
      licenseWord: "License",
      ariaUsefulLinks: "Useful links",
      footerAbout: "About & legal notes",
      langAria: "Language",
      notAvailable: "n/a",
      population: "Population:",
      hotelsCount: "Hotels:",
      viewDetails: "View details",
      cityFoundOne: "1 city found",
      citiesFound: "{n} cities found",
      noCitiesMatch: "No city matches the filters.",
      cityMetaPop: "pop.",
      cityMetaHotels: "hotels",
      inhabitants: "inhabitants",
      wikipediaLink: "Wikipedia",
      photosTitle: "Photos",
      googleImagesLink: "Search Google Images ↗",
      loadingPhotos: "Loading photos…",
      noPhotos: "No photos found on Wikimedia Commons.",
      galleryCredit: "Photos from Wikimedia Commons, various licenses (see each photo)",
      historyTitle: "History",
      noExtract: "No extract available.",
      monumentsTitle: "Historic monuments",
      unescoBadge: "UNESCO heritage",
      attractionsTitle: "What to see in a day",
      noAttractions: "No suggestions available on Wikivoyage.",
      hotelsTitle: "ibis / ibis Styles hotels ({n})",
      addressUnavailable: "Address not available",
      siteLink: "Website",
      bookIbis: "Book on ibis",
      bookBooking: "Book on Booking",
      statsTemplate: "{cities} cities · {hotels} hotels ({ibis} ibis, {styles} ibis Styles)",
      sampleDataWarning: " — ⚠ SAMPLE DATA, run the pipeline for real data",
      loadError: "Error loading data.json",
      pageTitleCity: "{name} — ibis & ibis Styles hotels | hexagone",
      metaDescriptionCity: "{count} ibis and ibis Styles hotels in {name} ({population} inhabitants): addresses, booking, history and what to see.",
      welcomeReopen: "What is hexagone?",
      welcomePrev: "Back",
      welcomeNext: "Next",
      welcomeStart: "Start exploring",
      welcomeSteps: [
        {
          title: "Welcome to hexagone",
          body: "A free, open source map of every ibis and ibis Styles hotel in France — over 600 hotels in more than 380 cities.",
        },
        {
          title: "Search and filter",
          body: "Search for a city or filter by region, department, maximum population and UNESCO site. Switch between the list and map views whenever you want.",
        },
        {
          title: "Every city, in detail",
          body: "Each city page shows population, history, what to see in a day, nearby UNESCO sites and historic monuments, with photos from Wikimedia Commons.",
        },
        {
          title: "Book and take it with you",
          body: "Open the hotel on Google Maps or book on ibis.com/Booking. Install hexagone as an app, it works offline too, and it's available in Italian, French and English.",
        },
      ],
    },
  };

  function detectLang() {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
    const browserLangs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const raw of browserLangs) {
      const code = raw.slice(0, 2).toLowerCase();
      if (TRANSLATIONS[code]) return code;
    }
    return DEFAULT_LANG;
  }

  state.lang = detectLang();
  state.lastData = null; // ultimo payload data.json, per ricalcolare le stats al cambio lingua

  function t(key, vars) {
    const dict = TRANSLATIONS[state.lang] || TRANSLATIONS[DEFAULT_LANG];
    let str = dict[key] != null ? dict[key] : TRANSLATIONS[DEFAULT_LANG][key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return str;
  }

  // Il manifest PWA viene letto dal browser soprattutto al momento
  // dell'installazione: cambiarlo a runtime non aggiorna un'app gia'
  // installata, ma assicura che chi installa dopo aver scelto la lingua
  // veda nome/descrizione nella lingua corretta.
  const MANIFEST_BY_LANG = { it: "manifest.webmanifest", fr: "manifest.fr.webmanifest", en: "manifest.en.webmanifest" };

  function applyStaticTranslations() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });
    const manifestLink = document.getElementById("manifest-link");
    if (manifestLink) manifestLink.href = MANIFEST_BY_LANG[state.lang] || MANIFEST_BY_LANG[DEFAULT_LANG];
  }

  function renderStats() {
    if (!state.lastData) return;
    const data = state.lastData;
    const sampleNote = data.sample ? t("sampleDataWarning") : "";
    els.stats.textContent =
      t("statsTemplate", {
        cities: numberFmt(data.stats.cities),
        hotels: numberFmt(data.stats.hotels),
        ibis: numberFmt(data.stats.ibis),
        styles: numberFmt(data.stats.ibis_styles),
      }) + sampleNote;
  }

  function rebindPopups() {
    state.markers.forEach((marker, id) => {
      const city = state.cities.find((c) => c.id === id);
      if (city) marker.setPopupContent(popupHtml(city));
    });
  }

  // ---------- Meta tag dinamici per pagina citta' ----------
  // Approccio "client-side routing": niente pagine HTML separate per
  // citta' (che sarebbero il modo piu' affidabile per la SEO, indicizzabili
  // anche senza eseguire JS), ma URL puliti + history API + meta tag
  // aggiornati dopo il render, cosi' un link diretto/condiviso a una citta'
  // e' comunque leggibile e Google puo' indicizzarlo se esegue il JS della
  // pagina (cosa che fa nella maggior parte dei casi, non garantita al 100%).
  const SITE_ORIGIN = "https://calca.github.io";
  const DEFAULT_META = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || "",
    url: document.querySelector('meta[property="og:url"]')?.content || `${SITE_ORIGIN}${homePath()}`,
  };

  function setMeta(title, description, url) {
    document.title = title;
    const setContent = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.content = value;
    };
    setContent('meta[name="description"]', description);
    setContent('meta[property="og:title"]', title);
    setContent('meta[property="og:description"]', description);
    setContent('meta[property="og:url"]', url);
    setContent('meta[name="twitter:title"]', title);
    setContent('meta[name="twitter:description"]', description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = url;
  }

  function setCityMeta(city) {
    const title = t("pageTitleCity", { name: city.name });
    const description = t("metaDescriptionCity", {
      name: city.name,
      count: city.hotel_count,
      population: numberFmt(city.population),
    });
    setMeta(title, description, `${SITE_ORIGIN}${cityPath(city.id)}`);
  }

  function resetMeta() {
    setMeta(DEFAULT_META.title, DEFAULT_META.description, DEFAULT_META.url);
  }

  function setLang(lang) {
    if (!TRANSLATIONS[lang] || lang === state.lang) return;
    state.lang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.querySelectorAll("#lang-switch button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    applyStaticTranslations();
    updateMaxpopUI();
    populateDepartments(state.cities, els.region.value || null, els.department.value);
    renderStats();
    applyFilters();
    rebindPopups();
    if (state.activeId != null) showDetail(state.activeId, false);
    if (!elsWelcome.modal.hidden) renderWelcomeStep();
  }

  document.getElementById("lang-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });

  // ---------- Modal di benvenuto (intro al primo accesso) ----------
  // Mostrata in automatico solo la prima volta (flag in localStorage, stesso
  // pattern usato per la lingua), e sempre riapribile dal link in footer.
  const WELCOME_STORAGE_KEY = "hexagone-welcome-seen";
  const WELCOME_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3zM9 7v13M15 4v13"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1M10 21v-4h4v4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
  ];

  const elsWelcome = {
    backdrop: document.getElementById("welcome-backdrop"),
    modal: document.getElementById("welcome-modal"),
    steps: document.getElementById("welcome-steps"),
    dots: document.getElementById("welcome-dots"),
    prev: document.getElementById("welcome-prev"),
    next: document.getElementById("welcome-next"),
    close: document.getElementById("welcome-close"),
    reopen: document.getElementById("welcome-reopen"),
  };

  let welcomeStepIndex = 0;

  function welcomeSteps() {
    return TRANSLATIONS[state.lang].welcomeSteps || TRANSLATIONS[DEFAULT_LANG].welcomeSteps;
  }

  function renderWelcomeStep() {
    const steps = welcomeSteps();
    const step = steps[welcomeStepIndex];
    elsWelcome.steps.innerHTML = `
      <div class="welcome-icon" aria-hidden="true">${WELCOME_ICONS[welcomeStepIndex]}</div>
      <h2 class="welcome-title" id="welcome-title">${escapeHtml(step.title)}</h2>
      <p class="welcome-text">${escapeHtml(step.body)}</p>
    `;
    elsWelcome.dots.innerHTML = steps
      .map((_, i) => `<span class="welcome-dot${i === welcomeStepIndex ? " active" : ""}"></span>`)
      .join("");
    elsWelcome.prev.hidden = welcomeStepIndex === 0;
    elsWelcome.next.textContent = welcomeStepIndex === steps.length - 1 ? t("welcomeStart") : t("welcomeNext");
    elsWelcome.prev.textContent = t("welcomePrev");
  }

  function openWelcome() {
    welcomeStepIndex = 0;
    renderWelcomeStep();
    elsWelcome.backdrop.hidden = false;
    elsWelcome.modal.hidden = false;
  }

  function closeWelcome() {
    elsWelcome.backdrop.hidden = true;
    elsWelcome.modal.hidden = true;
    localStorage.setItem(WELCOME_STORAGE_KEY, "1");
  }

  elsWelcome.next.addEventListener("click", () => {
    const steps = welcomeSteps();
    if (welcomeStepIndex < steps.length - 1) {
      welcomeStepIndex++;
      renderWelcomeStep();
    } else {
      closeWelcome();
    }
  });
  elsWelcome.prev.addEventListener("click", () => {
    if (welcomeStepIndex > 0) {
      welcomeStepIndex--;
      renderWelcomeStep();
    }
  });
  elsWelcome.close.addEventListener("click", closeWelcome);
  elsWelcome.backdrop.addEventListener("click", closeWelcome);
  elsWelcome.reopen.addEventListener("click", openWelcome);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elsWelcome.modal.hidden) closeWelcome();
  });

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
    allOpt.textContent = t("allDepartments");
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

  function updateMaxpopUI() {
    const idx = Number(els.maxpop.value);
    const labels = TRANSLATIONS[state.lang].maxpopSteps;
    els.maxpopValue.textContent = labels[idx];
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

  function closeDetail(updateHistory = true) {
    els.detail.hidden = true;
    els.detailBackdrop.hidden = true;
    state.activeId = null;
    renderList();
    resetMeta();
    if (updateHistory && window.location.pathname !== homePath()) {
      window.history.pushState({ cityId: null }, "", homePath());
    }
  }

  els.detailBackdrop.addEventListener("click", () => closeDetail());

  const map = L.map("map", { zoomControl: true }).setView([46.6, 2.4], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Bottone "la mia posizione": geolocalizzazione del browser, nessuna
  // libreria esterna (il sito non dipende da CDN). Icona a mirino disegnata
  // inline in SVG per restare nitida a qualunque zoom/DPI, invece di
  // un'emoji il cui rendering varia da un sistema operativo all'altro.
  const LocateControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-locate");
      const link = L.DomUtil.create("a", "locate-btn", container);
      link.href = "#";
      link.setAttribute("role", "button");
      link.setAttribute("data-i18n-title", "locateMe");
      link.setAttribute("data-i18n-aria-label", "locateMe");
      link.title = t("locateMe");
      link.setAttribute("aria-label", t("locateMe"));
      link.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>' +
        '<line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(link, "click", L.DomEvent.stop);
      L.DomEvent.on(link, "click", locateUser);
      return container;
    },
  });
  map.addControl(new LocateControl());

  function locateUser() {
    const link = document.querySelector(".leaflet-control-locate .locate-btn");
    if (!("geolocation" in navigator)) {
      alert(t("locateError"));
      return;
    }
    link.classList.add("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        link.classList.remove("locating");
        const { latitude, longitude } = pos.coords;
        if (state.userMarker) {
          state.userMarker.setLatLng([latitude, longitude]);
        } else {
          state.userMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#1a73e8",
            weight: 2,
            fillColor: "#4285f4",
            fillOpacity: 0.9,
          })
            .addTo(map)
            .bindPopup(t("youAreHere"));
        }
        map.setView([latitude, longitude], 13);
      },
      (err) => {
        link.classList.remove("locating");
        alert(err.code === err.PERMISSION_DENIED ? t("locateDenied") : t("locateError"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function numberFmt(n) {
    return n == null ? t("notAvailable") : new Intl.NumberFormat(NUMBER_LOCALES[state.lang]).format(n);
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
      ${t("population")} ${numberFmt(city.population)}${city.population_year ? " (" + city.population_year + ")" : ""}<br>
      ${t("hotelsCount")} ${city.hotel_count}
      <br><button id="open-${city.id}" type="button">${t("viewDetails")}</button>
    `;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // Cosi' cercare "cote" trova anche "Côte d'Azur", "Chatelaillon" trova
  // "Châtelaillon" ecc.: normalizza togliendo i segni diacritici invece di
  // confrontare le stringhe cosi' come sono.
  function stripDiacritics(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function renderList() {
    els.listMeta.textContent = state.filtered.length === 1
      ? t("cityFoundOne")
      : t("citiesFound", { n: numberFmt(state.filtered.length) });

    if (!state.filtered.length) {
      els.list.innerHTML = `<li class="empty-state" style="cursor:default">${t("noCitiesMatch")}</li>`;
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
        <span class="city-meta">${numberFmt(city.population)} ${t("cityMetaPop")} · ${city.hotel_count} ${t("cityMetaHotels")}</span>
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

    const qNorm = stripDiacritics(q);
    let list = state.cities.filter((c) => {
      const matchesName = !q || stripDiacritics(c.name.toLowerCase()).includes(qNorm);
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
      el.innerHTML = `<p class="gallery-empty">${t("noPhotos")}</p>`;
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

  function showDetail(cityId, panMap, updateHistory = true) {
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

    setCityMeta(city);
    if (updateHistory && window.location.pathname !== cityPath(cityId)) {
      window.history.pushState({ cityId }, "", cityPath(cityId));
    }

    const attractionsHtml = (city.attractions || []).length
      ? `<ul class="attractions">${city.attractions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
      : `<p>${t("noAttractions")}</p>`;

    const unescoSites = city.unesco_sites || [];
    const monuments = city.monuments_historiques || [];
    const unescoBadge = unescoSites.length
      ? ` <span class="badge unesco" title="${escapeHtml(unescoSites.map((s) => s.name).join(", "))}">${t("unescoBadge")}</span>`
      : "";
    const heritageHtml = monuments.length
      ? `<div class="detail-section">
          <h3>${t("monumentsTitle")}</h3>
          <ul class="attractions monuments">${monuments.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
        </div>`
      : "";

    const hotelsHtml = city.hotels
      .map((h) => {
        const badgeClass = h.brand === "ibis Styles" ? "styles" : "ibis";
        const searchQuery = encodeURIComponent(`${h.name} ${city.name}`);
        const links = [];
        if (h.website) links.push(`<a href="${escapeHtml(h.website)}" target="_blank" rel="noopener">${t("siteLink")}</a>`);
        if (h.phone) links.push(`<a href="tel:${escapeHtml(h.phone)}">${escapeHtml(h.phone)}</a>`);
        const bookLinks = [
          `<a class="book-link" href="https://all.accor.com/search/index.en.shtml?destination=${searchQuery}" target="_blank" rel="noopener sponsored">${t("bookIbis")}</a>`,
          `<a class="book-link" href="https://www.booking.com/searchresults.html?ss=${searchQuery}" target="_blank" rel="noopener sponsored">${t("bookBooking")}</a>`,
        ];
        return `
          <div class="hotel-card">
            <div class="name">${escapeHtml(h.name)} <span class="badge ${badgeClass}">${escapeHtml(h.brand)}</span></div>
            <div class="address">${escapeHtml(h.address || t("addressUnavailable"))}</div>
            ${links.length ? `<div class="links">${links.join("")}</div>` : ""}
            <div class="links book-links">${bookLinks.join("")}</div>
          </div>
        `;
      })
      .join("");

    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(city.name + " France")}`;

    els.detailContent.innerHTML = `
      <h2>${escapeHtml(city.name)}${unescoBadge}</h2>
      <div class="subtitle">
        ${numberFmt(city.population)} ${t("inhabitants")}${city.population_year ? " (" + city.population_year + ")" : ""}
        ${city.wikipedia_url ? ` · <a href="${city.wikipedia_url}" target="_blank" rel="noopener">${t("wikipediaLink")}</a>` : ""}
      </div>

      <div class="detail-section gallery-section">
        <div class="gallery-header">
          <h3>${t("photosTitle")}</h3>
          <a href="${googleImagesUrl}" target="_blank" rel="noopener" class="gallery-google-link">${t("googleImagesLink")}</a>
        </div>
        <div class="gallery" id="gallery"><p class="gallery-loading">${t("loadingPhotos")}</p></div>
        <p class="gallery-credit">${t("galleryCredit").replace("Wikimedia Commons", '<a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>')}</p>
      </div>

      <div class="detail-section">
        <h3>${t("historyTitle")}</h3>
        <p>${escapeHtml(city.history_summary) || t("noExtract")}</p>
      </div>

      ${heritageHtml}

      <div class="detail-section">
        <h3>${t("attractionsTitle")}</h3>
        ${attractionsHtml}
      </div>

      <div class="detail-section">
        <h3>${t("hotelsTitle", { n: city.hotel_count })}</h3>
        ${hotelsHtml}
      </div>
    `;
    els.detail.hidden = false;
    els.detailBackdrop.hidden = false;
    loadCityGallery(city);
  }

  els.detailClose.addEventListener("click", () => closeDetail());

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

  applyStaticTranslations();
  document.querySelectorAll("#lang-switch button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang));
  });

  // Path assoluto (BASE_PATH), non relativo: su un URL /citta/{id} (dopo il
  // redirect di 404.html + history.replaceState) un fetch relativo si
  // risolverebbe contro quella directory virtuale invece che contro la
  // root del sito, restituendo il 404.html al posto del JSON.
  fetch(`${BASE_PATH}/data.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      state.cities = data.cities || [];
      state.lastData = data;
      renderStats();
      populateRegions(state.cities);
      populateDepartments(state.cities);
      buildMarkers();
      applyFilters();

      // Se l'URL di arrivo e' gia' /citta/{id} (link diretto, condiviso, o
      // arrivo da 404.html), apri subito quella scheda invece della vista
      // di default. Niente pan della mappa qui: su mobile il flyTo prima
      // che il layout sia stabile puo' correre contro dimensioni non
      // ancora corrette (vedi il fix in setView).
      const initialCityId = parseCityIdFromLocation();
      if (initialCityId && state.cities.some((c) => c.id === initialCityId)) {
        showDetail(initialCityId, false, false);
      } else if (!localStorage.getItem(WELCOME_STORAGE_KEY)) {
        openWelcome();
      }
    })
    .catch((err) => {
      els.stats.textContent = t("loadError");
      console.error(err);
    });

  // Tasto indietro/avanti del browser: riapre o chiude la scheda citta'
  // senza spingere una nuova voce nella history (altrimenti si rompe la
  // navigazione avanti/indietro stessa).
  window.addEventListener("popstate", () => {
    const cityId = parseCityIdFromLocation();
    if (cityId && state.cities.some((c) => c.id === cityId)) {
      showDetail(cityId, false, false);
    } else if (state.activeId != null) {
      closeDetail(false);
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // Stesso motivo di BASE_PATH sopra, piu' uno scope esplicito: senza,
      // se il primo accesso mai fatto e' un link diretto /citta/{id}, il SW
      // si registrerebbe con scope "/citta/" (la directory dello script)
      // invece che sulla root del sito, e non controllerebbe mai le pagine
      // reali dell'app.
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
        .catch((err) => console.error("SW registration failed", err));
    });
  }
})();
