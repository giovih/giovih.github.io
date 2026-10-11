# Disegna icone e schermata di avvio dell'APK (stesso disegno di armadio/icons).
# Uso: python3 genera-icone.py   → scrive in res/
from pathlib import Path
from PIL import Image, ImageDraw

def icona(lato, margine=0.0, tonda=False, angoli=True):
    S = lato * 4
    g = Image.new("RGBA", (S, S))
    px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            px[x, y] = (int(124 + 112 * t), int(58 + 14 * t), int(237 - 84 * t), 255)
    mask = Image.new("L", (S, S), 0)
    if tonda: ImageDraw.Draw(mask).ellipse([0, 0, S - 1, S - 1], fill=255)
    else: ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22) if angoli else 0, fill=255)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    im.paste(g, (0, 0), mask)
    d = ImageDraw.Draw(im)
    k = 1 - 2 * margine
    P = lambda x, y: (S * (margine + x * k), S * (margine + y * k))
    w = int(S * 0.055 * k)
    cx, cy = P(0.5, 0.30); rr = S * 0.075 * k
    d.arc([cx - rr, cy - rr, cx + rr, cy + rr], start=180, end=60, fill="white", width=w)
    d.line([P(0.5, 0.375), P(0.5, 0.43)], fill="white", width=w)
    pts = [P(0.5, 0.43), P(0.16, 0.68), P(0.84, 0.68)]
    d.line(pts + [pts[0]], fill="white", width=w, joint="curve")
    for p in pts: d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill="white")
    sx, sy = P(0.78, 0.24); sr = S * 0.07 * k
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(255, 214, 92, 255))
    return im.resize((lato, lato), Image.LANCZOS)

res = Path(__file__).parent / "res"
DENSITA = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for nome, f in DENSITA.items():
    cartella = res / f"mipmap-{nome}"; cartella.mkdir(parents=True, exist_ok=True)
    icona(round(48 * f)).save(cartella / "ic_launcher.png")
    icona(round(48 * f), tonda=True).save(cartella / "ic_launcher_round.png")
    # icona adattiva: 108dp, il disegno sta nei 66dp centrali
    icona(round(108 * f), margine=0.19, angoli=False).save(cartella / "ic_launcher_foreground.png")

# schermata di avvio (Android < 12): sfondo chiaro con l'icona al centro
SPLASH = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
for nome, (w, h) in SPLASH.items():
    for verso, (W, H) in (("port", (w, h)), ("land", (h, w))):
        im = Image.new("RGB", (W, H), (247, 244, 239))
        ic = icona(round(min(W, H) * 0.28))
        im.paste(ic, ((W - ic.width) // 2, (H - ic.height) // 2), ic)
        cartella = res / f"drawable-{verso}-{nome}"; cartella.mkdir(parents=True, exist_ok=True)
        im.save(cartella / "splash.png")
im = Image.new("RGB", (480, 480), (247, 244, 239)); ic = icona(140); im.paste(ic, (170, 170), ic)
(res / "drawable").mkdir(exist_ok=True); im.save(res / "drawable" / "splash.png")
