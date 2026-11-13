import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const directory = new URL("../docs/submission/", import.meta.url);
const deck = JSON.parse(await readFile(new URL("pitch-deck.json", directory), "utf8"));
const root = new URL("../", import.meta.url);
const mark = (await readFile(new URL("public/brand/pocket-mark-64.png", root))).toString("base64");
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const cards = slide => '<div class="cards">' + (slide.cards ?? []).map((c,i) => '<article class="card '+escape(c.accent ?? '')+'"><span class="number">'+String(i+1).padStart(2,'0')+'</span><h2>'+escape(c.title)+'</h2><p>'+escape(c.body)+'</p></article>').join('') + '</div>';
const flow = slide => slide.flow ? '<div class="flow">' + slide.flow.map((s,i)=>'<div><small>'+String(i+1).padStart(2,'0')+'</small><b>'+escape(s)+'</b></div>').join('')+'</div>' : '';
const tags = slide => slide.tags ? '<div class="tags">'+slide.tags.map(t=>'<span>'+escape(t)+'</span>').join('')+'</div>' : '';
const links = slide => slide.links ? '<div class="links">'+slide.links.map(l=>'<a href="'+escape(l.url)+'">'+escape(l.label)+' ↗</a>').join('')+'</div>' : '';
const metrics = slide => slide.metrics ? '<div class="metrics">'+slide.metrics.map(m=>'<div class="metric"><strong>'+escape(m.value)+'</strong><span>'+escape(m.label)+'</span></div>').join('')+'</div>' : '';
async function render(slide,index) {
  const phone = slide.image ? '<figure class="phone"><div class="phone-frame"><img alt="'+escape(slide.caption)+'" src="data:image/png;base64,'+(await readFile(new URL(slide.image,root))).toString('base64')+'"></div><figcaption>'+escape(slide.caption)+'</figcaption></figure>' : '';
  const headline = '<h1>'+escape(slide.title).replaceAll('\n','<br>')+'</h1><p class="intro">'+escape(slide.intro)+'</p>';
  const tasks = slide.tasks ? '<ul class="tasks">'+slide.tasks.map(t=>'<li><span>✓</span>'+escape(t)+'</li>').join('')+'</ul>' : '';
  const note = slide.note ? '<p class="note">'+escape(slide.note)+'</p>' : '';
  const body = slide.layout === 'cover' || slide.layout === 'screen' ? '<div class="copy">'+headline+cards(slide)+tasks+note+tags(slide)+links(slide)+'</div>'+phone : headline+flow(slide)+metrics(slide)+cards(slide)+note+tags(slide)+links(slide);
  return '<section id="slide-'+(index+1)+'" class="slide '+slide.layout+'"><header><span class="brand"><img alt="" src="data:image/png;base64,'+mark+'">mPocket<span>●</span></span><span class="eyebrow">'+escape(slide.eyebrow)+'</span></header><main class="content">'+body+'</main><footer><span>'+escape(slide.footer)+'</span><b>'+String(index+1).padStart(2,'0')+' / '+deck.slides.length+'</b></footer></section>';
}
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(deck.title)+'</title><style>'+
`@page{size:1280px 720px;margin:0}
*{box-sizing:border-box}body{margin:0;background:#dedde3;color:#151518;font-family:Arial,Helvetica,sans-serif}
.slide{position:relative;width:1280px;height:720px;margin:24px auto;padding:42px 56px;background:#f5f5f7;break-after:page;overflow:hidden}.slide:last-of-type{break-after:auto}
header{height:42px;display:flex;justify-content:space-between;align-items:center}.brand{display:flex;gap:10px;align-items:center;font-size:27px;font-weight:800;letter-spacing:-1px}.brand img{width:34px;height:34px}.brand>span{font-size:12px;color:#a33edd}
.eyebrow{font-size:12px;letter-spacing:1.6px;font-weight:700;color:#64616c}.content{margin-top:27px;height:510px}
h1{font-size:49px;line-height:1.08;letter-spacing:-1.8px;margin:0;max-width:1100px}p{margin:0}.intro{margin-top:16px;max-width:1090px;font-size:20px;line-height:1.45;color:#605d68}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:26px}.card{padding:23px;border-radius:24px;background:white;border:1px solid #e8e6ec}.number{display:block;color:#8b8793;font-size:12px;margin-bottom:17px;font-weight:700}.card h2{font-size:23px;line-height:1.18;margin:0 0 13px;letter-spacing:-.5px}.card p{font-size:18px;line-height:1.5;color:#605d68}
.yellow{background:#ffce3c;border-color:#ffce3c}.purple{background:#a33edd;border-color:#a33edd;color:white}.dark{background:#18181c;border-color:#18181c;color:white}.purple p,.dark p{color:#f1eaf6}.purple .number,.dark .number{color:#ded4e7}.yellow p{color:#514621}
.flow{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:14px;margin-top:24px}.flow>div{position:relative;padding:17px 20px;background:#ffce3c;border-radius:18px;min-height:76px}.flow>div:not(:last-child):after{content:'→';position:absolute;right:-13px;top:29px;z-index:1;color:#17171c;font-weight:bold}.flow small{display:block;font-size:11px;margin-bottom:7px;color:#685921}.flow b{font-size:19px}
.tags,.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}.tags span{border:1px solid #d8d4de;padding:10px 14px;border-radius:99px;font-size:15px;font-weight:700}.links a{color:#6d249c;text-decoration:none;font-size:16px;font-weight:700;border-bottom:1px solid #b781d6;padding-bottom:5px;margin-right:14px}
footer{position:absolute;left:56px;right:56px;bottom:25px;display:flex;align-items:center;justify-content:space-between;gap:30px;border-top:1px solid #d7d4dd;padding-top:15px;font-size:12px;line-height:1.5;color:#67636f}footer>span{max-width:1030px}footer b{white-space:nowrap;color:#18181c}
.cover{background:#18181c;color:white}.cover .eyebrow,.cover footer{color:#bcb6c6}.cover footer{border-color:#45404b}.cover footer b{color:white}.cover .content,.screen .content{display:grid;grid-template-columns:1fr 285px;gap:38px;align-items:start}.cover h1{font-size:76px;line-height:1.04;letter-spacing:-3.7px;margin-top:30px;color:#ffce3c}.cover .intro{color:#e0dce4;max-width:710px;font-size:24px;line-height:1.42;margin-top:24px}.cover .tags span{border-color:#68616f}.cover .phone{margin-top:-8px}
.phone{margin:0;justify-self:center;width:246px}.phone-frame{border:7px solid #252329;border-radius:35px;overflow:hidden;background:#f5f5f7;box-shadow:0 18px 35px #17131f24;line-height:0}.phone img{display:block;width:100%;height:auto}.phone figcaption{font-size:11px;line-height:1.35;text-align:center;color:#77717f;margin-top:9px}.cover figcaption{color:#bcb6c6}
.screen h1{font-size:48px;max-width:770px}.screen .intro{font-size:19px;max-width:750px}.screen .cards{grid-template-columns:1fr;gap:12px;margin-top:23px}.screen .card{padding:19px 22px}.screen .number{display:none}.screen .card h2{font-size:22px;margin-bottom:7px}.screen .card p{font-size:18px;line-height:1.42}.screen .phone-frame img{margin-top:-13px}
.tasks{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:24px 0 0;padding:0;list-style:none}.tasks li{display:flex;gap:10px;align-items:center;min-height:45px;padding:12px;border-radius:14px;background:white;border:1px solid #e8e6ec;font-size:17px}.tasks li span{color:#a33edd;font-weight:bold}.note{margin-top:20px;font-size:16px;line-height:1.45;color:#605d68}
.finance .cards,.proof .cards{grid-template-columns:1fr 1fr}.finance .card{padding:20px 23px}.finance .number,.proof .number{display:none}.finance .card p{font-size:18px}.finance .links{margin-top:20px}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:20px}.metric{display:flex;gap:17px;align-items:center}.metric strong{font-size:52px;letter-spacing:-2px;color:#862daf}.metric span{font-size:17px;line-height:1.35;max-width:185px}.proof .cards{margin-top:18px}.proof .card{padding:19px}.proof .card p{font-size:17px}
.next h1{color:#772c9e}.next .cards{margin-top:24px}.business .cards{margin-top:27px}.business .card p,.next .card p{font-size:18px}.business .note{padding:15px 20px;border-radius:14px;background:#e7dced}
.deck-nav{position:fixed;right:18px;bottom:15px;display:flex;gap:10px;align-items:center;padding:8px;background:#18181c;color:white;border-radius:99px;z-index:4;font-size:12px}.deck-nav button{background:#fff;color:#18181c;border:0;border-radius:99px;padding:8px 12px;cursor:pointer}
@media print{body{background:white}.slide{margin:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}.deck-nav{display:none}}
@media screen and (max-width:800px){.slide{width:100%;height:auto;min-height:720px;margin:0 0 16px;padding:24px;overflow:visible}.content{height:auto;margin-top:28px}.cover .content,.screen .content{display:flex;flex-direction:column;gap:28px}.cover h1{font-size:48px;letter-spacing:-2px;margin-top:10px}h1,.screen h1{font-size:36px}.cover .intro,.intro,.screen .intro{font-size:19px}.cards,.screen .cards,.finance .cards,.proof .cards{grid-template-columns:1fr}.card p{font-size:17px}.phone{align-self:center;width:220px}.flow{grid-auto-flow:row;grid-template-columns:1fr 1fr}.flow>div:after{display:none}.metrics{gap:10px}.metric{display:block}.metric strong{font-size:37px}.metric span{display:block;font-size:13px}footer{position:static;margin-top:30px;font-size:11px;gap:10px}.tasks{grid-template-columns:1fr}.deck-nav{font-size:11px;right:8px}}
`+'</style></head><body>'+ (await Promise.all(deck.slides.map(render))).join('') +
'<nav class="deck-nav" aria-label="Slide controls"><button aria-label="Previous slide">←</button><span>1 / '+deck.slides.length+'</span><button aria-label="Next slide">→</button></nav><script>let current=0;const slides=[...document.querySelectorAll(".slide")],nav=document.querySelector(".deck-nav");function go(n){current=Math.max(0,Math.min(slides.length-1,n));slides[current].scrollIntoView({behavior:"smooth"});nav.querySelector("span").textContent=(current+1)+" / "+slides.length;}nav.querySelectorAll("button")[0].onclick=()=>go(current-1);nav.querySelectorAll("button")[1].onclick=()=>go(current+1);document.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){e.preventDefault();go(current+1)}if(e.key==="ArrowLeft"){e.preventDefault();go(current-1)}});const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){current=slides.indexOf(e.target);nav.querySelector("span").textContent=(current+1)+" / "+slides.length;}}),{threshold:.5});slides.forEach(slide=>observer.observe(slide));</script></body></html>';
await writeFile(new URL("pitch-deck.html",directory),html);
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setContent(html,{waitUntil:"load"});
 const layout=await page.locator(".slide").evaluateAll(slides=>slides.map((slide,index)=>{
  const footer=slide.querySelector("footer").getBoundingClientRect();
  const content=slide.querySelector(".content");
  const boxes=[...content.querySelectorAll("h1,p,article,li,.phone,.flow,.metrics,.tags,.links")].map(el=>el.getBoundingClientRect());
  return {slide:index+1,clipped:boxes.some(r=>r.bottom>footer.top-10),horizontalOverflow:slide.scrollWidth>slide.clientWidth};
 }));
 if(layout.some(s=>s.clipped||s.horizontalOverflow))throw Error("Deck overflow: "+JSON.stringify(layout));
 await page.pdf({path:new URL("pitch-deck.pdf",directory).pathname,width:"1280px",height:"720px",printBackground:true,preferCSSPageSize:true});
 await page.locator(".deck-nav").evaluate(el=>el.style.visibility="hidden");
 const preview=[];
 for(let i=0;i<deck.slides.length;i++){
  const bytes=await page.locator(".slide").nth(i).screenshot();
  await writeFile('/tmp/mpocket-pitch-slide-'+(i+1)+'.png',bytes);
  preview.push('<img src="data:image/png;base64,'+bytes.toString('base64')+'">');
 }
 await page.locator(".deck-nav").evaluate(el=>el.style.visibility="visible");
 await page.locator(".slide").first().scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector(".deck-nav span").textContent.startsWith("1 /"));
 await page.getByRole("button",{name:"Next slide"}).click();
 await page.waitForFunction(()=>document.querySelector(".deck-nav span").textContent.startsWith("2 /"));
 await page.keyboard.press("ArrowRight");
 await page.waitForFunction(()=>document.querySelector(".deck-nav span").textContent.startsWith("3 /"));
 const pdfBytes=await readFile(new URL("pitch-deck.pdf",directory));
 const pdfPageCount=[...pdfBytes.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)].length;
 if(pdfPageCount!==deck.slides.length)throw Error("Unexpected PDF page count: "+pdfPageCount);
 await page.setViewportSize({width:390,height:844});
 const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(mobileOverflow||errors.length)throw Error("Deck browser check failed: "+JSON.stringify({mobileOverflow,errors}));
 await page.setViewportSize({width:1280,height:900});
 await page.setContent('<style>body{margin:0;background:#dedde3;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:12px}img{display:block;width:100%}</style>'+preview.join(''));
 await page.screenshot({path:new URL("pitch-deck-preview.png",directory).pathname,fullPage:true});
 await writeFile(new URL("pitch-deck-validation.json",directory),JSON.stringify({updatedAt:new Date().toISOString(),slides:layout.length,layout,mobileHorizontalOverflow:mobileOverflow,keyboardAndButtonNavigation:true,pdfPageCount,pdf:"pitch-deck.pdf",screenshotSessionsAndBalancesMocked:true,pageErrors:errors},null,2)+"\n");
 await mkdir(new URL("public/",root),{recursive:true});
 for(const file of ["pitch-deck.html","pitch-deck.pdf"])await copyFile(new URL(file,directory),new URL("public/"+file,root));
 console.log(JSON.stringify({slides:layout.length,layoutPassed:true,mobileOverflow:false,pdf:"docs/submission/pitch-deck.pdf"}));
}finally{await browser.close();}
