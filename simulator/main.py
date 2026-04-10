from __future__ import annotations

import os
import random
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from publisher import RabbitPublisher
from vehicles import build_fleet

EVENT_TYPES = [
    "DROWSINESS",
    "SPEEDING",
    "HARSH_BRAKING",
    "COLLISION_WARNING",
]
SEVERITIES = ["LOW", "MEDIUM", "CRITICAL"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> None:
    load_dotenv()

    rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
    gps_min_interval = float(os.getenv("SIMULATOR_GPS_MIN_INTERVAL", "2"))
    gps_max_interval = float(os.getenv("SIMULATOR_GPS_MAX_INTERVAL", "5"))
    events_min_per_minute = int(os.getenv("SIMULATOR_EVENTS_PER_MINUTE_MIN", "1"))
    events_max_per_minute = int(os.getenv("SIMULATOR_EVENTS_PER_MINUTE_MAX", "2"))

    fleet = build_fleet()
    publisher = RabbitPublisher(rabbitmq_url)
    publisher.connect()

    print(f"Simulator started with {len(fleet)} vehicles")

    now = time.time()
    next_gps_emit = {
        vehicle.device_id: now + random.uniform(gps_min_interval, gps_max_interval)
        for vehicle in fleet
    }
    next_event_emit = now + random.uniform(
        60 / events_max_per_minute,
        60 / max(events_min_per_minute, 1),
    )

    try:
        while True:
            current = time.time()

            for vehicle in fleet:
                if current < next_gps_emit[vehicle.device_id]:
                    continue

                vehicle.move()

                gps_payload = {
                    "device_id": vehicle.device_id,
                    "lat": round(vehicle.lat, 6),
                    "lng": round(vehicle.lng, 6),
                    "speed": random.randint(30, 90),
                    "heading": random.randint(0, 359),
                    "timestamp": utc_now_iso(),
                }
                publisher.publish("gps.update", gps_payload)

                next_gps_emit[vehicle.device_id] = current + random.uniform(
                    gps_min_interval,
                    gps_max_interval,
                )

            if current >= next_event_emit:
                vehicle = random.choice(fleet)
                event_payload = {
                    "device_id": vehicle.device_id,
                    "type": random.choice(EVENT_TYPES),
                    "severity": random.choices(SEVERITIES, weights=[0.55, 0.3, 0.15], k=1)[0],
                    "lat": round(vehicle.lat, 6),
                    "lng": round(vehicle.lng, 6),
                    "timestamp": utc_now_iso(),
                }
                publisher.publish("fleet.event", event_payload)

                next_event_emit = current + random.uniform(
                    60 / events_max_per_minute,
                    60 / max(events_min_per_minute, 1),
                )

            time.sleep(0.2)
    except KeyboardInterrupt:
        print("Simulator interrupted")
    finally:
        publisher.close()


if __name__ == "__main__":
    main()
