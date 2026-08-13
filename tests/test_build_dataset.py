from build_dataset import slugify


def test_slugify_basic():
    assert slugify("Paris") == "paris"


def test_slugify_strips_accents():
    assert slugify("Châtelaillon-Plage") == "chatelaillon-plage"


def test_slugify_replaces_spaces_and_punctuation():
    assert slugify("Saint-Denis (La Reunion)") == "saint-denis-la-reunion"


def test_slugify_empty_falls_back():
    assert slugify("") == "citta"
    assert slugify(None) == "citta"
