from fetch_hotels import build_address, classify_brand, normalize


def test_build_address_full():
    tags = {
        "addr:housenumber": "12",
        "addr:street": "Rue de Rivoli",
        "addr:postcode": "75004",
        "addr:city": "Paris",
    }
    assert build_address(tags) == "12 Rue de Rivoli, 75004 Paris"


def test_build_address_missing_housenumber():
    tags = {"addr:street": "Rue de Rivoli", "addr:postcode": "75004", "addr:city": "Paris"}
    assert build_address(tags) == "Rue de Rivoli, 75004 Paris"


def test_build_address_empty_when_no_tags():
    assert build_address({}) == ""


def test_normalize_strips_accents_and_whitespace():
    assert normalize(" Châtelaillon-Plage ") == "Chatelaillon-Plage"
    assert normalize(None) is None
    assert normalize("") is None


def test_classify_brand_detects_styles():
    assert classify_brand({"brand": "ibis Styles"}) == "ibis Styles"
    assert classify_brand({"name": "ibis Styles Paris Gare de Lyon"}) == "ibis Styles"
    assert classify_brand({"brand": "ibis"}) == "ibis"
    assert classify_brand({"name": "ibis Budget Paris"}) == "ibis"
