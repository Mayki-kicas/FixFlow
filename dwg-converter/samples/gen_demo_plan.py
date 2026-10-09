"""Génère un plan d'étage de démonstration (DXF) : enceinte d'un centre de stockage
FixFlow (accueil, bureaux, local technique, allée centrale, boxes). Sert à tester la
visionneuse et le convertisseur DWG. Converti ensuite en DWG via LibreDWG (dxf2dwg).

Volontairement SANS équipements dessinés : les équipements se posent dans l'app
(mode Éditer), comme en usage réel.
"""

import ezdxf

doc = ezdxf.new("R2010", setup=True)
msp = doc.modelspace()

# Calques
doc.layers.add("MURS", color=7)       # contour
doc.layers.add("CLOISONS", color=8)   # gris
doc.layers.add("PORTES", color=3)     # vert
doc.layers.add("TEXTE", color=5)      # bleu


def rect(x1, y1, x2, y2, layer):
    pts = [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)]
    msp.add_lwpolyline(pts, dxfattribs={"layer": layer})


def label(x, y, text, height=0.9, layer="TEXTE"):
    # Position dans `insert` (alignement gauche/baseline par défaut) : elle est portée
    # par l'entité et SURVIT au round-trip DWG. À l'inverse, un alignement MIDDLE/CENTER
    # range la position dans `align_point`, que l'écriture DWG de LibreDWG perd → tout le
    # texte retomberait à l'origine.
    msp.add_text(text, dxfattribs={"layer": layer, "height": height, "insert": (x, y)})


# --- Enceinte du bâtiment (40m x 24m) ---------------------------------------
rect(0, 0, 40, 24, "MURS")

# --- Zone bureaux / accueil (bande gauche) ----------------------------------
rect(0, 0, 10, 24, "CLOISONS")
rect(0, 16, 10, 24, "CLOISONS")   # Accueil
rect(0, 8, 10, 16, "CLOISONS")    # Bureau
rect(0, 0, 10, 8, "CLOISONS")     # Local technique
label(1.5, 20, "ACCUEIL")
label(1.5, 12, "BUREAU")
label(1, 4, "LOCAL TECH", height=0.8)

# --- Allée centrale + boxes de stockage (droite) ----------------------------
rect(10, 10, 40, 14, "CLOISONS")
label(20, 11.7, "ALLEE CENTRALE", height=1.0)

# Rangées de boxes en haut
for i in range(6):
    x = 10 + i * 5
    rect(x, 14, x + 5, 24, "CLOISONS")
    label(x + 1.6, 18.6, f"B{i + 1:02d}", height=0.9)

# Rangées de boxes en bas
for i in range(6):
    x = 10 + i * 5
    rect(x, 0, x + 5, 10, "CLOISONS")
    label(x + 1.6, 4.6, f"B{i + 7:02d}", height=0.9)

# --- Portes (ouvertures symbolisées par un arc) -----------------------------
msp.add_arc((10, 20), radius=1.5, start_angle=180, end_angle=270, dxfattribs={"layer": "PORTES"})
msp.add_arc((10, 12), radius=1.2, start_angle=270, end_angle=360, dxfattribs={"layer": "PORTES"})

# --- Titre (au-dessus du bâtiment, sans chevauchement) ----------------------
label(1, 25.2, "FIXFLOW - PLAN RDC (DEMO)", height=1.4)

doc.saveas("/work/demo-floor.dxf")
print("DXF ecrit: /work/demo-floor.dxf")
