import pytest

from resolve_cities import (
    dept_candidates_from_postcode,
    haversine_km,
    pick_best_match,
)


def test_dept_candidates_metropolitan():
    assert dept_candidates_from_postcode("75011") == ["75"]


def test_dept_candidates_corsica():
    assert dept_candidates_from_postcode("20000") == ["2A", "2B"]


def test_dept_candidates_overseas():
    assert dept_candidates_from_postcode("97400") == ["974"]


def test_dept_candidates_missing_postcode():
    assert dept_candidates_from_postcode(None) == []
    assert dept_candidates_from_postcode("7") == []


def test_haversine_zero_distance():
    assert haversine_km(48.85, 2.35, 48.85, 2.35) == pytest.approx(0.0)


def test_haversine_paris_marseille_order_of_magnitude():
    # Parigi -> Marsiglia: circa 660 km in linea d'aria.
    km = haversine_km(48.8566, 2.3522, 43.2965, 5.3698)
    assert 600 < km < 700


def test_pick_best_match_prefers_matching_department():
    candidates = [
        {"name": "Saint-Denis", "insee": "93066", "lat": 48.93, "lon": 2.36},
        {"name": "Saint-Denis", "insee": "97411", "lat": -20.88, "lon": 55.45},
    ]
    match = pick_best_match(candidates, dept_prefixes=["93"], hotel_lat=48.9, hotel_lon=2.35)
    assert match["insee"] == "93066"


def test_pick_best_match_falls_back_to_nearest_when_no_department_hint():
    candidates = [
        {"name": "Neuville", "insee": "01", "lat": 45.75, "lon": 4.85},
        {"name": "Neuville", "insee": "02", "lat": 50.0, "lon": 3.0},
    ]
    match = pick_best_match(candidates, dept_prefixes=[], hotel_lat=45.76, hotel_lon=4.84)
    assert match["insee"] == "01"


def test_pick_best_match_no_candidates_returns_none():
    assert pick_best_match([], dept_prefixes=["75"], hotel_lat=48.85, hotel_lon=2.35) is None
