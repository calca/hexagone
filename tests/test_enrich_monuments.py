from unittest.mock import MagicMock, patch

from enrich_monuments import run_sparql


def _mock_response(bindings):
    resp = MagicMock()
    resp.json.return_value = {"results": {"bindings": bindings}}
    return resp


def _binding(commune_qid, label, sitelinks="0"):
    return {
        "commune": {"value": f"http://www.wikidata.org/entity/{commune_qid}"},
        "monument": {"value": "http://www.wikidata.org/entity/Q999"},
        "monumentLabel": {"value": label},
        "sl": {"value": sitelinks},
    }


def test_run_sparql_parses_bindings():
    bindings = [_binding("Q90", "Cathedrale Notre-Dame", "42")]
    with patch("enrich_monuments.requests.get", return_value=_mock_response(bindings)):
        result = run_sparql(["Q90"])
    assert result == bindings


def test_main_groups_monuments_by_commune_and_caps_at_max(tmp_path, monkeypatch):
    import json

    import enrich_monuments

    cities = [
        {"id": "paris", "name": "Paris", "wikidata": "Q90"},
        {"id": "lyon", "name": "Lyon", "wikidata": "Q456"},
        {"id": "sans-qid", "name": "Sconosciuta"},
    ]
    cities_file = tmp_path / "cities.json"
    cities_file.write_text(json.dumps(cities), encoding="utf-8")
    out_file = tmp_path / "out.json"

    bindings = [_binding("Q90", f"Monumento {i}", str(10 - i)) for i in range(10)]
    bindings += [_binding("Q456", "Monument Lyonnais", "5")]

    monkeypatch.setattr(enrich_monuments, "run_sparql", lambda qids: bindings)
    monkeypatch.setattr(
        "sys.argv",
        ["enrich_monuments.py", "--cities", str(cities_file), "--out", str(out_file)],
    )
    enrich_monuments.main()

    result = json.loads(out_file.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in result}
    assert len(by_id["paris"]["monuments_historiques"]) == enrich_monuments.MAX_MONUMENTS
    assert by_id["paris"]["monuments_historiques"][0] == "Monumento 0"  # piu' sitelink prima
    assert by_id["lyon"]["monuments_historiques"] == ["Monument Lyonnais"]
    assert "monuments_historiques" not in by_id["sans-qid"]


def test_main_skips_bindings_without_label(tmp_path, monkeypatch):
    import json

    import enrich_monuments

    cities = [{"id": "paris", "name": "Paris", "wikidata": "Q90"}]
    cities_file = tmp_path / "cities.json"
    cities_file.write_text(json.dumps(cities), encoding="utf-8")
    out_file = tmp_path / "out.json"

    binding_no_label = {
        "commune": {"value": "http://www.wikidata.org/entity/Q90"},
        "monument": {"value": "http://www.wikidata.org/entity/Q999"},
        "sl": {"value": "0"},
    }
    monkeypatch.setattr(enrich_monuments, "run_sparql", lambda qids: [binding_no_label])
    monkeypatch.setattr(
        "sys.argv",
        ["enrich_monuments.py", "--cities", str(cities_file), "--out", str(out_file)],
    )
    enrich_monuments.main()

    result = json.loads(out_file.read_text(encoding="utf-8"))
    assert "monuments_historiques" not in result[0]
