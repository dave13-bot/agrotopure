# AGRO-TOPURE · Raspberry Pi

Servicio que lee los sensores de suelo de forma automática y los envía a AGRO-TOPURE, con cola local si no hay internet.

## Conexiones
| Sensor | Variable | Conexión |
|---|---|---|
| Sonda capacitiva a **25 cm** | `moisture25` | ADS1115 canal A0 |
| Sonda capacitiva superficial | `moistureSurface` | ADS1115 canal A1 |
| Módulo de pH analógico | `ph` | ADS1115 canal A2 |
| DS18B20 (temperatura radicular) | `rootTempC` | GPIO 4 (1-Wire) + 4.7 kΩ a 3.3 V |
| DHT22 (opcional) | `airTempC`, `airRh` | GPIO 17 |

ADS1115 por I2C (SDA GPIO 2, SCL GPIO 3). La Raspberry Pi no tiene entradas analógicas propias.

## Instalación
```bash
sudo raspi-config nonint do_i2c 0 && sudo raspi-config nonint do_onewire 0
sudo apt install -y python3-pip
sudo pip3 install --break-system-packages adafruit-circuitpython-ads1x15 adafruit-circuitpython-dht
sudo mkdir -p /opt/agrotopure && sudo cp agrotopure_rpi.py /opt/agrotopure/
sudo nano /etc/agrotopure.env      # pega la configuración que te da AGRO-TOPURE (Sensores → Dispositivo)
sudo cp agrotopure.service /etc/systemd/system/
sudo systemctl enable --now agrotopure
journalctl -u agrotopure -f        # verás "POST 200" en cada envío
```

## Calibración (agrega al mismo /etc/agrotopure.env)
```
MOIST_V_DRY=2.70          # voltaje con la sonda al aire
MOIST_V_WET=1.10          # voltaje en suelo saturado de tu parcela
SOIL_SATURATION_VWC=46    # % volumétrico a saturación (arenoso 40, franco 46, arcilloso 50)
PH7_VOLTAGE=1.50          # voltaje en buffer pH 7
PH4_VOLTAGE=2.03          # voltaje en buffer pH 4
```
