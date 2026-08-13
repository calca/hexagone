from build_dataset import build_sitemap, slugify


def test_slugify_basic():
    assert slugify("Paris") == "paris"


def test_slugify_strips_accents():
    assert slugify("Châtelaillon-Plage") == "chatelaillon-plage"


def test_slugify_replaces_spaces_and_punctuation():
    assert slugify("Saint-Denis (La Reunion)") == "saint-denis-la-reunion"


def test_slugify_empty_falls_back():
    assert slugify("") == "citta"
    assert slugify(None) == "citta"


def test_build_sitemap_includes_home_and_about():
    xml = build_sitemap([])
    assert "<loc>https://calca.github.io/hexagone/</loc>" in xml
    assert "<loc>https://calca.github.io/hexagone/about.html</loc>" in xml


def test_build_sitemap_includes_one_url_per_city():
    xml = build_sitemap(["paris", "lyon"])
    assert "<loc>https://calca.github.io/hexagone/citta/paris</loc>" in xml
    assert "<loc>https://calca.github.io/hexagone/citta/lyon</loc>" in xml
    assert xml.count("<url>") == 4  # home + about + 2 citta'


def test_build_sitemap_is_valid_xml():
    import xml.etree.ElementTree as ET

    ET.fromstring(build_sitemap(["saint-etienne"]))
