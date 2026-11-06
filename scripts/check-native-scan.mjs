// Native-camera transport fixture. Checks recipient review; never signs or contacts a backend.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();
const files = await readdir("apps/android/app/src/main/assets/web/assets");
const css = await readFile(`apps/android/app/src/main/assets/web/assets/${files.find(f => f.endsWith(".css"))}`, "utf8");
const compiled = await build({
  stdin: { contents: `
    import {createRoot} from "react-dom/client";
    import {ScanScreen} from "@/components/pocket/scan/ScanScreen";
    import {installNativeAdapters} from "@/lib/native/client";
    import {addressRecipient} from "@/features/payments/address-recipient";
    window.scanCode=null;window.nativeCalls=[];window.reviewIntent=null;
    window.PocketNative={postMessage(data){const message=JSON.parse(data);window.nativeCalls.push(message.action);setTimeout(()=>window.PocketNative.onmessage({data:JSON.stringify({id:message.id,result:window.scanCode})}),5)}};
    installNativeAdapters();
    createRoot(document.getElementById("root")).render(<div className="pocket-root"><div className="pk-app"><ScanScreen onBack={()=>{}} onOpenReceive={()=>{}}
      onResolve={async handle=>({ok:true,recipient:{id:"fixture-sarah",name:"Sarah",handle,address:"0x1111111111111111111111111111111111111111",verified:true}})}
      onAddress={raw=>{const result=addressRecipient(raw);if(result.ok)window.addressIntent=result.recipient.address;return result}}
      onResolved={(id,amount)=>window.reviewIntent={id,amount:amount?.toString()}} /></div></div>);
  `, resolveDir: root, loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors=[];
page.on("pageerror", error=>errors.push(error.message));
await page.route("https://mpocket.tech/**", route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>`}));
try {
  await page.goto("https://mpocket.tech/home");
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await page.getByRole("button", { name:"Open camera", exact:true }).click();
  await page.getByRole("button", { name:"Open camera", exact:true }).waitFor();
  assert.equal(await page.evaluate(()=>window.reviewIntent),null,"Camera cancellation cannot start payment");
  await page.evaluate(()=>window.scanCode="https://unrelated.example/pay/123");
  await page.getByRole("button", { name:"Open camera", exact:true }).click();
  await page.getByText(/Paste a Pocket payment link from this site/).waitFor();
  assert.equal(await page.evaluate(()=>window.reviewIntent),null,"Foreign QR links are refused");
  await page.evaluate(()=>window.scanCode="pocket:@sarah?amount=12.00");
  await page.getByRole("button", { name:"Open camera", exact:true }).click();
  await page.getByRole("button", { name:"Continue to payment", exact:true }).waitFor();
  assert.equal(await page.evaluate(()=>window.reviewIntent),null,"Scanning stops at the recipient review");
  await page.getByRole("button", { name:"Continue to payment", exact:true }).click();
  assert.deepEqual(await page.evaluate(()=>window.reviewIntent),{id:"fixture-sarah",amount:"1200"});
  await page.evaluate(()=>{window.scanCode="0x123";window.reviewIntent=null});
  await page.getByRole("button", { name:"Open camera", exact:true }).click();
  await page.getByText(/That is not a wallet address/).waitFor();
  assert.equal(await page.evaluate(()=>window.addressIntent ?? null),null);
  await page.evaluate(()=>window.scanCode="0x1111111111111111111111111111111111111111");
  await page.getByRole("button", { name:"Open camera", exact:true }).click();
  await page.waitForFunction(()=>window.addressIntent);
  assert.equal(await page.evaluate(()=>window.addressIntent),"0x1111111111111111111111111111111111111111");
  assert.equal(await page.evaluate(()=>window.reviewIntent),null,"An address QR opens amount entry without signing");
  await page.evaluate(()=>navigator.share({text:"Pocket payment",url:"https://mpocket.tech/pay/EXAMPLE"}));
  assert.deepEqual(await page.evaluate(()=>window.nativeCalls),["scan","scan","scan","scan","scan","share"]);
  assert.deepEqual(errors,[]);
  const checks={fixtureOnly:true,cancelDoesNotPay:true,foreignCodeRefused:true,reviewRequired:true,receiveAddressQrSupported:true,malformedAddressRejected:true,amountPreserved:true,shareTransport:true,pageErrors:errors};
  await writeFile("docs/evidence/android/native-scan-fixture.json",JSON.stringify(checks,null,2)+"\n");
  console.log(JSON.stringify(checks,null,2));
} finally {await browser.close();}
