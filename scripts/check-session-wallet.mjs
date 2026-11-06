// Real wallet/position hooks; fixture connectors and sessions, no signing.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const owner = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const fixture = `
import {useSyncExternalStore} from 'react';
const w=window;w.s={version:0,owner:'${owner}',active:'${other}',chain:31611,activate:false};
const wallets=['${other}','${owner}'].map(address=>({address,walletClientType:'privy',switchChain:async id=>{w.switches.push({address,id});w.s.chain=id;}}));
const makeClient=address=>({account:{address},chain:{id:31611}});w.s.client=makeClient('${other}');w.switches=[];w.activations=[];w.reads=[];w.queries=[];
const update=next=>{Object.assign(w.s,next);w.s.version++;dispatchEvent(new Event('fixture'));};w.updateWallet=update;
const sub=fn=>{addEventListener('fixture',fn);return()=>removeEventListener('fixture',fn);};const version=()=>useSyncExternalStore(sub,()=>w.s.version);
export function useSession(){version();return {user:w.s.owner?{id:w.s.owner}:null,walletAddress:w.s.owner};}
export function useAccount(){version();return {address:w.s.active,chainId:w.s.chain,isConnected:true};}
export function useWalletClient(params){version();w.walletQuery=params;return {data:w.s.client};}
export function useReadContract(params){w.reads.push({type:'musd',...params});return {data:params.args?.[0]==='${owner}'?40n*10n**18n:0n,refetch:async()=>{}};}
export function useBalance(params){w.reads.push({type:'btc',...params});return {data:params.address==='${owner}'?{value:10n**16n}:undefined};}
export function useMezoNetwork(){return {networkName:'Mezo Testnet',expectedChainId:31611,wrongNetwork:w.s.chain!==31611};}
export function useBtcPrice(){return null;}
export function useWallets(){return {wallets};}
const activate=async target=>{w.activations.push(target.address);update({active:target.address,client:makeClient(target.address)});};
export function useSetActiveWallet(){return {setActiveWallet:activate};}
export function useApi(){const address=w.s.owner;return async path=>{w.queries.push({path,address});return path==='/api/earn'?{earn:{principal:address==='${owner}'?'40':'7'}}:{borrow:{collateral:address==='${owner}'?'5':'2'}};};}
`;
const harness = `
import {createRoot} from 'react-dom/client';import {useEffect,useSyncExternalStore} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useSessionWallet} from '@/hooks/use-session-wallet';import {useMusdBalance} from '@/hooks/use-musd';import {useLiveWallet,EmbeddedWalletActivator} from '@/hooks/use-live-wallet';import {useEarn} from '@/hooks/use-earn';import {useBorrow} from '@/hooks/use-borrow';import 'fixture';
function Harness(){useSyncExternalStore(fn=>{addEventListener('fixture',fn);return()=>removeEventListener('fixture',fn);},()=>window.s.version);const wallet=useSessionWallet();const musd=useMusdBalance();const live=useLiveWallet();const earn=useEarn();const borrow=useBorrow();useEffect(()=>{window.hooks={wallet,musd,live,earn:earn.data,borrow:borrow.data};window.savedGetter??=wallet.getWalletClient;});return window.s.activate?<EmbeddedWalletActivator/>:null;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Harness/></QueryClientProvider>);
`;
const root = process.cwd();
const bundle = await build({ stdin: { contents: harness, loader: "tsx", resolveDir: root }, bundle: true, write: false, jsx: "automatic", format: "iife", define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_MEZO_ENV": '"testnet"', "process.env.NEXT_PUBLIC_MEZO_RPC_URL": '""' }, plugins: [{ name: "session-fixture", setup(b) {
  b.onResolve({ filter: /^(fixture|wagmi|@privy-io\/react-auth|@privy-io\/wagmi|@\/lib\/auth\/(session|client)|@\/hooks\/use-(mezo-network|btc-price))$/ }, () => ({ path: "fixture", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: fixture, loader: "tsx", resolveDir: root }));
  b.onResolve({ filter: /^@\// }, args => ({ path: root + "/" + args.path.slice(2) + ".ts" }));
} }] });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];page.on("pageerror", e => errors.push(e.message));
await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
try {
  await page.goto("https://wallet-fixture.test/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.hooks?.earn?.principal === "40");
  assert.equal(await page.evaluate(() => window.savedGetter()), null);
  assert.equal(await page.evaluate(() => window.hooks.musd.formatted), "40");
  assert.equal(await page.evaluate(() => window.hooks.live.address), owner);
  assert.equal(await page.evaluate(() => window.reads.every(read => read.chainId === 31611 && (read.address === window.s.owner || read.type === 'musd' && read.args[0] === window.s.owner))), true);
  await page.evaluate(() => window.updateWallet({ activate: true }));
  await page.waitForFunction(() => window.savedGetter()?.account.address === window.s.owner);
  assert.deepEqual(await page.evaluate(() => window.activations), [owner]);
  assert.deepEqual(await page.evaluate(() => window.switches), [{ address: owner, id: 31611 }]);
  await page.evaluate(() => window.updateWallet({ chain: 1 }));
  await page.waitForFunction(() => window.savedGetter() === null);
  assert.equal(await page.evaluate(() => window.walletQuery.query.enabled), false);
  await page.evaluate(() => window.updateWallet({ activate: false, owner: null }));
  await page.waitForFunction(() => window.hooks.live === null);
  assert.equal(await page.evaluate(() => window.savedGetter()), null);
  assert.equal(await page.evaluate(() => window.hooks.earn), undefined);
  await page.evaluate(other => window.updateWallet({ owner: other, chain: 31611, active: other, client: { account: { address: other }, chain: { id: 31611 } } }), other);
  await page.waitForFunction(() => window.hooks.earn?.principal === "7");
  assert.equal(await page.evaluate(() => window.hooks.borrow.collateral), "2");
  assert.equal(await page.evaluate(() => window.savedGetter()?.account.address), other);
  assert.deepEqual(errors, []);
  const checks = { sessionWalletUsedForMusdAndBtc: true, wrongActiveWalletBlocked: true, namedPrivyWalletActivatedOnMezo: true, wrongChainBlocked: true, stableGetterFollowsLogoutAndNewSession: true, earnAndBorrowCachesSeparateAccounts: true };
  await mkdir("docs/evidence/android", { recursive: true });
  await writeFile("docs/evidence/android/session-wallet-0.2.4.json", JSON.stringify({ createdAt: new Date().toISOString(), checks, sessionAndConnectorMocked: true, signingPerformed: false }, null, 2) + "\n");
  console.log(JSON.stringify(checks));
} finally { await browser.close(); }
