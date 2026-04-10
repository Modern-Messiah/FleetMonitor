from __future__ import annotations

import random
from dataclasses import dataclass
from typing import List

CENTER_LAT = 43.238
CENTER_LNG = 76.945
MAX_DRIFT = 0.02
STEP = 0.001


@dataclass
class SimVehicle:
    device_id: str
    driver_name: str
    license_plate: str
    lat: float
    lng: float

    def move(self) -> None:
        lat_shift = random.uniform(-STEP, STEP)
        lng_shift = random.uniform(-STEP, STEP)

        self.lat = _clamp(self.lat + lat_shift, CENTER_LAT - MAX_DRIFT, CENTER_LAT + MAX_DRIFT)
        self.lng = _clamp(self.lng + lng_shift, CENTER_LNG - MAX_DRIFT, CENTER_LNG + MAX_DRIFT)


def build_fleet() -> List[SimVehicle]:
    seeds = [
        ("ALM-001", "Aibek Nurtayev", "KZ 100 AAA 02"),
        ("ALM-002", "Diana Sarsenova", "KZ 101 AAB 02"),
        ("ALM-003", "Ruslan Omarov", "KZ 102 AAC 02"),
        ("ALM-004", "Nuraiym Bekova", "KZ 103 AAD 02"),
        ("ALM-005", "Yerlan Mukashev", "KZ 104 AAE 02"),
        ("ALM-006", "Alina Zheksen", "KZ 105 AAF 02"),
        ("ALM-007", "Nursultan Yesdaulet", "KZ 106 AAG 02"),
        ("ALM-008", "Samal Abilova", "KZ 107 AAH 02"),
        ("ALM-009", "Marat Seithanov", "KZ 108 AAI 02"),
        ("ALM-010", "Aruzhan Imanova", "KZ 109 AAJ 02"),
        ("ALM-011", "Talgat Tursynbek", "KZ 110 AAK 02"),
        ("ALM-012", "Saniya Duysen", "KZ 111 AAL 02"),
        ("ALM-013", "Kanat Baikenov", "KZ 112 AAM 02"),
        ("ALM-014", "Zhanel Kenes", "KZ 113 AAN 02"),
        ("ALM-015", "Dastan Abdrakhman", "KZ 114 AAO 02"),
        ("ALM-016", "Madina Utebayeva", "KZ 115 AAP 02"),
        ("ALM-017", "Ilyas Yeleusizov", "KZ 116 AAQ 02"),
        ("ALM-018", "Aisana Kairat", "KZ 117 AAR 02"),
        ("ALM-019", "Bauyrzhan Sapar", "KZ 118 AAS 02"),
        ("ALM-020", "Tomiris Akhmet", "KZ 119 AAT 02"),
    ]

    fleet: List[SimVehicle] = []
    for device_id, driver_name, license_plate in seeds:
        fleet.append(
            SimVehicle(
                device_id=device_id,
                driver_name=driver_name,
                license_plate=license_plate,
                lat=CENTER_LAT + random.uniform(-0.005, 0.005),
                lng=CENTER_LNG + random.uniform(-0.005, 0.005),
            )
        )

    return fleet


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))
