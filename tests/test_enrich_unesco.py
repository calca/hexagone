import json

import enrich_unesco


def test_load_unesco_sites_matches_by_normalized_commune_name(tmp_path, monkeypatch):
    data = [
        {"name": "Rive della Senna a Parigi", "year": 1991, "communes_norm": ["Paris"]},
        {"name": "Sito con due comuni", "year": 2000, "communes_norm": ["Comune Uno", "Comune Due"]},
    ]
    unesco_file = tmp_path / "unesco_sites_fr.json"
    unesco_file.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(enrich_unesco, "UNESCO_FILE", unesco_file)

    by_commune = enrich_unesco.load_unesco_sites()

    assert by_commune["paris"] == [{"name": "Rive della Senna a Parigi", "year": 1991}]
    assert by_commune["comune uno"] == [{"name": "Sito con due comuni", "year": 2000}]
    assert by_commune["comune due"] == [{"name": "Sito con due comuni", "year": 2000}]


def test_load_unesco_sites_missing_file_returns_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(enrich_unesco, "UNESCO_FILE", tmp_path / "does-not-exist.json")
    assert enrich_unesco.load_unesco_sites() == {}


def test_load_unesco_sites_accumulates_multiple_sites_for_same_commune(tmp_path, monkeypatch):
    data = [
        {"name": "Sito A", "year": 1980, "communes_norm": ["Le Havre"]},
        {"name": "Sito B", "year": 2005, "communes_norm": ["Le Havre"]},
    ]
    unesco_file = tmp_path / "unesco_sites_fr.json"
    unesco_file.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(enrich_unesco, "UNESCO_FILE", unesco_file)

    by_commune = enrich_unesco.load_unesco_sites()

    assert by_commune["le havre"] == [
        {"name": "Sito A", "year": 1980},
        {"name": "Sito B", "year": 2005},
    ]
