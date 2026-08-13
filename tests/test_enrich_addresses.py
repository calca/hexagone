from enrich_addresses import format_address


def test_format_address_full():
    props = {"name": "8 Boulevard du Port", "postcode": "80000", "city": "Amiens"}
    assert format_address(props) == "8 Boulevard du Port, 80000 Amiens"


def test_format_address_missing_name():
    props = {"postcode": "80000", "city": "Amiens"}
    assert format_address(props) == "80000 Amiens"


def test_format_address_empty_properties():
    assert format_address({}) == ""
