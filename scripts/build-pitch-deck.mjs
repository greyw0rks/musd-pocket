import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const directory = new URL("../docs/submission/", import.meta.url);
const deck = JSON.parse(await readFile(new URL("pitch-deck.json", directory), "utf8"));
const mark = (await readFile(new URL("../public/brand/pocket-mark-64.png", import.meta.url))).toString("base64");
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(deck.title)}</title><style>
@page{size:1280px 720px;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8e8ec;color:#17171d;font-family:Arial,Helvetica,sans-serif}
.slide{width:1280px;height:720px;position:relative;background:#f9f9fb;padding:42px 64px;margin:24px auto;break-after:page;overflow:hidden}.slide:last-child{break-after:auto}
header{display:flex;align-items:center;justify-content:space-between}.brand{display:flex;gap:12px;align-items:center;font-size:31px;font-weight:800;letter-spacing:-1.5px}.brand img{width:36px;height:36px}.dot{color:#7943e6}.label{font-size:12px;font-weight:700;letter-spacing:1.7px;color:#696775}
h1{margin:43px 0 20px;max-width:1060px;font-size:53px;line-height:1.08;font-weight:750;letter-spacing:-2px}.intro{font-size:21px;line-height:1.5;max-width:1060px;color:#5b5967;margin:0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:32px}article{border-top:3px solid #7943e6;padding:18px 0}h2{margin:0 0 12px;font-size:19px;line-height:1.3}article p{font-size:17px;line-height:1.55;color:#5b5967;margin:0}
footer{position:absolute;left:64px;right:64px;bottom:30px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-top:1px solid #d9d8e0;padding-top:16px;color:#74717d;font-size:13px;line-height:1.4}footer span:first-child{max-width:960px}footer span:last-child{white-space:nowrap}
@media print{body{background:white}.slide{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
@media screen and (max-width:1000px){.slide{margin:0 0 24px;width:100%;height:auto;min-height:720px;padding:28px}h1{font-size:38px}.intro{font-size:19px}.cards{grid-template-columns:1fr;gap:8px}footer{position:static;margin-top:25px}header{gap:12px}.label{font-size:10px}}
</style></head><body>${deck.slides.map((slide,index)=>`<section class="slide"><header><span class="brand"><img alt="" src="data:image/png;base64,${mark}">pocket<span class="dot">.</span></span><span class="label">${escape(slide.eyebrow)}</span></header><h1>${escape(slide.title)}</h1><p class="intro">${escape(slide.intro)}</p><div class="cards">${slide.cards.map(card=>`<article><h2>${escape(card.title)}</h2><p>${escape(card.body)}</p></article>`).join("")}</div><footer><span>${escape(slide.footer)}</span><span>${String(index+1).padStart(2,"0")} / ${String(deck.slides.length).padStart(2,"0")}</span></footer></section>`).join("")}</body></html>`;
await writeFile(new URL("pitch-deck.html", directory), html);
const browser = await chromium.launch({ headless:true });
try {
const page = await browser.newPage({ viewport:{width:1440,height:900} });
await page.setContent(html, {waitUntil:"load"});
const layout = await page.locator(".slide").evaluateAll(slides=>slides.map((slide,index)=>{
 const footer=slide.querySelector("footer").getBoundingClientRect();
 const content=[...slide.querySelectorAll("h1,.intro,article")].map(e=>e.getBoundingClientRect());
 return {slide:index+1,clipped:content.some(r=>r.bottom>footer.top-8),horizontalOverflow:slide.scrollWidth>slide.clientWidth};
}));
if(layout.some(item=>item.clipped||item.horizontalOverflow)) throw new Error("Deck overflow: "+JSON.stringify(layout));
await page.pdf({path:new URL("pitch-deck.pdf",directory).pathname,width:"1280px",height:"720px",printBackground:true,preferCSSPageSize:true});
for(const index of [0,2,6,9]) await page.locator(".slide").nth(index).screenshot({path:`/tmp/pocket-pitch-slide-${index+1}.png`});
await page.setViewportSize({width:390,height:844});
const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
if(mobileOverflow) throw new Error("Mobile deck horizontal overflow");
await writeFile(new URL("pitch-deck-validation.json",directory),JSON.stringify({updatedAt:new Date().toISOString(),slides:layout.length,layout,mobileHorizontalOverflow:mobileOverflow,pdf:"pitch-deck.pdf"},null,2)+"\n");
await mkdir(new URL("../public/",import.meta.url),{recursive:true});
await copyFile(new URL("pitch-deck.pdf",directory),new URL("../public/pitch-deck.pdf",import.meta.url));
await copyFile(new URL("pitch-deck.html",directory),new URL("../public/pitch-deck.html",import.meta.url));
console.log(JSON.stringify({slides:layout.length,pdf:"docs/submission/pitch-deck.pdf",publicPdf:"/pitch-deck.pdf",layoutPassed:true,mobileOverflow:false}));
} finally {await browser.close();}

