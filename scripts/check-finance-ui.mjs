// Reuse the real PocketApp/store fixture setup, then exercise navigation/loading.
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
let setup = (await readFile("scripts/check-mobile-app.mjs", "utf8")).split("const checks = {};")[0];
setup = setup.replace('const fixture = await readFile("scripts/fixtures/mobile-session-ui.tsx", "utf8");', `let fixture = await readFile("scripts/fixtures/mobile-session-ui.tsx", "utf8");
fixture = fixture.replace('claimableYield: "0"', 'claimableYield: fixture.fixtureYield ?? "0"')
  .replace('export const useEarnActions = () => ({ pendingClaimHash: () => null });', 'export const useEarnActions = () => ({ pendingClaimHash: () => null, claim: () => new Promise(resolve => { fixture.fixtureResolveClaim = resolve; }) });');`);
const checks = `
try {
  await page.route('**/*.ttf', async route => {
    const file = route.request().url().split('/').pop();
    await route.fulfill({ contentType: 'font/ttf', body: await readFile(assets + '/' + file) });
  });
  await open();
  const layouts = [];
  for (const width of [320,390,640]) {
    await page.setViewportSize({width,height:844});
    for (const [id,label] of [['home','Home'],['swap','Swap'],['wealth','Wealth']]) {
      await navigate(id);
      const nav = page.getByRole('navigation',{name:'Primary'});
      const button = nav.getByRole('button',{name:label,exact:true});
      await button.waitFor();await page.waitForTimeout(300);
      assert.equal(await button.getAttribute('aria-current'),'page');
      const geometry = await nav.evaluate(el => {
        const r = el.getBoundingClientRect();
        return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,radius:parseFloat(getComputedStyle(el).borderRadius),buttons:[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height) };
      });
      assert.ok(geometry.x >= 12 && width - geometry.x - geometry.width >= 12,'Dock has side margins');
      assert.ok(Math.abs(geometry.x + geometry.width/2 - width/2)<1,'Dock is centered');
      assert.ok(844-geometry.bottom >= 12,'Dock floats above the bottom');
      assert.ok(geometry.radius >= 28 && geometry.buttons.every(height=>height>=44),'Dock and buttons keep pill geometry');
      await page.locator('.pk-scr').evaluate(el=>{el.scrollTop=500;});
      assert.ok(Math.abs((await nav.boundingBox()).y - geometry.y)<1,'Scrolling does not move the dock');
      layouts.push({id,width,...geometry});
    }
  }
  await page.setViewportSize({width:390,height:844});await navigate('home');
  for (const [id,label] of [['swap','Swap'],['wealth','Wealth'],['home','Home']]) {
    await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:label,exact:true}).click();
    await page.waitForFunction(id=>window.fixturePocket.current.id===id,id);
    await page.waitForTimeout(300);
  }
  await mkdir('docs/evidence/android',{recursive:true});
  await page.screenshot({path:'docs/evidence/android/floating-nav-0.2.4-light.png'});
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await page.screenshot({path:'docs/evidence/android/floating-nav-0.2.4-dark.png'});
  await page.evaluate(()=>window.fixtureYield='2281836631150000');await navigate('vault');
  await page.getByText('0.00228183663115 MUSD',{exact:true}).waitFor();
  const claim = page.locator('.pk-interest-card button');await claim.click();
  const spinner = claim.getByRole('status',{name:'Loading'});await spinner.waitFor();
  assert.equal(await claim.isDisabled(),true);
  const spinnerRect = await spinner.boundingBox();const buttonRect = await claim.boundingBox();
  const spinnerStyle = await spinner.evaluate(el=>({width:parseFloat(getComputedStyle(el).width),height:parseFloat(getComputedStyle(el).height)}));
  assert.equal(spinnerStyle.width,16);assert.equal(spinnerStyle.height,16);
  assert.ok(spinnerRect.y>=buttonRect.y && spinnerRect.y+16<=buttonRect.y+buttonRect.height,'Spinner fits inside transaction button');
  await page.screenshot({path:'docs/evidence/android/claim-loading-0.2.4.png'});
  await page.evaluate(()=>window.fixtureResolveClaim({ok:true,hash:'0x'+'a'.repeat(64),claimedWei:2281836631150000n}));
  await page.getByText('0.00228183663115 mUSD interest confirmed in your wallet.',{exact:true}).waitFor();
  assert.equal(await spinner.count(),0);assert.equal(await claim.isDisabled(),false);
  assert.deepEqual(errors,[]);
  await writeFile('docs/evidence/android/finance-ui-0.2.4.json',JSON.stringify({createdAt:new Date().toISOString(),layouts,tabClicksNavigate:true,buttonSpinner:{...spinnerStyle,contained:true},smallInterestAndConfirmedPayoutVisible:true,financialActionsMocked:true,signingPerformed:false},null,2)+'\\n');
  console.log(JSON.stringify({floatingNavLayouts:layouts.length,tabClicksNavigate:true,spinnerSize:16,confirmedPayoutVisible:true}));
} finally {await browser.close();}
`;
const temporary = await mkdtemp(process.cwd() + '/.finance-ui-check-');
try {
  await writeFile(temporary + '/check.mjs', setup + checks);
  await import(pathToFileURL(temporary + '/check.mjs').href);
} finally { await rm(temporary, { recursive: true }); }
