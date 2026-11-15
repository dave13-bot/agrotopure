#!/usr/bin/env python3
"""AGROTOPURE · Nodo de sensores para Raspberry Pi.

Lee humedad (25 cm y superficial) y pH con un ADS1115 (I2C), temperatura radicular con
DS18B20 (1-Wire) y opcionalmente aire con un DHT22. Envía cada INTERVAL segundos a
/api/ingest. Si no hay red guarda las lecturas en una cola local y las reenvía después.

Configuración: /etc/agrotopure.env (AGROTOPURE_URL, AGROTOPURE_DEVICE_ID, AGROTOPURE_DEVICE_KEY, AGROTOPURE_INTERVAL).
"""
import glob
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = os.environ["AGROTOPURE_URL"]
DEVICE_ID = os.environ["AGROTOPURE_DEVICE_ID"]
DEVICE_KEY = os.environ["AGROTOPURE_DEVICE_KEY"]
INTERVAL = int(os.environ.get("AGROTOPURE_INTERVAL", "900"))
QUEUE = Path(os.environ.get("AGROTOPURE_QUEUE", "/var/lib/agrotopure/queue.json"))

# Calibración (ver README)
MOIST_V_DRY = float(os.environ.get("MOIST_V_DRY", "2.70"))   # voltaje de la sonda al aire
MOIST_V_WET = float(os.environ.get("MOIST_V_WET", "1.10"))   # voltaje en suelo saturado
SATURATION_VWC = float(os.environ.get("SOIL_SATURATION_VWC", "46"))
PH7_V = float(os.environ.get("PH7_VOLTAGE", "1.50"))
PH4_V = float(os.environ.get("PH4_VOLTAGE", "2.03"))

try:
    import board
    import busio
    import adafruit_ads1x15.ads1115 as ADS
    from adafruit_ads1x15.analog_in import AnalogIn
    _ads = ADS.ADS1115(busio.I2C(board.SCL, board.SDA))
    CH_M25, CH_MSURF, CH_PH = AnalogIn(_ads, ADS.P0), AnalogIn(_ads, ADS.P1), AnalogIn(_ads, ADS.P2)
except Exception as exc:  # sin ADS1115 conectado
    print(f"[AVISO] ADS1115 no disponible: {exc}")
    CH_M25 = CH_MSURF = CH_PH = None


def avg_voltage(ch, n=20):
    vals = []
    for _ in range(n):
        vals.append(ch.voltage)
        time.sleep(0.02)
    return sum(vals) / len(vals)


def moisture(ch):
    if ch is None:
        return None
    v = avg_voltage(ch)
    frac = (MOIST_V_DRY - v) / (MOIST_V_DRY - MOIST_V_WET)
    return round(max(0.0, min(1.0, frac)) * SATURATION_VWC, 1)


def ph():
    if CH_PH is None:
        return None
    v = avg_voltage(CH_PH)
    value = 7 + (v - PH7_V) * (3 / (PH7_V - PH4_V))
    return round(value, 2) if 0 <= value <= 14 else None


def root_temp():
    for path in glob.glob("/sys/bus/w1/devices/28-*/w1_slave"):
        lines = Path(path).read_text().splitlines()
        if lines and lines[0].endswith("YES") and "t=" in lines[1]:
            return round(int(lines[1].split("t=")[1]) / 1000, 1)
    return None


def air():
    try:
        import adafruit_dht
        dht = adafruit_dht.DHT22(board.D17)
        t, h = dht.temperature, dht.humidity
        dht.exit()
        return t, h
    except Exception:
        return None, None


def read_all():
    t_air, h_air = air()
    r = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "moisture25": moisture(CH_M25),
        "moistureSurface": moisture(CH_MSURF),
        "rootTempC": root_temp(),
        "ph": ph(),
        "airTempC": t_air,
        "airRh": h_air,
    }
    return {k: v for k, v in r.items() if v is not None}


def load_queue():
    try:
        return json.loads(QUEUE.read_text())
    except Exception:
        return []


def save_queue(items):
    QUEUE.parent.mkdir(parents=True, exist_ok=True)
    QUEUE.write_text(json.dumps(items[-500:]))


def send(items):
    for i in range(0, len(items), 100):
        body = json.dumps({"readings": items[i:i + 100]}).encode()
        req = urllib.request.Request(URL, data=body, method="POST", headers={
            "Content-Type": "application/json", "x-device-id": DEVICE_ID, "x-device-key": DEVICE_KEY})
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"POST {resp.status}: {resp.read().decode()[:200]}")


def main():
    while True:
        reading = read_all()
        queue = load_queue() + ([reading] if len(reading) > 1 else [])
        print(f"Lectura: {reading} · en cola: {len(queue)}")
        try:
            if queue:
                send(queue)
            save_queue([])
        except urllib.error.HTTPError as e:
            print(f"Servidor respondió {e.code}: {e.read().decode()[:200]}")
            if e.code in (400, 401):  # lectura inválida o llave incorrecta: no reintentar indefinidamente
                save_queue([])
            else:
                save_queue(queue)
        except Exception as e:
            print(f"Sin conexión ({e}); se reintentará.")
            save_queue(queue)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
