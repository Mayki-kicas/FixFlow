"""Service de conversion DWG -> SVG.

POST /convert : corps = octets DWG bruts -> renvoie du SVG (image/svg+xml).
Pipeline : dwg2dxf (LibreDWG) pour DWG->DXF, puis ezdxf (backend matplotlib) pour
DXF->SVG. Le découpage permet de remplacer dwg2dxf par ODA File Converter plus tard
sans toucher au rendu.
"""

import os
import subprocess
import tempfile

import matplotlib

matplotlib.use("Agg")  # backend sans affichage

import ezdxf
import matplotlib.pyplot as plt
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from fastapi import FastAPI, HTTPException, Request, Response

app = FastAPI(title="dwg-converter")

MAX_BYTES = int(os.environ.get("DWG_MAX_BYTES", str(50 * 1024 * 1024)))


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/convert")
async def convert(request: Request):
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="corps vide")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="fichier trop volumineux")

    with tempfile.TemporaryDirectory() as workdir:
        dwg_path = os.path.join(workdir, "in.dwg")
        dxf_path = os.path.join(workdir, "out.dxf")
        svg_path = os.path.join(workdir, "out.svg")

        with open(dwg_path, "wb") as fh:
            fh.write(data)

        # DWG -> DXF
        proc = subprocess.run(
            ["dwg2dxf", "-o", dxf_path, dwg_path],
            capture_output=True,
        )
        if proc.returncode != 0 or not os.path.exists(dxf_path):
            detail = proc.stderr.decode("utf-8", "replace")[:300] or "dwg2dxf a échoué"
            raise HTTPException(status_code=422, detail=detail)

        # DXF -> SVG (rendu ezdxf via matplotlib)
        try:
            doc = ezdxf.readfile(dxf_path)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"lecture DXF: {exc}")

        msp = doc.modelspace()
        fig = plt.figure()
        ax = fig.add_axes([0, 0, 1, 1])
        ax.axis("off")
        try:
            Frontend(RenderContext(doc), MatplotlibBackend(ax)).draw_layout(msp, finalize=True)
            fig.savefig(svg_path, format="svg", bbox_inches="tight", pad_inches=0)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"rendu SVG: {exc}")
        finally:
            plt.close(fig)

        with open(svg_path, "rb") as fh:
            svg = fh.read()

    return Response(content=svg, media_type="image/svg+xml")
