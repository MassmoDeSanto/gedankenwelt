"""
Erzeugt die App-Symbole und iPhone-Startbilder als PNG in public/.

Nur nötig, wenn sich das Symbol ändern soll. Aufruf im Projektordner:

    python3 werkzeuge/symbole.py

Braucht die Python-Bibliothek Pillow (auf Ubuntu meist schon vorhanden).
Das Motiv entspricht public/symbol.svg: violetter Ring mit Punkt, kleiner türkiser Punkt.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HINTERGRUND = (15, 17, 23)      # #0f1117
VIOLETT = (169, 156, 240)       # #a99cf0
TUERKIS = (93, 202, 165)        # #5dcaa5

ZIEL = Path(__file__).resolve().parent.parent / "public"
GLAETTUNG = 4  # größer zeichnen und verkleinern ergibt glatte Kanten


def motiv(groesse: int) -> Image.Image:
    """Das Motiv auf durchsichtigem Grund, `groesse` Pixel breit und hoch."""
    n = groesse * GLAETTUNG
    bild = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    stift = ImageDraw.Draw(bild)
    e = n / 512  # alle Maße beziehen sich auf ein 512er-Raster wie in symbol.svg

    def kreis(x, y, r, **optionen):
        stift.ellipse([(x - r) * e, (y - r) * e, (x + r) * e, (y + r) * e], **optionen)

    kreis(256, 256, 161, outline=VIOLETT, width=round(22 * e))  # Ring
    kreis(256, 256, 46, fill=VIOLETT)                            # Punkt in der Mitte
    kreis(362, 150, 30, fill=HINTERGRUND)                        # Aussparung im Ring
    kreis(362, 150, 24, fill=TUERKIS)                            # kleiner Punkt
    return bild.resize((groesse, groesse), Image.LANCZOS)


def flaeche(breite: int, hoehe: int, motiv_groesse: int) -> Image.Image:
    """Dunkle Fläche mit dem Motiv in der Mitte."""
    bild = Image.new("RGB", (breite, hoehe), HINTERGRUND)
    m = motiv(motiv_groesse)
    bild.paste(m, ((breite - motiv_groesse) // 2, (hoehe - motiv_groesse) // 2), m)
    return bild


def speichere(bild: Image.Image, name: str) -> None:
    pfad = ZIEL / name
    pfad.parent.mkdir(parents=True, exist_ok=True)
    bild.save(pfad, optimize=True)
    print(f"{name}: {bild.width}×{bild.height}, {pfad.stat().st_size // 1024 + 1} KB")


# Symbole: randlos (das Gerät rundet die Ecken selbst)
speichere(flaeche(192, 192, 176), "symbol-192.png")
speichere(flaeche(512, 512, 470), "symbol-512.png")
# „Maskierbar“: Android schneidet rundherum ab, darum sitzt das Motiv kleiner in der Mitte
speichere(flaeche(512, 512, 340), "symbol-maskierbar-512.png")
# iPhone-Home-Bildschirm
speichere(flaeche(180, 180, 150), "apple-touch-icon.png")

# Startbilder fürs iPhone: Breite × Höhe in Punkten und Pixeldichte.
# iOS zeigt ein Startbild nur, wenn es exakt zur Bildschirmgröße passt.
IPHONES = [
    (375, 667, 2),   # SE (2./3. Generation), 8
    (414, 896, 2),   # XR, 11
    (375, 812, 3),   # X, XS, 11 Pro
    (414, 896, 3),   # XS Max, 11 Pro Max
    (360, 780, 3),   # 12 mini, 13 mini
    (390, 844, 3),   # 12, 13, 14, 16e
    (428, 926, 3),   # 12/13 Pro Max, 14 Plus
    (393, 852, 3),   # 14 Pro, 15, 16
    (430, 932, 3),   # 14 Pro Max, 15 Plus, 16 Plus
    (402, 874, 3),   # 16 Pro, 17
    (440, 956, 3),   # 16 Pro Max, 17 Pro Max
    (420, 912, 3),   # Air
]

zeilen = []
for breite, hoehe, dichte in IPHONES:
    name = f"start/start-{breite * dichte}x{hoehe * dichte}.png"
    speichere(flaeche(breite * dichte, hoehe * dichte, 96 * dichte), name)
    zeilen.append(
        f'    <link rel="apple-touch-startup-image" href="{name}" '
        f'media="(device-width: {breite}px) and (device-height: {hoehe}px) '
        f'and (-webkit-device-pixel-ratio: {dichte}) and (orientation: portrait)" />'
    )

print("\nZeilen für index.html:\n")
print("\n".join(zeilen))
