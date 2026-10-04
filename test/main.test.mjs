import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const bundle = (await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', write: false })).outputFiles[0].text;
const config = { slug: 'sample-blog', siteId: '12', username: 'test-user', token: 'test-only-never-real', authorIds: '42' };
const tick = () => new Promise(resolve => setImmediate(resolve));

async function scenario({ openAfter, cancel = false, invalid = false, initialFiles, source = '# Title\n\nBody', language = 'zh-CN', siteList } = {}) {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://editor.invalid' });
  const w = dom.window, roots = [], requests = [], opened = [], alerts = [];
  Object.defineProperty(w.navigator, 'languages', { value: [language] });
  const files = initialFiles ?? new Map([['/app/Documents/typlog-publisher/config.json', JSON.stringify(config)]]);
  let menu;
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function(options) { const root = attach.call(this, options); roots.push(root); return root; };
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.AbortController = AbortController;
  w.open = url => { opened.push(url); return null; };
  w.fetch = async function(url, options) {
    assert.equal(this, w);
    requests.push({ url, ...options });
    if (url.endsWith('/user')) return new Response(JSON.stringify({ username: config.username }));
    if (url.endsWith('/sites')) return siteList === false ? new Response('{}', { status: 403 }) : new Response(JSON.stringify(siteList ?? [{ id: 12, slug: config.slug, name: 'Example Site' }]));
    const text = url.endsWith('/authors') ? JSON.stringify(invalid ? [] : [{ id: 42, name: '作者甲', username: 'alice' }])
      : options.body?.includes('metaWeblog.editPost') ? '<methodResponse><params><param><value><boolean>1</boolean></value></param></params></methodResponse>'
      : options.method === 'POST' ? '<methodResponse><params><param><value><string>9876</string></value></param></params></methodResponse>'
      : options.method === 'PATCH' ? '{}' : '{"status":"draft","primary_authors":[{"id":42}]}';
    return new Response(text);
  };
  w.MarkEdit = {
    addMainMenuItem: value => { menu = value; },
    getDirectoryPath: () => '/app/Documents',
    getFileInfo: async path => !path ? { filePath: '/articles/post.md', parentPath: '/articles' } : files.has(path) ? {} : undefined,
    getFileContent: async path => files.get(path),
    createFile: async options => { files.set(options.path, options.string || '{}'); return true; },
    editorAPI: { getText: () => source },
    showAlert: async value => { alerts.push(value); return 0; },
  };
  w.eval(bundle);
  const pending = menu.children[0].action();
  async function findForm(title) {
    for (let n = 0; n < 600; n++) {
      const root = roots.findLast(root => root.host.isConnected && title.includes(root.querySelector('h2')?.textContent));
      if (root) return root;
      const notice = roots.findLast(root => root.host.isConnected && ['Token 将以明文保存在本机', 'Token Will Be Saved as Plain Text', 'Token 將以明文儲存在本機'].includes(root.querySelector('h2')?.textContent));
      if (notice) notice.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
      const protection = roots.findLast(root => root.host.isConnected && root.querySelector('[name=password]'));
      if (protection) {
        protection.querySelector('[name=password]').value = 'test-only-unlock-password';
        const confirmation = protection.querySelector('[name=confirmation]');
        if (confirmation) confirmation.value = 'test-only-unlock-password';
        protection.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Missing form: ' + title);
  }
  const metadata = await findForm(['推送至草稿', '更新已有草稿', 'Send as Draft', 'Update Existing Draft']);
  const metadataText = metadata.textContent;
  const initialOpenAfter = metadata.querySelector('[name=openAfter]').checked;
  assert.equal(initialOpenAfter, JSON.parse(files.get('/app/Documents/typlog-publisher/preferences.json') || '{}').openAfter !== false);
  if (openAfter !== undefined) metadata.querySelector('[name=openAfter]').checked = openAfter;
  let confirmationText;
  if (cancel === 'metadata') metadata.querySelector('button[type=button]').click();
  else {
    metadata.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    if (!invalid) {
      const confirmation = await findForm(['新建草稿？', '更新已有草稿？', '建立草稿？', 'Create Draft?', 'Update Existing Draft?']);
      confirmationText = confirmation.textContent;
      assert.ok(confirmationText.includes('作者甲 (@alice)'));
      if (cancel) confirmation.querySelector('button[type=button]').click();
      else confirmation.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    }
  }
  await pending;
  w.close();
  return { requests, opened, alerts, files, initialOpenAfter, confirmationText, metadataText, menu };
}

test('installed entry point opens the draft directly only when checkbox is selected', async () => {
  for (const openAfter of [true, false]) {
    const result = await scenario({ openAfter });
    assert.deepEqual(result.requests.map(r => r.method), ['GET', 'POST', 'PATCH', 'GET']);
    assert.equal(result.opened.length, openAfter ? 1 : 0);
    if (openAfter) { assert.match(result.opened[0], /9876/); assert.equal(result.alerts.length, 0); }
    else { assert.equal(result.alerts.length, 1); assert.match(result.alerts[0].message, /作者甲/); }
  }
});
test('cancel and invalid author never upload, create a draft, or open the backend', async () => {
  for (const options of [{ cancel: true }, { invalid: true }]) {
    const result = await scenario(options);
    assert.deepEqual(result.requests.map(r => r.method), ['GET']);
    assert.equal(result.opened.length, 0);
    assert.ok(![...result.files.keys()].some(name => name.includes('document-')));
    if (options.invalid) assert.match(result.alerts[0].message, /不在本站作者列表/);
  }
});


test('remembered checkbox survives a new window and changed document updates the associated draft', async () => {
  const first = await scenario({ openAfter: false });
  assert.equal(first.initialOpenAfter, true);
  const second = await scenario({ initialFiles: first.files, source: '# Changed title\n\nEdited body', openAfter: true });
  assert.equal(second.initialOpenAfter, false);
  assert.match(second.confirmationText, /更新原草稿.*不会新建 Post/);
  assert.equal(second.requests.filter(r => r.body?.includes('metaWeblog.newPost')).length, 0);
  const edit = second.requests.find(r => r.body?.includes('metaWeblog.editPost'));
  assert.match(edit.body, /Changed title/); assert.match(edit.body, /Edited body/);
  assert.equal(second.opened.length, 1);
  const third = await scenario({ initialFiles: second.files, cancel: 'metadata' });
  assert.equal(third.initialOpenAfter, true);
  assert.equal(third.requests.length, 0);
});

test('checkbox choice is retained even when later author validation fails', async () => {
  const failed = await scenario({ openAfter: false, invalid: true });
  assert.equal(JSON.parse(failed.files.get('/app/Documents/typlog-publisher/preferences.json')).openAfter, false);
  const next = await scenario({ initialFiles: failed.files, cancel: 'metadata' });
  assert.equal(next.initialOpenAfter, false);
  assert.equal(next.requests.length, 0);
});

test('the entry point follows system languages for menus, draft dialogs and native completion alerts', async () => {
  for (const [language, menuTitle, checkbox, completion] of [
    ['en-AU', 'Send as Draft…', 'Open the post editor when finished', 'Typlog Draft Ready'],
    ['zh-TW', '推送為草稿…', '完成後自動開啟文章編輯頁面', 'Typlog 草稿已準備好'],
    ['zh-Hans-CN', '推送为草稿…', '完成后自动打开文章编辑页面', 'Typlog 草稿已准备好'],
  ]) {
    const result = await scenario({ language, openAfter: false });
    assert.equal(result.menu.children[0].title, menuTitle);
    assert.ok(result.metadataText.includes(checkbox));
    assert.equal(result.alerts[0].title, completion);
    assert.ok(result.menu.icon.length > 100);
  }
});

test('opening and saving encrypted settings never prompts for a password or changes ciphertext', async () => {
  const { encryptToken } = await import('../src/vault.js');
  const { envelope } = await encryptToken(config.token, 'test-only-unlock-password');
  const stored = { ...config, tokenVault: envelope, plainTextAcknowledged: true, authorProfiles: { siteId: config.siteId, slug: config.slug, authors: [{ id: '42', name: 'Example Writer', username: 'writer' }] } };
  delete stored.token;
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://editor.invalid' });
  const w = dom.window, roots = [], writes = [], attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function(options) { const root = attach.call(this, options); roots.push(root); return root; };
  Object.defineProperty(w.navigator, 'languages', { value: ['en'] });
  let raw = JSON.stringify(stored), menu;
  w.fetch = async () => { throw new Error('locked settings must not access the network'); };
  w.MarkEdit = {
    addMainMenuItem: value => { menu = value; }, getDirectoryPath: () => '/app/Documents',
    getFileInfo: async () => ({}), getFileContent: async () => raw,
    createFile: async options => { raw = options.string; writes.push(JSON.parse(raw)); return true; },
    showAlert: async () => 0,
  };
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.eval(bundle);
  try {
    for (const authorIds of ['42', '']) {
      const action = menu.children[1].action();
      for (let n = 0; n < 30 && !roots.findLast(r => r.host.isConnected); n++) await tick();
      const root = roots.findLast(r => r.host.isConnected);
      assert.equal(root.querySelector('h2').textContent, 'Typlog Publishing Settings');
      assert.equal(root.querySelector('[name=token]').value, '');
      assert.equal(root.querySelector('[name=token]').disabled, true);
      assert.equal(root.querySelectorAll('.authors input').length, 1);
      root.querySelector('[name=authorIds]').value = authorIds;
      root.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
      await action;
      const saved = JSON.parse(raw);
      assert.equal(saved.authorIds, authorIds); assert.equal(saved.token, undefined);
      assert.deepEqual(saved.tokenVault, envelope); assert.equal(saved.plainTextAcknowledged, true);
    }
    assert.equal(writes.length, 2);
  } finally { w.close(); }
});

test('forgotten-password replacement reaches settings without decrypting or discarding the old record', async () => {
  const { encryptToken } = await import('../src/vault.js');
  const { envelope } = await encryptToken(config.token, 'test-only-unlock-password');
  const stored = { ...config, tokenVault: envelope }; delete stored.token;
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://editor.invalid' });
  const w = dom.window, roots = [], attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function(options) { const root = attach.call(this, options); roots.push(root); return root; };
  Object.defineProperty(w.navigator, 'languages', { value: ['en'] });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  let menu, writes = 0;
  w.fetch = async () => { throw new Error('no requests before a replacement is supplied'); };
  w.MarkEdit = { addMainMenuItem: value => { menu = value; }, getDirectoryPath: () => '/app/Documents', getFileInfo: async () => ({}), getFileContent: async () => JSON.stringify(stored), createFile: async () => { writes++; return true; }, showAlert: async () => { throw new Error('unexpected alert'); } };
  w.eval(bundle);
  const current = () => roots.findLast(r => r.host.isConnected);
  const button = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent === text);
  try {
    const action = menu.children[0].action();
    for (let n = 0; n < 30 && !current(); n++) await tick();
    assert.equal(current().querySelector('h2').textContent, 'Enter the Local Encryption Password');
    assert.equal(button(current(), 'Replace Token…'), undefined);
    current().querySelector('a[href="#typlog-settings"]').click();
    for (let n = 0; n < 30 && current()?.querySelector('h2').textContent !== 'Typlog Publishing Settings'; n++) await tick();
    assert.equal(current().querySelector('h2').textContent, 'Typlog Publishing Settings');
    assert.equal(current().querySelector('[role=tab][aria-selected=true]').textContent, 'Token Storage');
    assert.equal(current().querySelector('[name=token]').disabled, true);
    assert.equal(current().querySelector('[name=token]').value, '');
    button(current(), 'Cancel').click(); await action;
    assert.equal(writes, 0);
  } finally { w.close(); }
});

test('password unlock refreshes the full site cache while preserving ciphertext and selected site', async () => {
  const { encryptToken } = await import('../src/vault.js');
  const { envelope } = await encryptToken(config.token, 'test-only-unlock-password');
  const initial = { ...config, tokenVault: envelope, siteCache: { username: config.username, sites: [{ id: '12', slug: config.slug, name: 'Old Name' }] } }; delete initial.token;
  const siteList = [{ id: 12, slug: config.slug, name: 'Renamed Site' }, { id: 13, slug: 'second-site', name: 'Second Site', unrelated: 'discard-this' }];
  const first = await scenario({ initialFiles: new Map([['/app/Documents/typlog-publisher/config.json', JSON.stringify(initial)]]), siteList, cancel: 'metadata' });
  const saved = JSON.parse(first.files.get('/app/Documents/typlog-publisher/config.json'));
  assert.deepEqual(saved.tokenVault, envelope); assert.equal(saved.token, undefined);
  assert.equal(saved.siteId, config.siteId); assert.equal(saved.slug, config.slug);
  assert.deepEqual(saved.siteCache.sites, [{ id: '12', slug: config.slug, name: 'Renamed Site' }, { id: '13', slug: 'second-site', name: 'Second Site' }]);
  assert.deepEqual(first.requests.map(r => r.method), ['GET', 'GET']);
  const failed = await scenario({ initialFiles: first.files, siteList: false, cancel: 'metadata' });
  assert.deepEqual(JSON.parse(failed.files.get('/app/Documents/typlog-publisher/config.json')), saved);
  assert.equal(failed.alerts.length, 0);
});
