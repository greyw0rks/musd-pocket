"""Render the editable eight-slide JSON deck to printable, standalone HTML."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
deck = json.loads((root / "docs/submission/pitch-deck.json").read_text())
assert len(deck["slides"]) == 8
escape = html.escape
slides = []
for index, slide in enumerate(deck["slides"], 1):
    cards = "".join(
        f'<article><h2>{escape(card["title"])}</h2><p>{escape(card["body"])}</p></article>'
        for card in slide["cards"]
    )
    slides.append(
        f'<section class="slide"><header><span class="brand">pocket<span class="dot">.</span></span>'
        f'<span class="label">{escape(slide["eyebrow"])}</span></header>'
        f'<h1>{escape(slide["title"])}</h1><p class="intro">{escape(slide["intro"])}</p>'
        f'<div class="cards">{cards}</div><footer><span>{escape(slide["footer"])}</span>'
        f'<span>{index:02d} / 08</span></footer></section>'
    )
document = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>''' + escape(deck["title"]) + '''</title><style>
@page{size:13.333in 7.5in;margin:0}
*{box-sizing:border-box}body{margin:0;background:#e8e8ec;color:#17171d;font-family:Arial,Helvetica,sans-serif}
.slide{width:1280px;height:720px;position:relative;background:#f9f9fb;padding:44px 64px;margin:24px auto;break-after:page;overflow:hidden}
.slide:last-child{break-after:auto}header{display:flex;align-items:center;justify-content:space-between}
.brand{font-size:31px;font-weight:800;letter-spacing:-1.5px}.dot{color:#7943e6}.label{font-size:12px;font-weight:700;letter-spacing:1.7px;color:#696775}
h1{margin:48px 0 20px;max-width:1060px;font-size:54px;line-height:1.08;font-weight:750;letter-spacing:-2px}
.intro{font-size:21px;line-height:1.5;max-width:1060px;color:#5b5967;margin:0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:34px}
article{border-top:3px solid #7943e6;padding:18px 0}h2{margin:0 0 12px;font-size:19px;line-height:1.3}
article p{font-size:16px;line-height:1.55;color:#5b5967;margin:0}
footer{position:absolute;left:64px;right:64px;bottom:32px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-top:1px solid #d9d8e0;padding-top:16px;color:#74717d;font-size:12px;line-height:1.4}
footer span:first-child{max-width:960px}footer span:last-child{white-space:nowrap}
@media print{body{background:white}.slide{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
@media screen and (max-width:1280px){.slide{transform-origin:top left;margin:0;width:100vw;height:auto;min-height:720px;padding:32px}h1{font-size:42px}.cards{grid-template-columns:1fr}footer{position:static;margin-top:30px}}
</style></head><body>''' + "".join(slides) + "</body></html>"
output = root / "docs/submission/pitch-deck.html"
output.write_text(document)
print(output)
