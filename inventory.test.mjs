import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./site.js', import.meta.url), 'utf8')
  .replace(/\}\)\(\);\s*$/, 'globalThis.bindInventoryForTest = bindInventoryPanel; })();');

function setup({ data, preparation = false, local = false, status = 200, malformed = false, unavailable = false } = {}) {
  const fields = Object.fromEntries(['cartons', 'status', 'message', 'updated'].map(key => [key, {
    textContent: '', setAttribute() {}
  }]));
  const panel = {
    hidden: true,
    getAttribute: () => preparation ? 'preparation' : 'active',
    querySelector: selector => fields[selector.slice('[data-inventory-'.length, -1)]
  };
  let requests = 0;
  let cleared = false;
  const window = {
    location: { protocol: 'https:', hostname: local ? 'localhost' : 'www.zepoulayiti.com' },
    setTimeout: () => 1,
    clearTimeout: () => { cleared = true; }
  };
  const context = vm.createContext({ window, Date, Intl, AbortController,
    document: { addEventListener() {}, querySelector: () => panel },
    fetch: async () => {
      requests++;
      if (unavailable) throw new Error('unavailable');
      return { ok: status === 200, json: async () => {
        if (malformed) throw new Error('malformed');
        return data;
      } };
    }
  });
  vm.runInContext(source, context);
  context.bindInventoryForTest();
  return { panel, fields, requests: () => requests, cleared: () => cleared,
    settle: () => new Promise(resolve => setImmediate(resolve)) };
}

const valid = () => ({ published: true, cartons: 12, updatedAt: new Date().toISOString() });
for (const mode of [{ preparation: true }, { local: true }]) {
  test('stock stays hidden without a request in ' + Object.keys(mode)[0] + ' mode', async () => {
    const app = setup({ ...mode, data: valid() });
    await app.settle();
    assert.equal(app.requests(), 0);
    assert.equal(app.panel.hidden, true);
  });
}
for (const [name, change] of [
  ['unpublished', { published: false }],
  ['missing publication flag', { published: undefined }],
  ['missing timestamp', { updatedAt: undefined }],
  ['invalid timestamp', { updatedAt: 'not-a-date' }],
  ['stale timestamp', { updatedAt: new Date(Date.now() - 73 * 3600000).toISOString() }],
  ['future timestamp', { updatedAt: new Date(Date.now() + 3600000).toISOString() }],
  ['missing quantity', { cartons: null }],
  ['negative quantity', { cartons: -1 }],
  ['fractional quantity', { cartons: 1.5 }]
]) {
  test('stock remains hidden for ' + name, async () => {
    const app = setup({ data: { ...valid(), ...change } });
    await app.settle();
    assert.equal(app.panel.hidden, true);
    assert.equal(app.cleared(), true);
  });
}
for (const scenario of [{ status: 500 }, { malformed: true }, { unavailable: true }]) {
  test('stock remains hidden on ' + Object.keys(scenario)[0] + ' failure', async () => {
    const app = setup({ ...scenario, data: valid() });
    await app.settle();
    assert.equal(app.panel.hidden, true);
    assert.equal(app.cleared(), true);
  });
}
for (const cartons of [0, 12]) {
  test('only dated published stock is shown: ' + cartons + ' cartons', async () => {
    const data = { ...valid(), cartons };
    const app = setup({ data });
    await app.settle();
    assert.equal(app.panel.hidden, false);
    assert.equal(app.fields.cartons.textContent, String(cartons));
    assert.equal(app.fields.status.textContent, cartons ? 'Disponible' : 'Indisponible');
    assert.equal(app.fields.updated.dateTime, data.updatedAt);
    assert.equal(app.cleared(), true);
  });
}
