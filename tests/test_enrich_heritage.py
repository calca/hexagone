from unittest.mock import MagicMock, patch

from enrich_heritage import fetch_monuments


def _mock_response(json_data, status_ok=True):
    resp = MagicMock()
    resp.json.return_value = json_data
    if not status_ok:
        resp.raise_for_status.side_effect = Exception("HTTP error")
    return resp


def test_fetch_monuments_parses_v2_1_flat_results():
    # L'API Explore v2.1 ritorna i campi direttamente in ogni elemento di
    # "results" (non annidati sotto "fields" come la vecchia v1 "records").
    payload = {
        "total_count": 2,
        "results": [
            {"denomination": "Cathedrale Notre-Dame", "commune": "Paris"},
            {"appellation_courante": "Tour Eiffel", "commune": "Paris"},
        ],
    }
    with patch("enrich_heritage.requests.get", return_value=_mock_response(payload)):
        names = fetch_monuments("75056", "Paris")
    assert names == ["Cathedrale Notre-Dame", "Tour Eiffel"]


def test_fetch_monuments_no_results_returns_empty_list_not_none():
    payload = {"total_count": 0, "results": []}
    with patch("enrich_heritage.requests.get", return_value=_mock_response(payload)):
        names = fetch_monuments("12345", "Un Comune Qualsiasi")
    assert names == []


def test_fetch_monuments_no_commune_name_returns_none():
    assert fetch_monuments("12345", None) is None


def test_fetch_monuments_dedupes_names():
    payload = {
        "total_count": 2,
        "results": [
            {"denomination": "Chateau"},
            {"denomination": "Chateau"},
        ],
    }
    with patch("enrich_heritage.requests.get", return_value=_mock_response(payload)):
        names = fetch_monuments("12345", "Comune")
    assert names == ["Chateau"]
