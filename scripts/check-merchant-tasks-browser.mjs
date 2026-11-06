// Actual UI components with fixture APIs only. No login, money or messages.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const root = process.cwd();
const files = await readdir(".next/static/chunks");
const css = (await Promise.all(files.filter(f => f.endsWith(".css")).map(f => readFile(`.next/static/chunks/${f}`, "utf8")))).join("\n");
const fixture = `
  import {createElement} from 'react';
  import {WEEKLY_TASKS,weekWindow} from '@/lib/rewards/weekly';
  export default function Link(props){return createElement('a',props)}
  export class ApiError extends Error {}
  window.fixtureCalls=[]; window.fixtureComplete=false; window.fixtureCopied='';
  const api=async(path,init)=>{
    window.fixtureCalls.push({path,method:init?.method??'GET'});
    if(path==='/api/merchants/greylabs/coupon') return {code:'GREY-ABCDEF1234567890',percent:27,merchant:'Greylabs',createdAt:new Date().toISOString()};
    if(path==='/api/rewards/weekly') {const week=weekWindow();return {weekStart:week.start.toISOString(),resetsAt:week.end.toISOString(),syncing:false,inviteUrl:'https://mpocket.tech/home?ref='+ 'a'.repeat(24),tasks:WEEKLY_TASKS.map(t=>({...t,progress:window.fixtureComplete?t.target:0,complete:window.fixtureComplete}))};}
    if(path==='/api/waitlist/checkout') throw Error('Fixture stops before payment');
    throw Error('Unexpected fixture API '+path);
  };
  export const useApi=()=>api;
  const user={id:'fixture-user'};
  export const useSession=()=>({user,walletAddress:'0x2222222222222222222222222222222222222222'});
  export const useWelcomeReward=()=>({data:{state:'claimed',reason:null,rewardAmount:'20',claim:{amount:'20',tokenId:'941'},escrowAddress:null,unlockAt:null},loading:false,refresh(){}});
  export const useWalletClient=()=>({});
  export const getPublicClient=()=>({});
  export const MUSD_ABI=[];
  export const parseMusd=()=>0n;
`;
const bundle = await build({
  stdin: { contents: `
    import {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {ContactsScreen} from '@/components/pocket/contacts/ContactsScreen';
    import {RewardsSheet} from '@/components/pocket/home/RewardsSheet';
    function App(){const[open,setOpen]=useState(false);return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><div className="pocket-root" data-theme="light"><div className="pk-app" style={{height:'100dvh',position:'relative',width:'100%',maxWidth:480,margin:'auto',overflowY:'auto'}}>
    <button onClick={()=>setOpen(true)}>Open rewards</button><ContactsScreen recipients={[]} recent={[]} user={{name:'Test builder',handle:'@builder'}} onSelect={()=>{}} onSearchPeople={async()=>[]} onAdd={async()=>({ok:true})} onPayAddress={()=>({ok:false,error:'Fixture'})} onScan={()=>{}} onBack={()=>{}}/>
    <RewardsSheet open={open} onClose={()=>setOpen(false)} onManageLocks={()=>{}}/>
    </div></div></QueryClientProvider>};createRoot(document.getElementById('root')).render(<App/>);
  `, loader: "tsx", resolveDir: root }, bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_MEZO_ENV": '"testnet"', "process.env.NEXT_PUBLIC_MEZO_RPC_URL": '""' },
  plugins: [{name:"fixture-hooks",setup(b){
    b.onResolve({filter:/^(wagmi|next\/link|@\/lib\/auth\/(session|client)|@\/hooks\/use-welcome-reward|@\/lib\/mezo\/musd)$/},()=>({path:"fixture-hooks",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:fixture,loader:"js",resolveDir:root}));
  }}],
});
const browser = await chromium.launch({headless:true});
const errors=[];const checks={};
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://pocket-features.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}</style></head><body><div id="root"></div></body></html>`}));
  await page.goto('https://pocket-features.test/home');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.fixtureCopied=text}}}));
  await page.getByRole('heading',{name:'Verified merchants',exact:true}).waitFor();
  assert.equal(await page.getByText('Pocket mainnet access',{exact:true}).count(),1);
  assert.deepEqual(await page.evaluate(()=>window.fixtureCalls),[]);
  await page.getByRole('button',{name:'Get discount',exact:true}).click();
  const coupon=page.getByRole('dialog',{name:'Your Greylabs discount',exact:true});
  await coupon.getByText('27% off',{exact:true}).waitFor();
  await coupon.getByRole('button',{name:'Copy code',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixtureCopied),'GREY-ABCDEF1234567890');
  const shop=await coupon.getByRole('link',{name:'Explore Greylabs merch'}).getAttribute('href');
  assert.equal(new URL(shop).pathname,'/merchants/greylabs');
  await coupon.getByRole('button',{name:'Close',exact:true}).click();await coupon.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Get discount',exact:true}).click();await coupon.getByText('27% off',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureCalls.filter(c=>c.path.includes('coupon')).length),1);
  await coupon.getByRole('button',{name:'Close',exact:true}).click();await coupon.waitFor({state:'hidden'});
  checks.merchantCardsAndPersistentOffer=true;checks.couponCopyAndMerchLink=true;checks.noAutomaticCheckout=true;
  await mkdir('docs/evidence/android',{recursive:true});
  await page.getByRole('heading',{name:'Verified merchants'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/evidence/android/send-merchants.png'});
  await page.getByRole('button',{name:'Open rewards',exact:true}).click();
  const rewards=page.getByRole('dialog',{name:'Rewards & locks',exact:true});
  await rewards.getByRole('checkbox',{name:'Send mUSD to 5 friends',exact:true}).waitFor();
  assert.equal(await rewards.getByRole('checkbox').count(),7);
  assert.equal(await rewards.getByRole('checkbox',{name:'Send mUSD to 5 friends',exact:true}).getAttribute('aria-checked'),'false');
  await rewards.getByRole('checkbox',{name:'Send mUSD to 5 friends',exact:true}).click();
  assert.equal(await rewards.getByRole('checkbox',{name:'Send mUSD to 5 friends',exact:true}).getAttribute('aria-checked'),'false');
  await page.evaluate(()=>{window.fixtureComplete=true});
  await rewards.getByRole('button',{name:'Refresh progress',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[role=checkbox]')].every(el=>el.getAttribute('aria-checked')==='true'));
  await rewards.getByRole('button',{name:'Invite friends',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixtureCopied),'https://mpocket.tech/home?ref='+ 'a'.repeat(24));
  await rewards.getByRole('heading',{name:"This week's tasks",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/evidence/android/weekly-tasks.png'});
  checks.claimedWelcomeShowsWeeklyTasks=true;checks.confirmedProgressOnly=true;checks.inviteLink=true;
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await rewards.evaluate(el=>el.scrollWidth<=el.clientWidth),true);}
  checks.mobileWidths=[320,390];assert.deepEqual(errors,[]);checks.pageErrors=errors;
  await writeFile('docs/evidence/android/merchant-tasks-browser.json',JSON.stringify({createdAt:new Date().toISOString(),fixtureOnly:true,realAccountLogin:false,financialSigning:false,checks},null,2)+'\n');console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();}
