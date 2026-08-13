(() => {
  "use strict";

  // Stessa chiave di localStorage di app.js: la lingua scelta in una pagina
  // resta valida anche nell'altra. I contenuti di questa pagina (info/note
  // legali) sono testo originale del progetto, non estratti da Wikipedia,
  // quindi qui - a differenza dei dati delle citta' - vengono tradotti.
  const LANG_STORAGE_KEY = "hexagone-lang";
  const DEFAULT_LANG = "it";

  const TRANSLATIONS = {
    it: {
      pageTitle: "Info & note legali — hexagone",
      tagline: "ibis & ibis Styles — Francia",
      langAria: "Lingua",
      backToMap: "← Torna alla mappa",
      backToMapShort: "Torna alla mappa",
      pageH1: "Info & note legali",
      lead: `hexagone e' un progetto indipendente e non ufficiale che
        raccoglie e visualizza su una mappa dati pubblici sugli hotel dei marchi
        <strong>ibis</strong> e <strong>ibis Styles</strong> in Francia.`,
      h2NoAffiliation: "Nessuna affiliazione",
      pNoAffiliation: `hexagone <strong>non e' in alcun modo affiliato, sponsorizzato,
        autorizzato o collegato</strong> ad Accor S.A. o a nessuna delle sue
        controllate o affiliate, ai marchi <strong>ibis</strong> e
        <strong>ibis Styles</strong>, ne' a <strong>Booking.com B.V.</strong> o ad
        altre piattaforme di prenotazione citate nel sito. Tutti i nomi, i marchi,
        i loghi e i contenuti di proprieta' di terzi sono utilizzati esclusivamente
        a scopo descrittivo/identificativo (uso nominativo), rimangono di proprieta'
        dei rispettivi titolari e non implicano alcuna approvazione, sponsorizzazione
        o partnership da parte loro.`,
      h2BookingLinks: "Link di prenotazione",
      pBookingLinks: `I pulsanti "Prenota su ibis" e "Prenota su Booking" nella scheda di ogni
        hotel sono semplici link esterni che rimandano ai motori di ricerca dei
        rispettivi siti ufficiali. hexagone <strong>non gestisce prenotazioni, non
        tratta pagamenti e non ha alcun rapporto commerciale</strong> con Accor o
        Booking.com: una volta seguito il link, l'utente lascia hexagone ed e'
        soggetto ai termini, alla privacy policy e alla disponibilita'/tariffe del
        sito di destinazione.`,
      h2DataSources: "Fonti e affidabilita' dei dati",
      pDataSourcesIntro: "I dati mostrati provengono da fonti pubbliche di terze parti e vengono aggiornati periodicamente tramite una pipeline automatica:",
      liHotels: `<strong>Hotel</strong>: OpenStreetMap / Overpass API — licenza
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a>`,
      liCity: `<strong>Comune di appartenenza</strong>: geo.api.gouv.fr — licenza
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Open Licence 2.0</a>`,
      liAddress: `<strong>Indirizzo (quando OpenStreetMap non lo ha)</strong>: reverse geocoding via
        api-adresse.data.gouv.fr — licenza
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Open Licence 2.0</a>`,
      liPopulation: `<strong>Popolazione</strong>: Wikidata (SPARQL) — licenza
        <a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener">CC0</a>`,
      liHistory: `<strong>Storia e attrazioni</strong>: Wikipedia e Wikivoyage in francese — licenza
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA</a>`,
      liUnesco: `<strong>Siti UNESCO</strong>: lista curata manualmente, non esaustiva`,
      pDataDisclaimer: `I dati sono forniti "cosi' come sono", senza alcuna garanzia di
        completezza, accuratezza o aggiornamento: indirizzi, numero di hotel,
        popolazione e altre informazioni possono contenere imprecisioni o essere
        nel frattempo cambiati. Verifica sempre le informazioni sul sito ufficiale
        dell'hotel prima di un acquisto o di uno spostamento.`,
      h2Privacy: "Privacy",
      pPrivacy: `hexagone e' un sito statico che non usa cookie di profilazione, non
        include strumenti di analisi/tracciamento di terze parti e non raccoglie
        dati personali degli utenti. Se installi hexagone come app (PWA), il
        browser puo' salvare in locale sul tuo dispositivo una copia della pagina
        e dei dati per consentirne l'uso anche offline: questi dati restano solo
        sul tuo dispositivo e puoi eliminarli in qualsiasi momento dalle
        impostazioni del browser.`,
      h2CodeLicense: "Licenza del codice",
      pCodeLicense: `Il codice sorgente del sito e' pubblicato su GitHub con licenza
        <a href="https://github.com/calca/hexagone/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>.
        I dati restano invece soggetti alle licenze delle rispettive fonti elencate
        sopra.`,
      h2Contacts: "Contatti",
      pContacts: `Per segnalazioni, correzioni o richieste di rimozione, apri una
        <a href="https://github.com/calca/hexagone/issues" target="_blank" rel="noopener">issue su GitHub</a>.`,
      licenseWord: "Licenza",
      ariaUsefulLinks: "Link utili",
    },
    fr: {
      pageTitle: "Infos & mentions légales — hexagone",
      tagline: "ibis & ibis Styles — France",
      langAria: "Langue",
      backToMap: "← Retour à la carte",
      backToMapShort: "Retour à la carte",
      pageH1: "Infos & mentions légales",
      lead: `hexagone est un projet indépendant et non officiel qui recueille et
        affiche sur une carte des données publiques sur les hôtels des marques
        <strong>ibis</strong> et <strong>ibis Styles</strong> en France.`,
      h2NoAffiliation: "Aucune affiliation",
      pNoAffiliation: `hexagone <strong>n'est en aucune façon affilié, sponsorisé, autorisé
        ou lié</strong> à Accor S.A. ni à aucune de ses filiales ou affiliées, aux
        marques <strong>ibis</strong> et <strong>ibis Styles</strong>, ni à
        <strong>Booking.com B.V.</strong> ou à d'autres plateformes de réservation
        citées sur le site. Tous les noms, marques, logos et contenus appartenant
        à des tiers sont utilisés uniquement à des fins descriptives/d'identification
        (usage nominatif), restent la propriété de leurs titulaires respectifs et
        n'impliquent aucune approbation, sponsorisation ou partenariat de leur part.`,
      h2BookingLinks: "Liens de réservation",
      pBookingLinks: `Les boutons « Réserver sur ibis » et « Réserver sur Booking » présents
        sur la fiche de chaque hôtel sont de simples liens externes qui renvoient
        vers les moteurs de recherche des sites officiels respectifs. hexagone
        <strong>ne gère aucune réservation, ne traite aucun paiement et n'entretient
        aucune relation commerciale</strong> avec Accor ou Booking.com : une fois le
        lien suivi, l'utilisateur quitte hexagone et est soumis aux conditions, à la
        politique de confidentialité et à la disponibilité/aux tarifs du site de
        destination.`,
      h2DataSources: "Sources et fiabilité des données",
      pDataSourcesIntro: "Les données affichées proviennent de sources publiques tierces et sont mises à jour périodiquement via un pipeline automatique :",
      liHotels: `<strong>Hôtels</strong> : OpenStreetMap / Overpass API — licence
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a>`,
      liCity: `<strong>Commune de rattachement</strong> : geo.api.gouv.fr — licence
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Licence Ouverte 2.0</a>`,
      liAddress: `<strong>Adresse (quand OpenStreetMap ne l'a pas)</strong> : reverse geocoding via
        api-adresse.data.gouv.fr — licence
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Licence Ouverte 2.0</a>`,
      liPopulation: `<strong>Population</strong> : Wikidata (SPARQL) — licence
        <a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener">CC0</a>`,
      liHistory: `<strong>Histoire et attractions</strong> : Wikipédia et Wikivoyage en
        français — licence
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA</a>`,
      liUnesco: `<strong>Sites UNESCO</strong> : liste établie manuellement, non exhaustive`,
      pDataDisclaimer: `Les données sont fournies « en l'état », sans aucune garantie
        d'exhaustivité, d'exactitude ou de mise à jour : adresses, nombre d'hôtels,
        population et autres informations peuvent contenir des imprécisions ou avoir
        changé entre-temps. Vérifiez toujours les informations sur le site officiel
        de l'hôtel avant un achat ou un déplacement.`,
      h2Privacy: "Confidentialité",
      pPrivacy: `hexagone est un site statique qui n'utilise pas de cookies de
        profilage, n'inclut aucun outil d'analyse/suivi tiers et ne collecte aucune
        donnée personnelle des utilisateurs. Si vous installez hexagone comme
        application (PWA), le navigateur peut enregistrer localement sur votre
        appareil une copie de la page et des données pour permettre son utilisation
        hors ligne : ces données restent uniquement sur votre appareil et vous
        pouvez les supprimer à tout moment depuis les paramètres du navigateur.`,
      h2CodeLicense: "Licence du code",
      pCodeLicense: `Le code source du site est publié sur GitHub sous licence
        <a href="https://github.com/calca/hexagone/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>.
        Les données restent quant à elles soumises aux licences des sources
        respectives listées ci-dessus.`,
      h2Contacts: "Contact",
      pContacts: `Pour signaler une erreur, proposer une correction ou demander un
        retrait, ouvrez une
        <a href="https://github.com/calca/hexagone/issues" target="_blank" rel="noopener">issue sur GitHub</a>.`,
      licenseWord: "Licence",
      ariaUsefulLinks: "Liens utiles",
    },
    en: {
      pageTitle: "About & legal notes — hexagone",
      tagline: "ibis & ibis Styles — France",
      langAria: "Language",
      backToMap: "← Back to the map",
      backToMapShort: "Back to the map",
      pageH1: "About & legal notes",
      lead: `hexagone is an independent, unofficial project that collects and maps
        public data about <strong>ibis</strong> and <strong>ibis Styles</strong>
        branded hotels in France.`,
      h2NoAffiliation: "No affiliation",
      pNoAffiliation: `hexagone is <strong>not affiliated with, sponsored by,
        endorsed by, or connected to</strong> Accor S.A. or any of its subsidiaries
        or affiliates, the <strong>ibis</strong> and <strong>ibis Styles</strong>
        brands, or <strong>Booking.com B.V.</strong> or any other booking platform
        mentioned on the site. All third-party names, brands, logos, and content
        are used solely for descriptive/identification purposes (nominative use),
        remain the property of their respective owners, and do not imply any
        endorsement, sponsorship, or partnership on their part.`,
      h2BookingLinks: "Booking links",
      pBookingLinks: `The "Book on ibis" and "Book on Booking" buttons on each
        hotel's card are simple external links to the search engines of the
        respective official websites. hexagone <strong>does not handle bookings,
        process payments, or have any commercial relationship</strong> with Accor
        or Booking.com: once you follow the link, you leave hexagone and are
        subject to the terms, privacy policy, and availability/rates of the
        destination site.`,
      h2DataSources: "Data sources and reliability",
      pDataSourcesIntro: "The data shown comes from public third-party sources and is refreshed periodically through an automated pipeline:",
      liHotels: `<strong>Hotels</strong>: OpenStreetMap / Overpass API —
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a> license`,
      liCity: `<strong>Home commune</strong>: geo.api.gouv.fr —
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Open Licence 2.0</a>`,
      liAddress: `<strong>Address (when OpenStreetMap doesn't have it)</strong>: reverse geocoding via
        api-adresse.data.gouv.fr —
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" target="_blank" rel="noopener">Etalab Open Licence 2.0</a>`,
      liPopulation: `<strong>Population</strong>: Wikidata (SPARQL) —
        <a href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener">CC0</a> license`,
      liHistory: `<strong>History and attractions</strong>: French Wikipedia and
        Wikivoyage —
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA</a> license`,
      liUnesco: `<strong>UNESCO sites</strong>: manually curated list, not exhaustive`,
      pDataDisclaimer: `Data is provided "as is", with no guarantee of completeness,
        accuracy, or currency: addresses, hotel counts, population, and other
        details may contain inaccuracies or have changed since. Always check the
        official hotel website before booking or traveling.`,
      h2Privacy: "Privacy",
      pPrivacy: `hexagone is a static site that doesn't use profiling cookies,
        doesn't include third-party analytics/tracking tools, and doesn't collect
        personal data from users. If you install hexagone as an app (PWA), your
        browser may store a local copy of the page and data on your device to
        allow offline use: this data stays only on your device and you can delete
        it at any time from your browser settings.`,
      h2CodeLicense: "Code license",
      pCodeLicense: `The site's source code is published on GitHub under the
        <a href="https://github.com/calca/hexagone/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>
        license. The data remains subject to the licenses of the respective
        sources listed above.`,
      h2Contacts: "Contact",
      pContacts: `To report an issue, suggest a correction, or request removal,
        open an
        <a href="https://github.com/calca/hexagone/issues" target="_blank" rel="noopener">issue on GitHub</a>.`,
      licenseWord: "License",
      ariaUsefulLinks: "Useful links",
    },
  };

  function detectLang() {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
    return DEFAULT_LANG;
  }

  let lang = detectLang();

  function t(key) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
    return dict[key] != null ? dict[key] : TRANSLATIONS[DEFAULT_LANG][key] || key;
  }

  const MANIFEST_BY_LANG = { it: "manifest.webmanifest", fr: "manifest.fr.webmanifest", en: "manifest.en.webmanifest" };

  function applyTranslations() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("#lang-switch button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    const manifestLink = document.getElementById("manifest-link");
    if (manifestLink) manifestLink.href = MANIFEST_BY_LANG[lang] || MANIFEST_BY_LANG[DEFAULT_LANG];
  }

  function setLang(newLang) {
    if (!TRANSLATIONS[newLang] || newLang === lang) return;
    lang = newLang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    applyTranslations();
  }

  document.getElementById("lang-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });

  applyTranslations();
})();
