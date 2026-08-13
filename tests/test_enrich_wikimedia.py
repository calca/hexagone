from enrich_wikimedia import clean_wikitext


def test_strips_section_headings():
    text = "=== Prehistoire et Antiquite ===\nUn testo di prova."
    assert "===" not in clean_wikitext(text)
    assert "Un testo di prova." in clean_wikitext(text)


def test_strips_bold_markup():
    assert clean_wikitext("'''Lugdunum''' e' il nome antico.") == "Lugdunum e' il nome antico."


def test_strips_wikilinks_keeping_display_text():
    assert clean_wikitext("Vicino a [[Parigi|la capitale]].") == "Vicino a la capitale."
    assert clean_wikitext("Vicino a [[Parigi]].") == "Vicino a Parigi."


def test_strips_templates():
    assert clean_wikitext("Popolazione {{formatnum:12345}} circa.") == "Popolazione  circa."


def test_strips_refs_and_html_tags():
    text = "Un fatto storico<ref>Fonte: libro X</ref> importante.<br/>"
    assert clean_wikitext(text) == "Un fatto storico importante."


def test_collapses_multiple_blank_lines():
    text = "Primo paragrafo.\n\n\n\nSecondo paragrafo."
    assert clean_wikitext(text) == "Primo paragrafo.\n\nSecondo paragrafo."


def test_strips_trailing_whitespace_on_lines():
    text = "Riga con spazi finali.   \nAltra riga."
    assert "   \n" not in clean_wikitext(text)
