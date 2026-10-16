import { bookingContrast } from './booking-contrast.mjs';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const phase = process.argv[2] ?? 'before';
const root = `artifacts/responsive/${phase}`;
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:32178' });
const page = await context.newPage();
const results = process.env.AUDIT_ONLY ? JSON.parse(await readFile(`${root}/audit.json`, "utf8")) : [];
async function capture(name, path) {
 if(process.env.AUDIT_ONLY && !new RegExp(process.env.AUDIT_ONLY).test(name)) return;
 for (const width of [360,768,1280]) {
  await page.setViewportSize({width,height:900});
  await page.goto(path).catch(async () => { await page.waitForTimeout(500); await page.goto(path); }); await page.waitForLoadState('networkidle', {timeout:10000}).catch(() => {}); await page.evaluate(() => document.fonts.ready);
  if(path==='/settings') await page.locator('.settings-fieldset').waitFor();
  if(path.endsWith('/book')) await page.locator('.pb-service').first().waitFor();
  if(['/','/calendar','/bookings'].includes(path)) await page.locator('.day-grid-panel').waitFor();
  if(name.startsWith('book-time-') || name.startsWith('book-details-')) {
   await page.locator('.pb-service').first().click();
   await page.getByRole('button',{name:'Үргэлжлүүлэх',exact:true}).click();
   await page.locator('.pb-days button').nth(1).click();
   await page.locator('.pb-times button').first().waitFor();
   if(name.startsWith('book-details-')) {
    await page.locator('.pb-times button').first().click();
    await page.getByRole('button',{name:'Үргэлжлүүлэх',exact:true}).click();
   }
  }
  await page.screenshot({path:`${root}/${name}-${width}.png`,fullPage:true});
  const metrics = await page.evaluate(() => ({
   overflow: document.documentElement.scrollWidth > innerWidth + 1,
   small: [...document.querySelectorAll('button,a,input,select')].filter(e => {
    const target = e.matches('input[type=radio],input[type=checkbox]') ? (e.closest('label') ?? e) : e;
    const r=target.getBoundingClientRect(), s=getComputedStyle(target);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && !e.closest('nextjs-portal') && (r.width<44 || r.height<44);
   }).map(e=>({tag:e.tagName,cls:e.className,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,60),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}))
  }));
  const previous = results.findIndex(r=>r.name===name && r.width===width); if(previous>=0) results.splice(previous,1);
  results.push({name,width,contrastFailures:await bookingContrast(page),url:new URL(page.url()).pathname,...metrics});
  console.log(name,width,metrics.overflow,metrics.small.length);
 }
 await writeFile(`${root}/audit.json`,JSON.stringify(results,null,2));
}
async function login(email) {
 await context.clearCookies(); await page.goto('/sign-in');
 await page.getByLabel('Имэйл хаяг',{exact:true}).fill(email);
 await page.getByLabel('Нууц үг',{exact:true}).fill('TestPassword123!');
 await page.getByRole('button',{name:'Нэвтрэх',exact:true}).click();
 await page.waitForURL(u=>!u.pathname.includes('sign-in'));
}
for(const path of ['business','home','sign-up','invite']) await capture(path,`/${path}`);
await capture('book','/salon-a/book');
await login('applicant-desktop@example.test'); await capture('onboarding','/onboarding');
await login('owner@example.test');
for(const [name,path] of [['dashboard','/'],['calendar','/calendar'],['bookings','/bookings'],['reports','/reports'],['settings','/settings'],['team','/team']]) await capture(name,path);
if(phase==='after') {
 const policy=await (await page.request.get('/api/booking-settings')).json();
 const date=new Date(Date.now()+45*86400000).toISOString().slice(0,10);
 const availability=await (await page.request.get(`/api/public/salon-a/visits?branchId=z&services=book-service-a-60&date=${date}`)).json();
 const response=await page.request.post('/api/public/salon-a/visits',{headers:{Origin:'http://127.0.0.1:32178'},data:{branchId:'z',items:[{serviceId:'book-service-a-60'}],startAt:availability.slots[0].startAt,customer:{name:'Туршилтын зочин',phone:'88991122'},idempotencyKey:crypto.randomUUID()}});
 if(!response.ok()) throw new Error(await response.text());
 const {manageUrl}=await response.json();
 for(const theme of ['LIGHT','DARK','PINK','NATURAL','GOLD']) {
  const response=await page.request.patch('/api/booking-settings',{headers:{Origin:'http://127.0.0.1:32178'},data:{...policy,bookingTheme:theme}});
  if(!response.ok()) throw new Error(await response.text());
  await capture(`book-${theme.toLowerCase()}`,'/salon-a/book');
  await capture(`manage-${theme.toLowerCase()}`,manageUrl);
  if(process.env.AUDIT_STEPS) {
   await capture(`book-time-${theme.toLowerCase()}`,'/salon-a/book');
   await capture(`book-details-${theme.toLowerCase()}`,'/salon-a/book');
  }
 }
 await page.request.patch('/api/booking-settings',{headers:{Origin:'http://127.0.0.1:32178'},data:policy});
}
await login('platform@example.test'); await capture('platform','/platform');
await browser.close();
