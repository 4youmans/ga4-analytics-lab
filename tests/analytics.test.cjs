const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = name => fs.readFileSync(path.join(root, name), 'utf8');
function element(props = {}) {
  return Object.assign({ listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } }, props);
}
function browser(search = '') {
  let now = 0, nextTimer = 0;
  const timers = new Map(), events = [], elements = {}, groups = {};
  const document = element({ hidden: false, title: 'Home — GA4 Lab', documentElement: { scrollHeight: 2000 },
    querySelector: key => elements[key] || null,
    querySelectorAll: key => groups[key] || [] });
  const window = element({ location: { search, pathname: '/index.html', origin: 'https://example.test',
    href: 'https://example.test/index.html' + search }, innerHeight: 800, scrollY: 0,
    gtag: (...args) => events.push(args),
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, {fn, due: now + delay}); return id; },
    clearTimeout: id => timers.delete(id) });
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({window, document, location: window.location, URL, URLSearchParams,
    Date: Clock, crypto: require('node:crypto').webcrypto, gtag: window.gtag,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  return {window, document, events, elements, groups,
    run: name => vm.runInContext(code(name), context, { filename: name }),
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
    } };
}

test('all pages use only the owner stream and resolve local files', () => {
  for (const name of ['index.html','about.html','contacts.html','guide.html']) {
    const html = code(name);
    assert.deepEqual([...new Set(html.match(/G-[A-Z0-9]{10}/g))], ['G-0L7H66CE9D']);
    assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
    for (const match of html.matchAll(/(?:src|href)="([^\"]+)"/g)) {
      if (/^(https?:|#)/.test(match[1])) continue;
      assert.ok(fs.existsSync(path.join(root, match[1].split('?')[0])), `${name}: ${match[1]}`);
    }
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  }
});

test('UTM parameters match the homework; navigation emits one event and keeps debug', () => {
  const b = browser('?debug_mode=true&utm_source=telegram&utm_medium=social&utm_campaign=lesson07');
  const nav = element({ textContent: ' About ', href: 'https://example.test/about.html',
    getAttribute(name) { return name === 'href' ? this.href : null; } });
  b.groups['nav a'] = [nav]; b.groups['a[href]'] = [nav];
  b.run('js/metrics.js'); nav.listeners.click();
  const utm = b.events.find(x=>x[1]==='utm_visit')[2];
  assert.equal(utm.utm_source, 'telegram'); assert.equal(utm.utm_medium, 'social');
  assert.equal(utm.utm_campaign, 'lesson07'); assert.equal(utm.landing_page, '/index.html');
  assert.equal(utm.debug_mode, true);
  assert.equal(b.events.filter(x=>x[1]==='nav_click').length, 1);
  assert.match(nav.href, /debug_mode=true/);
});

test('reading counts visible time and scrolling is counted once', () => {
  const b = browser(); b.run('js/metrics.js'); b.tick(10000);
  b.document.hidden = true; b.document.listeners.visibilitychange(); b.tick(60000);
  assert.equal(b.events.length, 0);
  b.document.hidden = false; b.document.listeners.visibilitychange(); b.tick(19999);
  assert.equal(b.events.length, 0); b.tick(1);
  assert.equal(b.events.filter(x=>x[1]==='read_30s').length, 1);
  b.window.scrollY = 900; b.window.listeners.scroll(); b.window.listeners.scroll();
  assert.equal(b.events.filter(x=>x[1]==='scroll_75').length, 1);
});

test('guide retains campaign, content and debugging on the route to the form', () => {
  const b = browser('?utm_source=instagram&utm_medium=social&utm_campaign=backend_guide&utm_content=reel01&debug_mode=true');
  const link = element(); b.elements['#lead-link'] = link;
  b.document.getElementById = () => link;
  b.run('guide.js');
  const target = new URL(link.href);
  assert.equal(target.pathname, '/contacts.html');
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','debug_mode']) {
    assert.equal(target.searchParams.get(key), new URLSearchParams(b.window.location.search).get(key));
  }
  link.listeners.click(); assert.equal(b.events[0][1], 'cta_click');
  assert.equal(b.events[0][2].button_name, 'guide_to_form');
});

test('form blocks missing receiver, preserves request id on repeat and resets it for a new lead', () => {
  const b = browser('?utm_source=telegram&utm_medium=social&utm_campaign=lesson07');
  const fields = Object.fromEntries(['utm_source','utm_medium','utm_campaign','request_id'].map(k=>[k,{value:''}]));
  const form = element({action:'https://example.test/contacts.html', elements:{namedItem:key=>fields[key]}});
  const status = {textContent:''}; b.elements['#lead-form'] = form; b.elements['#form-status'] = status;
  b.run('js/script.js');
  assert.equal(fields.utm_source.value, 'telegram');
  let blocked = false; form.listeners.submit({preventDefault:()=>{blocked=true;}});
  assert.equal(blocked,true); assert.equal(b.events.length,0); assert.equal(fields.request_id.value,'');
  form.action='https://script.google.com/macros/s/test-deployment/exec';
  form.listeners.submit({preventDefault:()=>assert.fail('Configured form must submit')});
  const id = fields.request_id.value; assert.match(id,/^REQ-[A-F0-9-]{36}$/);
  form.listeners.submit({preventDefault:()=>assert.fail('Repeat uses native POST')});
  assert.equal(fields.request_id.value,id);
  assert.equal(b.events.filter(x=>x[1]==='generate_lead').length,2);
  form.listeners.invalid({target:{name:'email', value:'private@example.test'}});
  assert.equal(b.events.at(-1)[2].field_name,'email');
  assert.ok(!JSON.stringify(b.events).includes('private@example.test'));
  form.listeners.reset(); b.tick(0); assert.equal(fields.request_id.value,'');
});

function receiver(options={}) {
  const headers=['request_id','created_at','name','email','direction','utm_source','utm_medium','utm_campaign','status'];
  const rows=[], releases=[];
  const finder={matchEntireCell(){return this;},matchCase(){return this;},useRegularExpression(){return this;},
    findNext(){return rows.some(r=>r[0]===this.id) ? {} : null;}};
  const sheet={getRange(...args){return {getValues:()=>[options.badSchema?[]:headers],
    createTextFinder(id){finder.id=id;return finder;}};},appendRow:row=>rows.push(row)};
  const context=vm.createContext({Date, SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
    LockService:{getScriptLock:()=>({tryLock:()=>!options.busy,releaseLock:()=>releases.push(true)})},
    ContentService:{MimeType:{JSON:'JSON'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
  vm.runInContext(code('apps-script/Code.gs'),context);
  const valid={request_id:'REQ-24E7A42C-6E90-4A5E-9DB4-786669CF2CF5', name:'Тест Студент',
    email:'student@example.com',direction:'data'};
  return {rows,releases,valid,post:p=>context.doPost({parameter:p})};
}

test('receiver validates payload, rejects duplicates and fixes status on the server', () => {
  const r=receiver();
  assert.equal(r.post({...r.valid,name:''}).error,'missing_required');
  assert.equal(r.post({...r.valid,email:'invalid'}).error,'invalid_email');
  assert.equal(r.post({...r.valid,request_id:'REQ-001'}).error,'invalid_request_id');
  assert.equal(r.post({...r.valid,direction:'unknown'}).error,'invalid_direction');
  assert.equal(r.post({...r.valid,name:'a'.repeat(201)}).error,'value_too_long');
  assert.equal(r.rows.length,0);
  assert.equal(r.post({...r.valid,name:'=1+1',status:'done'}).ok,true);
  assert.equal(r.rows[0][2],"'=1+1"); assert.equal(r.rows[0][8],'new');
  assert.deepEqual(Array.from(r.rows[0].slice(5,8)),['direct','none','not_set']);
  assert.equal(r.post(r.valid).error,'duplicate_request_id'); assert.equal(r.rows.length,1);
  assert.equal(r.releases.length,2);
  assert.equal(receiver({busy:true}).post(r.valid).error,'busy_retry');
  assert.equal(receiver({badSchema:true}).post(r.valid).error,'invalid_sheet_schema');
});
