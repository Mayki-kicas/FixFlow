# dwg-converter

Service de conversion **DWG → SVG** pour la rubrique *Plans* de l'application.

## Pipeline

1. `dwg2dxf` (LibreDWG, compilé depuis les sources dans l'image) : **DWG → DXF**.
2. `ezdxf` + backend matplotlib : **DXF → SVG**.

Ce découpage permet de remplacer `dwg2dxf` par **ODA File Converter** (fidélité
supérieure sur certains plans) sans toucher au rendu : il suffit de produire le DXF
autrement dans `app.py`.

## API

- `GET /health` → `{ "ok": true }`
- `POST /convert` → corps = octets DWG bruts ; réponse = `image/svg+xml`.
  Erreurs : `400` (vide), `413` (trop gros), `422` (conversion échouée).

## Usage

Lancé par `docker-compose` (service `dwg-converter`). L'application le joint via
`DWG_CONVERTER_URL` (ex. `http://dwg-converter:8000`).

```bash
docker compose build dwg-converter
docker compose up -d dwg-converter
curl -s http://localhost:8000/health
# Conversion d'un plan réel :
curl -s --data-binary @plan.dwg -H 'Content-Type: application/octet-stream' \
  http://localhost:8000/convert -o plan.svg
```

## Notes

- La **compilation de LibreDWG** rallonge le premier build (plusieurs minutes).
- La fidélité du rendu dépend de la complexité du DWG ; calibrer sur de vrais plans.
- Si la conversion échoue pour un plan donné, exporter le plan en **SVG/PDF**
  depuis AutoCAD et l'uploader directement (l'app accepte ces formats).
