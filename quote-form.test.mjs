import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./site.js', import.meta.url), 'utf8')
  .replace(/\}\)\(\);\s*$/, 'globalThis.bindQuoteForTest = bindQuoteForm; })();');

function element(value = '') {
  const attributes = new Map();
  const classes = new Set();
  return {
    value, textContent: '', hidden: true, disabled: false, listeners: {},
    classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    setAttribute: (k, v) => attributes.set(k, v),
    getAttribute: k => attributes.get(k),
    removeAttribute: k => attributes.delete(k),
    addEventListener(name, fn) { this.listeners[name] = fn; }
  };
}

function setup({ data = { success: true }, status = 200, reject, malformed = false, pending = false, analyticsError = false } = {}) {
  const fields = Object.fromEntries(Object.entries({ inst: 'Entreprise test', vol: '5', zone: 'Port-de-Paix', frequency: 'Demande ponctuelle', email: 'test@example.com', phone: '+50900000000', details: 'Essai local' }).map(([k, v]) => [k, element(v)]));
  const button = element(); button.textContent = 'Soumettre';
  const honey = element(); const token = element('test-token');
  const statusEl = element(); const fallback = element(); const form = element();
  let resetCount = 0; let challengeResets = 0; let time = 0;
  form.querySelector = selector => selector.includes('submit') ? button : selector.includes('_honey') ? honey : token;
  form.checkValidity = () => true;
  form.reportValidity = () => {};
  form.reset = () => { resetCount++; };
  const timers = []; const requests = []; const events = [];
  let complete;
  const result = { ok: status >= 200 && status < 300, status, json: async () => { if (malformed) throw new Error('invalid_json'); return data; } };
  const window = {
    location: { protocol: 'https:', hostname: 'www.zepoulayiti.com', href: 'https://www.zepoulayiti.com/' },
    navigator: { onLine: true }, crypto: { randomUUID: () => 'stable-test-id' },
    turnstile: { reset: () => { challengeResets++; } },
    gtag: (...args) => { if (analyticsError) throw new Error('analytics_failure'); events.push(args); },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cleared = true; }
  };
  const document = {
    getElementById: id => ({ 'quote-form': form, 'form-status': statusEl, 'quote-whatsapp-fallback': fallback }[id] || fields[id]),
    addEventListener: () => {}
  };
  const context = vm.createContext({ window, document, Promise, Date: { now: () => time }, AbortController,
    fetch: (url, options) => {
      requests.push({ url, options });
      if (pending) return new Promise((resolve, rejectPromise) => {
        complete = () => resolve(result);
        options.signal?.addEventListener('abort', () => rejectPromise(new Error('aborted')));
      });
      return reject ? Promise.reject(new Error(reject)) : Promise.resolve(result);
    }
  });
  vm.runInContext(source, context);
  context.bindQuoteForTest();
  time = 2000;
  return { form, button, token, honey, fields, statusEl, fallback, window, requests, events, timers,
    submit: () => form.listeners.submit({ preventDefault() {} }),
    settle: () => new Promise(resolve => setImmediate(resolve)),
    complete: () => complete(), resets: () => resetCount, challengeResets: () => challengeResets
  };
}

test('only an explicit server success confirms and resets the form', async () => {
  const app = setup(); app.submit(); await app.settle();
  assert.equal(app.resets(), 1);
  assert.equal(app.button.disabled, true);
  assert.match(app.statusEl.textContent, /succès/);
  assert.equal(app.requests[0].url, '/api/quote');
  assert.ok(!JSON.stringify(app.events).includes('Entreprise test'));
  const redirect = app.timers.find(t => t.delay === 500); redirect.fn();
  assert.equal(app.window.location.href, 'merci.html?source=quote');
});

for (const data of [{}, null, { success: false }, { success: 'true' }, []]) {
  test(`unconfirmed response ${JSON.stringify(data)} retains inputs`, async () => {
    const app = setup({ data }); app.submit(); await app.settle();
    assert.equal(app.resets(), 0);
    assert.equal(app.button.disabled, false);
    assert.equal(app.fallback.hidden, false);
    assert.match(app.statusEl.textContent, /ne pouvons pas confirmer/);
    assert.equal(app.window.location.href, 'https://www.zepoulayiti.com/');
  });
}

test('invalid JSON is not a successful submission', async () => {
  const app = setup({ malformed: true }); app.submit(); await app.settle(); assert.equal(app.resets(), 0);
});

test('double submit is ignored while pending and after success', async () => {
  const app = setup({ pending: true }); app.submit(); app.submit();
  assert.equal(app.requests.length, 1);
  app.complete(); await app.settle(); app.submit(); assert.equal(app.requests.length, 1);
});

test('network failure offers WhatsApp without automatic navigation', async () => {
  const app = setup({ reject: 'network' }); app.submit(); await app.settle();
  assert.equal(app.window.location.href, 'https://www.zepoulayiti.com/');
  app.fallback.listeners.click();
  assert.match(app.window.location.href, /^https:\/\/wa.me\/50944975668\?text=/);
  assert.match(decodeURIComponent(app.window.location.href), /Entreprise test/);
});

for (const status of [400, 403, 429, 500]) {
  test(`HTTP ${status} cannot be accepted even with success:true`, async () => {
    const app = setup({ status }); app.submit(); await app.settle();
    assert.equal(app.resets(), 0); assert.equal(app.challengeResets(), 1);
    assert.equal(app.button.disabled, false);
  });
}

test('timeout preserves form and reuses submission ID for a retry', async () => {
  const app = setup({ pending: true }); app.submit();
  app.timers.find(t => t.delay === 15000).fn(); await app.settle();
  assert.equal(app.resets(), 0); assert.equal(app.button.disabled, false);
  app.submit(); assert.equal(app.requests.length, 2);
  assert.equal(JSON.parse(app.requests[0].options.body).submissionId, JSON.parse(app.requests[1].options.body).submissionId);
  app.complete(); await app.settle();
});

test('offline, honeypot, missing challenge and invalid fields do not send', () => {
  for (const mode of ['offline', 'honeypot', 'token', 'invalid']) {
    const app = setup();
    if (mode === 'offline') app.window.navigator.onLine = false;
    if (mode === 'honeypot') app.honey.value = 'spam';
    if (mode === 'token') app.token.value = '';
    if (mode === 'invalid') app.form.checkValidity = () => false;
    app.submit(); assert.equal(app.requests.length, 0, mode);
  }
});

test('local previews cannot send real requests', () => {
  const app = setup(); app.window.location.protocol = 'file:'; app.submit();
  assert.equal(app.requests.length, 0); assert.match(app.statusEl.textContent, /aperçu/);
});

test('analytics exception cannot turn a confirmed request into failure', async () => {
  const app = setup({ analyticsError: true }); app.submit(); await app.settle();
  assert.equal(app.resets(), 1); assert.match(app.statusEl.textContent, /succès/);
});
