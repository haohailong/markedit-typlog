import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectImages, decodeXmlResponse, digest, parseDocument, renderDocument, resolveImagePath, validateConfig, xmlCall } from '../src/core.js';
import { authorLabel, Client, prepare, publicationTarget, publishPrepared, safeError, selectedAuthorLabels, Store } from '../src/publisher.js';
import { configure, confirmPublish, editMetadata } from '../src/ui.js';
import { setLocale } from '../src/i18n.js';
setLocale('zh-Hans');

const window = new JSDOM('').window;
globalThis.DOMParser = window.DOMParser;
globalThis.document = window.document;
const config = { slug: 'sample-blog', siteId: '12', username: 'test-user', token: 'test-only-never-real', authorIds: '42' };
const sample = ':::typlog-shortcut\ntitle: 标题 & <测试>\ntag: 写作\ntag: 测试\nformat: markdown\n:::\n\n![照片](images/pic%20one.png "图注 & <文字>")\n\n![第二次](images/pic%20one.png)\n\n**正文**\n\n```markdown\n![代码里的图片](missing.png)\n```';
const response = value => '<?xml version="1.0"?><methodResponse><params><param><value>' + value + '</value></param></params></methodResponse>';
const goodUpload = response('<struct><member><name>url</name><value><string>https://i.typlog.com/pic.png?a=1&amp;b=2</string></value></member></struct>');
const fault = '<methodResponse><fault><value><struct><member><name>faultCode</name><value><int>401</int></value></member><member><name>faultString</name><value><string>denied</string></value></member></struct></value></fault></methodResponse>';

function fixture() {
  const files = new Map();
  const reads = [], requests = [], completed = [];
  const host = {
    getDirectoryPath: type => type === 'home' ? '/Users/test' : '/app/Documents',
    getFileInfo: async path => !path ? { parentPath: '/articles', filePath: '/articles/post.md' } : files.has(path) ? { filePath: path } : undefined,
    getFileObject: async path => { reads.push(path); return path === '/articles/images/pic one.png' ? { mimeType: 'image/png', data: 'aW1hZ2U=' } : undefined; },
    getFileContent: async path => files.get(path),
    createFile: async options => { files.set(options.path, options.string ?? '{}'); return true; },
  };
  const fetcher = async (url, options) => {
    requests.push({ url, ...options });
    let text = '';
    if (options.method === 'GET') text = JSON.stringify({ status: 'draft', primary_authors: JSON.parse(requests.findLast(r => r.method === 'PATCH')?.body ?? '{\"primary_authors\":[42]}').primary_authors.map(id => ({ id })) });
    else if (options.method === 'PATCH') text = '{}';
    else if (options.body.includes('metaWeblog.editPost')) text = response('<boolean>1</boolean>');
    else if (options.body.includes('metaWeblog.newMediaObject')) text = goodUpload;
    else text = response('<string>9876</string>');
    return new Response(text, { status: 200 });
  };
  const ui = { confirm: async () => true, progress: () => {}, recover: async () => undefined, complete: async (...args) => completed.push(args) };
  return { host, files, reads, requests, completed, fetcher, ui, store: new Store(host) };
}

test('full publish reads local reference once, creates an escaped draft, sets authors and resumes after restart', async () => {
  const f = fixture();
  const first = await prepare(f.host, sample);
  assert.equal(first.assets.length, 1);
  assert.deepEqual(f.reads, ['/articles/images/pic one.png']);
  await publishPrepared(first, config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.length, 4);
  const create = f.requests[1];
  const call = new DOMParser().parseFromString(create.body, 'application/xml');
  assert.equal(call.querySelector('parsererror'), null);
  assert.match(create.body, /<name>post_status<\/name><value><string>draft/);
  assert.match(create.body, /<boolean>0<\/boolean>/);
  assert.match(create.body, /标题 &amp; &lt;测试&gt;/);
  const members = [...call.querySelectorAll('params > param > value > struct > member')];
  const html = members.find(x => x.querySelector('name').textContent === 'description').querySelector('string').textContent;
  const published = new DOMParser().parseFromString(html, 'text/html');
  assert.equal(published.querySelectorAll('img').length, 2);
  assert.equal(published.querySelector('img').getAttribute('src'), 'https://i.typlog.com/pic.png?a=1&b=2');
  assert.equal(published.querySelector('figcaption').textContent, '图注 & <文字>');
  assert.equal(published.querySelector('figcaption').children.length, 0);
  assert.deepEqual(JSON.parse(f.requests[2].body), { primary_authors: [42] });
  assert.equal(f.requests[2].headers.Authorization, 'Bearer ' + config.token);
  assert.equal(f.requests[2].headers['X-Site-Id'], '12');
  assert.ok(f.requests.every(x => new URL(x.url).hostname === 'typlog.com' || new URL(x.url).hostname === 'api.typlog.com'));
  assert.ok(f.requests.every(x => x.redirect === 'error' && x.credentials === 'omit'));
  for (const [name, value] of f.files) if (name.includes('document-')) assert.ok(!value.includes(config.token));
  const restarted = new Store(f.host);
  await publishPrepared(await prepare(f.host, sample), config, restarted, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.length, 5, 'repeated identical content only checks draft status');
  assert.equal(f.completed.at(-1)[2], true);
});

test('cancel before upload has no network or journal side effects', async () => {
  const f = fixture(); f.ui.confirm = async () => false;
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.length, 0); assert.equal(f.files.size, 0);
});

test('missing local image aborts preparation instead of publishing a broken local path', async () => {
  const f = fixture();
  await assert.rejects(prepare(f.host, '# Test\n\n![missing](missing.png)'), /无法读取图片/);
  assert.equal(f.requests.length, 0);
});

test('author PATCH failure preserves draft ID; retry only patches authors', async () => {
  const f = fixture();
  const failPatch = async (url, options) => options.method === 'PATCH' ? new Response('{}', { status: 403 }) : f.fetcher(url, options);
  await assert.rejects(publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, failPatch)), /草稿已保存（ID 9876）/);
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(x => x.body?.includes('metaWeblog.newPost')).length, 1);
  assert.equal(f.requests.at(-1).method, 'GET');
});

test('lost creation response is never retried automatically; user can recover by ID', async () => {
  const f = fixture();
  const lost = async (url, options) => {
    if (options.body?.includes('metaWeblog.newPost')) throw new TypeError('connection lost');
    return f.fetcher(url, options);
  };
  await assert.rejects(publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, lost)), /connection lost/);
  const before = f.requests.length;
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.length, before);
  f.ui.recover = async () => ({ postId: '456' });
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(x => x.body?.includes('metaWeblog.newPost')).length, 0);
  assert.match(f.requests.at(-1).url, /posts\/456$/);
});

test('explicit XML fault permits a corrected retry and reuses uploaded image', async () => {
  const f = fixture();
  const failed = async (url, options) => options.body?.includes('metaWeblog.newPost') ? new Response(fault) : f.fetcher(url, options);
  await assert.rejects(publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, failed)), /XML-RPC 错误 401/);
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(x => x.body?.includes('metaWeblog.newMediaObject')).length, 1);
});

test('failure to persist journal stops creation', async () => {
  const f = fixture(); const original = f.host.createFile;
  f.host.createFile = async options => options.path.includes('document-') ? false : original(options);
  const noImages = await prepare(f.host, '# title\n\nbody');
  await assert.rejects(publishPrepared(noImages, config, f.store, f.ui, new Client(config, f.fetcher)), /无法保存/);
  assert.equal(f.requests.length, 0);
});

test('local settings survive Store recreation; corrupt config is reported without its contents', async () => {
  const f = fixture(); await f.store.write('config.json', config);
  assert.deepEqual(await new Store(f.host).read('config.json', null), config);
  f.files.set(f.store.directory + '/config.json', '{broken-private-config');
  await assert.rejects(f.store.read('config.json', null), error => !error.message.includes('private-config'));
});

test('Markdown reference images, HTML widths and captions work; code images are ignored', async () => {
  const f = fixture();
  const doc = renderDocument(parseDocument('# Title\n\n![Alt][photo]\n\n[photo]: images/pic%20one.png "Caption"\n\n<p><img src="images/pic%20one.png" alt="Alt" width="320" height="50%"></p>\n\n`![not-an-image](missing.png)`'));
  const images = await collectImages(doc, f.host, '/articles');
  assert.equal(images.length, 1); assert.equal(images[0].nodes.length, 2);
  assert.equal(doc.querySelectorAll('img')[1].style.width, '320px');
  assert.equal(doc.querySelectorAll('img')[1].style.height, '50%');
  assert.equal(doc.querySelector('figcaption').textContent, 'Caption');
});

test('remote images are preserved and require no local reads or uploads', async () => {
  const f = fixture();
  const doc = renderDocument(parseDocument('![remote](https://example.com/image.png)\n\n![remote2](//example.com/a.jpg)'));
  assert.equal((await collectImages(doc, f.host)).length, 0); assert.equal(f.reads.length, 0);
});

test('data images upload as media, and local srcset is rejected', async () => {
  const f = fixture();
  const doc = renderDocument({ format: 'html', content: '<img src="data:image/png;base64,aGVsbG8=">' });
  const assets = await collectImages(doc, f.host); assert.equal(assets[0].mimeType, 'image/png');
  assert.equal(assets[0].data, 'aGVsbG8=');
  const srcset = renderDocument({ format: 'html', content: '<img src="a.png" srcset="local.png 2x">' });
  await assert.rejects(collectImages(srcset, f.host), /srcset/);
});

test('relative, file URL, encoded Chinese and preview paths resolve correctly', () => {
  assert.equal(resolveImagePath('../图%20片/a.png', '/articles/posts', '/Users/test'), '/articles/图 片/a.png');
  assert.equal(resolveImagePath('file:///tmp/%E4%B8%AD%E6%96%87.png', '/irrelevant', '/Users/test'), '/tmp/中文.png');
  assert.equal(resolveImagePath('image-loader://images/a.png', '/articles', '/Users/test'), '/articles/images/a.png');
  assert.equal(resolveImagePath('~/Pictures/a.png', '/articles', '/Users/test'), '/Users/test/Pictures/a.png');
  assert.throws(() => resolveImagePath('file://remote/a.png'), /远程/);
  assert.throws(() => resolveImagePath('images/a.png', undefined, '/Users/test'), /先保存/);
});

test('TextBundle package roots resolve asset paths within the package', async () => {
  const f = fixture();
  f.host.getFileInfo = async () => ({ isDirectory: true, filePath: '/articles/post.textbundle', parentPath: '/articles' });
  f.host.getFileObject = async path => { f.reads.push(path); return { mimeType: 'image/png', data: 'aW1hZ2U=' }; };
  const prepared = await prepare(f.host, '# Title\n\n![image](assets/pixel.png)');
  assert.equal(prepared.assets.length, 1);
  assert.deepEqual(f.reads, ['/articles/post.textbundle/assets/pixel.png']);
});

test('metadata supports CRLF, repeated tags, empty tags and HTML passthrough', () => {
  const parsed = parseDocument(':::typlog-shortcut\r\ntitle: 标题\r\ntag: 一\r\ntag: 二，一\r\nformat: html\r\n:::\r\n<p>body</p>');
  assert.deepEqual(parsed.tags, ['一', '二']); assert.equal(parsed.format, 'html'); assert.equal(parsed.content, '<p>body</p>');
  assert.equal(parseDocument(':::typlog-shortcut\ntitle: x\ntag:\n:::\nbody').hasTags, true);
  assert.throws(() => parseDocument(':::typlog-shortcut\ntitle: x'), /结束/);
});

test('XML decoder handles typed IDs, nested arrays, faults and malformed responses', () => {
  assert.equal(decodeXmlResponse(response('<int>12</int>')), 12);
  assert.deepEqual(decodeXmlResponse(response('<array><data><value><int>1</int></value><value><string>&lt;安全&gt;</string></value></data></array>')), [1, '<安全>']);
  assert.throws(() => decodeXmlResponse(fault), /denied/);
  assert.throws(() => decodeXmlResponse('<html>oops</html>'), /无效/);
  const call = xmlCall('method', ['user&<>"', { name: 'x&y', bits: { __base64: 'YWJj' } }]);
  assert.equal(new DOMParser().parseFromString(call, 'application/xml').querySelector('parsererror'), null);
  assert.match(call, /<base64>YWJj<\/base64>/);
});

test('credentials are masked in errors and endpoint input cannot redirect the token', () => {
  assert.equal(safeError(new Error(config.token + ' invalid'), config), '[Token 已隐藏] invalid');
  assert.throws(() => validateConfig({ ...config, slug: 'evil.test/x' }), /slug/);
  assert.throws(() => validateConfig({ ...config, siteId: 'abc' }), /Site ID/);
  assert.throws(() => validateConfig({ ...config, authorIds: '0' }), /正整数/);
  assert.throws(() => validateConfig({ ...config, token: 'a\nb' }), /换行/);
});

test('unsafe executable HTML never reaches the published body', () => {
  const doc = renderDocument({ format: 'html', content: '<script>alert(1)</script><p onclick="bad()">text</p><a href="javascript:bad()">link</a><iframe src="https://x.test"></iframe>' });
  assert.equal(doc.querySelector('script, iframe, [onclick], [href]'), null);
});

test('native fetch is invoked with its global Window receiver', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async function(url, options) {
    assert.equal(this, globalThis, 'WebKit requires the Window receiver');
    calls.push({ url, options });
    return new Response(response('<string>123</string>'));
  };
  try {
    assert.equal(await new Client(config).createDraft('Title', '<p>body</p>', []), '123');
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = previous; }
});

test('metadata title precedes H1; missing/empty title falls back to the first real H1', () => {
  const withTitle = parseDocument(':::typlog-shortcut\ntitle: Metadata title\ntags: 一, 二\n:::\n# Heading title\n\nBody');
  assert.equal(withTitle.title, 'Metadata title');
  assert.deepEqual(withTitle.tags, ['一', '二']);
  assert.match(withTitle.content, /^# Heading title/);
  for (const prefix of [':::typlog-shortcut\ntags: 一\n:::\n', ':::typlog-shortcut\ntitle: \ntag: 一\n:::\n', '::: \ntags: 一\n:::\n']) {
    const parsed = parseDocument(prefix + '\n# **真正**的 [标题](https://example.com) ###\n\n正文');
    assert.equal(parsed.title, '真正的 标题');
    assert.deepEqual(parsed.tags, ['一']);
    assert.ok(!parsed.content.includes(':::'));
    assert.ok(!parsed.content.includes('# **真正**'));
  }
  const later = parseDocument('前言\n\n```md\n# Code title\n```\n\n## H2\n\n# First H1\n\n# Second H1');
  assert.equal(later.title, 'First H1');
  assert.match(later.content, /# First H1/);
  assert.equal(parseDocument('Setext title\n===\n\nBody').title, 'Setext title');
  assert.equal(parseDocument('No heading\n\n## H2 only').title, '');
});

test('metadata form prefills the resolved title and tags and permits manual entry without H1', async () => {
  const original = window.Element.prototype.attachShadow;
  let root;
  window.Element.prototype.attachShadow = function(options) { root = original.call(this, options); return root; };
  try {
    const parsed = parseDocument(':::typlog-shortcut\ntags: 写作\n:::\n# 标题\n\n正文');
    const pending = editMetadata(parsed);
    assert.equal(root.querySelector('[name=title]').value, '标题');
    assert.equal(root.querySelector('[name=tags]').value, '写作');
    root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.deepEqual(await pending, { title: '标题', tags: ['写作'], openAfter: true });
    const manual = editMetadata(parseDocument('正文，无标题'));
    assert.equal(root.querySelector('[name=title]').value, '');
    root.querySelector('[name=title]').value = '手工标题';
    root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal((await manual).title, '手工标题');
  } finally { window.Element.prototype.attachShadow = original; }
});

test('Shortcut image title dimensions, captions and empty-alt figures are preserved', () => {
  const source = String.raw`![替代文字](photo.png "实际图注\" width=\"320px\" height=\"auto")

![仅有 alt](photo2.png)

![](photo3.png)`;
  const doc = renderDocument(parseDocument(source));
  assert.equal(doc.querySelectorAll('figure').length, 3);
  const image = doc.querySelector('img');
  assert.equal(image.getAttribute('title'), '实际图注');
  assert.equal(image.style.width, '320px');
  assert.equal(image.style.height, 'auto');
  assert.deepEqual([...doc.querySelectorAll('figcaption')].map(node => node.textContent), ['实际图注', '仅有 alt']);
  assert.equal(doc.querySelectorAll('figure')[2].querySelector('figcaption'), null);
});

test('blank author configuration creates a draft without assigning authors', async () => {
  const f = fixture();
  const noAuthors = { ...config, authorIds: '' };
  await publishPrepared(await prepare(f.host, '# Title\n\nBody'), noAuthors, f.store, f.ui, new Client(noAuthors, f.fetcher));
  assert.equal(f.requests.length, 1);
  assert.ok(f.requests[0].body.includes('metaWeblog.newPost'));
  assert.ok(!f.requests[0].body.includes('author'));
  assert.ok(!f.requests.some(request => request.method === 'PATCH'));
});

const profiles = [{ id: '42', name: '作者甲', username: 'alice' }, { id: '43', name: '', username: 'bob' }];
function captureForm() {
  const original = window.Element.prototype.attachShadow;
  let root;
  window.Element.prototype.attachShadow = function(options) { root = original.call(this, options); return root; };
  return { get root() { return root; }, restore() { window.Element.prototype.attachShadow = original; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('author lookup uses site-scoped GET and only retains ID, name and username', async () => {
  const requests = [];
  const client = new Client(config, async (url, options) => {
    requests.push({ url, ...options });
    return new Response(JSON.stringify(profiles.map(p => ({ ...p, id: Number(p.id), bio: 'omitted', meta: { private: 'omitted' } }))));
  });
  assert.deepEqual(await client.listAuthors(), profiles);
  assert.equal(requests[0].url, 'https://api.typlog.com/v3/authors');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].headers['X-Site-Id'], config.siteId);
  assert.equal(requests[0].headers.Authorization, 'Bearer ' + config.token);
  assert.deepEqual(selectedAuthorLabels('42, 43', profiles), ['作者甲 (@alice)', '@bob']);
  assert.equal(authorLabel({ id: '44', name: '姓名', username: '' }), '姓名');
  assert.throws(() => selectedAuthorLabels('99', profiles), /不在本站作者列表/);
  await assert.rejects(new Client(config, async () => new Response('{}')).listAuthors(), /格式/);
});

const sites = [{ id: '12', slug: 'sample-blog', name: '测试站点' }];
const services = overrides => ({ getAccountUsername: async () => 'test-user', listSites: async () => sites, listAuthors: async () => profiles, confirmReplacement: async () => true, ...overrides });
const clickButton = (root, text) => [...root.querySelectorAll('button')].find(button => button.textContent === text).click();
const submitForm = root => root.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));

test('Token Storage defaults to plaintext, retains encryption choice, and shows restart requirements', async () => {
  const capture = captureForm();
  try {
    for (const encrypted of [false, true]) {
      const pending = configure({ ...config, encryptToken: encrypted }, services());
      const root = capture.root; await tick();
      assert.equal(root.querySelector('[name=encryptToken]').checked, encrypted);
      root.querySelectorAll('[role=tab]')[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      assert.equal(root.querySelector('[name=encryptToken]').closest('[role=tabpanel]').hidden, false);
      assert.ok(root.textContent.includes('Token 默认以明文保存在本机'));
      assert.ok(root.textContent.includes('与 Typlog 登录密码无关'));
      const choice = root.querySelector('[name=encryptToken]'); choice.checked = !encrypted; choice.dispatchEvent(new window.Event('change'));
      root.querySelector('[name=encryptionPassword]').value = root.querySelector('[name=encryptionConfirmation]').value = 'test-only-local-password';
      submitForm(root); assert.equal((await pending).encryptToken, !encrypted);
    }
  } finally { capture.restore(); }
});

test('Token replacement edits only the form and deletion can be cancelled before closing it', async () => {
  const capture = captureForm(); let remove = false, calls = 0;
  try {
    const pending = configure(config, services({ removeToken: async () => { calls++; return remove; } }));
    const root = capture.root; await tick();
    clickButton(root, 'Token 保存');
    clickButton(root, '替换 Token…'); await tick();
    assert.equal(root.querySelector('[name=token]').value, '');
    assert.equal(config.token, 'test-only-never-real');
    clickButton(root, '删除本机 Token…'); await tick();
    assert.equal(root.host.isConnected, true);
    remove = true; clickButton(root, '删除本机 Token…');
    assert.deepEqual(await pending, { removed: true }); assert.equal(calls, 2);
  } finally { capture.restore(); }
});

test('token alone resolves account and unique blog; author picker explains choices and supports multiple', async () => {
  const capture = captureForm(); const seen = [];
  try {
    const pending = configure({}, services({ listAuthors: async input => { seen.push(input); return profiles; } }));
    const root = capture.root;
    root.querySelector('[name=token]').value = config.token;
    clickButton(root, '读取账号与站点'); await tick();
    assert.equal(seen[0].siteId, '12');
    assert.equal(seen[0].username, 'test-user');
    assert.equal(root.querySelector('select').value, '12');
    assert.ok(root.querySelector('.author-labels').textContent.includes('不设作者'));
    assert.equal(root.querySelector('a').href, 'https://typlog.com/account/tokens');
    assert.equal(root.querySelector('[name=token]').type, 'password');
    assert.equal(root.querySelectorAll('[role=tab]').length, 3);
    assert.equal(root.querySelector('[name=username]').closest('[role=tabpanel]').hidden, true);
    assert.equal(root.querySelectorAll('.authors input').length, 2);
    assert.equal(root.querySelector('.authors').hidden, false);
    clickButton(root, '刷新作者'); await tick();
    const choices = [...root.querySelectorAll('.authors input')];
    for (const check of choices) { check.checked = true; check.dispatchEvent(new window.Event('change')); }
    assert.equal(root.querySelector('[name=authorIds]').value, '42, 43');
    assert.ok(root.textContent.includes('作者甲 (@alice)')); assert.ok(root.textContent.includes('@bob'));
    submitForm(root);
    assert.deepEqual(await pending, { ...config, authorIds: '42, 43', encryptToken: false, authorProfiles: { siteId: '12', slug: config.slug, authors: profiles }, siteCache: { username: config.username, sites } });
  } finally { capture.restore(); }
});

test('visible authors support multi-selection and exclusive No author state', async () => {
  const capture = captureForm();
  try {
    const pending = configure(config, services()); const root = capture.root; await tick();
    const choices = [...root.querySelectorAll('.authors input')];
    const none = [...root.querySelectorAll('.check input')].find(input => input.parentElement.textContent === '不设作者');
    const change = (input, checked) => { input.checked = checked; input.dispatchEvent(new window.Event('change')); };
    assert.equal(root.querySelector('.authors').hidden, false);
    assert.deepEqual(choices.map(input => input.checked), [true, false]);
    assert.equal(none.checked, false);
    change(choices[1], true);
    assert.equal(root.querySelector('[name=authorIds]').value, '42, 43');
    change(none, true);
    assert.equal(root.querySelector('[name=authorIds]').value, '');
    assert.ok(choices.every(input => input.disabled));
    assert.deepEqual(choices.map(input => input.checked), [true, true]);
    change(none, false);
    assert.ok(choices.every(input => !input.disabled));
    assert.equal(root.querySelector('[name=authorIds]').value, '42, 43');
    change(choices[0], false); change(choices[1], false);
    assert.equal(none.checked, false);
    const manual = root.querySelector('[name=authorIds]'); manual.value = '42, 43'; manual.dispatchEvent(new window.Event('input'));
    assert.equal(none.checked, false);
    assert.deepEqual(choices.map(input => input.checked), [true, true]);
    clickButton(root, '刷新作者'); await tick();
    assert.equal(root.querySelector('.authors').hidden, false);
    assert.deepEqual([...root.querySelectorAll('.authors input')].map(input => input.checked), [true, true]);
    submitForm(root); assert.equal((await pending).authorIds, '42, 43');
  } finally { capture.restore(); }
});

test('single author autofills but explicit none survives refresh, save and reopen', async () => {
  const capture = captureForm();
  const single = services({ listAuthors: async () => profiles.slice(0, 1) });
  try {
    const pending = configure({ token: config.token }, single); const root = capture.root; await tick();
    assert.equal(root.querySelector('[name=authorIds]').value, '42');
    const none = [...root.querySelectorAll('.check input')].find(input => input.parentElement.textContent === '不设作者');
    none.checked = true; none.dispatchEvent(new window.Event('change'));
    assert.equal(root.querySelector('[name=authorIds]').value, '');
    clickButton(root, '刷新作者'); await tick();
    assert.equal(root.querySelector('[name=authorIds]').value, '');
    submitForm(root); const saved = await pending;
    const reopened = configure(saved, single); await tick();
    assert.equal(capture.root.querySelector('[name=authorIds]').value, '');
    clickButton(capture.root, '取消'); await reopened;
  } finally { capture.restore(); }
});

test('multiple sites require selection and changing blogs loads authors in the chosen scope', async () => {
  const capture = captureForm(); const seen = [];
  const many = [...sites, { id: '13', slug: 'second-blog', name: '第二站点' }];
  try {
    const pending = configure({ token: config.token }, services({ listSites: async () => many, listAuthors: async input => { seen.push(input.siteId); return input.siteId === '13' ? profiles.slice(1) : profiles.slice(0, 1); } }));
    const root = capture.root; await tick();
    assert.equal(root.querySelector('select').value, ''); assert.deepEqual(seen, []);
    submitForm(root); assert.match(root.querySelector('.error').textContent, /slug/);
    const picker = root.querySelector('select'); picker.value = '12'; picker.dispatchEvent(new window.Event('change')); await tick();
    assert.equal(root.querySelector('[name=authorIds]').value, '42');
    picker.value = '13'; picker.dispatchEvent(new window.Event('change')); await tick();
    assert.deepEqual(seen, ['12', '13']);
    assert.equal(root.querySelector('[name=authorIds]').value, '43');
    submitForm(root); assert.deepEqual(await pending, { ...config, siteId: '13', slug: 'second-blog', authorIds: '43', encryptToken: false, authorProfiles: { siteId: '13', slug: 'second-blog', authors: profiles.slice(1) }, siteCache: { username: config.username, sites: many } });
  } finally { capture.restore(); }
});

test('stale account and author results cannot populate changed token or manual site', async () => {
  const capture = captureForm(); let release;
  try {
    let pending = configure({}, services({ getAccountUsername: () => new Promise(resolve => { release = resolve; }) }));
    let root = capture.root; root.querySelector('[name=token]').value = config.token; clickButton(root, '读取账号与站点');
    root.querySelector('[name=token]').value = 'changed-token'; root.querySelector('[name=token]').dispatchEvent(new window.Event('input'));
    release('old-user'); await tick();
    assert.equal(root.querySelector('[name=username]').value, ''); assert.equal(root.querySelectorAll('select option').length, 1);
    clickButton(root, '取消'); await pending;
    pending = configure(config, services({ listAuthors: () => new Promise(resolve => { release = resolve; }) }));
    root = capture.root; await tick();
    root.querySelector('[name=siteId]').value = '999'; root.querySelector('[name=siteId]').dispatchEvent(new window.Event('input'));
    release(profiles); await tick();
    assert.equal(root.querySelectorAll('.authors input').length, 0);
    clickButton(root, '取消'); await pending;
  } finally { capture.restore(); }
});

test('discovery failures hide token, preserve existing configuration, and allow manual fallback', async () => {
  const capture = captureForm();
  try {
    const pending = configure(config, services({ getAccountUsername: async () => { throw new Error('invalid ' + config.token); } }));
    const root = capture.root; await tick();
    assert.equal(root.querySelector('[name=authorIds]').value, '42');
    assert.ok(!root.querySelector('.error').textContent.includes(config.token));
    submitForm(root); assert.deepEqual(await pending, { ...config, encryptToken: false, authorProfiles: { siteId: '12', slug: config.slug, authors: profiles }, siteCache: { username: config.username, sites } });
    const manual = configure({}, services()); const other = capture.root;
    for (const [name, value] of [['token', config.token], ...Object.entries(config).filter(([name]) => name !== 'token')]) { other.querySelector('[name=' + name + ']').value = value; other.querySelector('[name=' + name + ']').dispatchEvent(new window.Event('input')); }
    submitForm(other); assert.equal(other.querySelector('.error').textContent, ''); assert.deepEqual(await manual, { ...config, encryptToken: false });
  } finally { capture.restore(); }
});

test('publish dialogs show the checkbox immediately, restore preference, and clearly confirm updates', async () => {
  const capture = captureForm();
  try {
    for (const openAfter of [true, false]) {
      const pending = editMetadata(parseDocument('# Title'), { openAfter, postId: '9876' });
      const root = capture.root;
      assert.equal(root.querySelector('[name=openAfter]').checked, openAfter);
      assert.ok(root.textContent.includes('完成后自动打开文章编辑页面'));
      assert.ok(root.textContent.includes('更新草稿（ID 9876）'));
      submitForm(root); assert.equal((await pending).openAfter, openAfter);
    }
    const confirm = confirmPublish(parseDocument('# Title'), 2, config, ['作者甲 (@alice)'], '9876');
    assert.match(capture.root.textContent, /更新原草稿.*不会新建 Post/);
    assert.match(capture.root.textContent, /作者甲/);
    clickButton(capture.root, '取消'); assert.equal(await confirm, undefined);
  } finally { capture.restore(); }
});

test('changing authors resumes the same draft and verification rejects a mismatched backend result', async () => {
  const f = fixture();
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  const changed = { ...config, authorIds: '43' };
  await publishPrepared(await prepare(f.host, sample), changed, f.store, f.ui, new Client(changed, f.fetcher));
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newPost')).length, 1);
  assert.deepEqual(JSON.parse(f.requests.findLast(r => r.method === 'PATCH').body), { primary_authors: [43] });
  await assert.rejects(new Client(config, async (_, options) => new Response(options.method === 'GET' ? '{"primary_authors":[]}' : '{}')).setAuthors('9876'), /不一致/);
  await assert.rejects(new Client(config, async () => new Response('{"errors":["Invalid author profile"]}', { status: 400 })).setAuthors('9876'), /所选作者不属于此站点/);
});

test('v0.1.1 completed journal migrates without creating a new post and remains reusable after author change', async () => {
  const f = fixture();
  const prepared = await prepare(f.host, sample);
  const key = await digest(JSON.stringify([config.slug, config.siteId, config.authorIds, prepared.filePath, prepared.parsed, prepared.assets.map(a => a.hash)]));
  await f.store.write('push-' + key + '.json', { stage: 'complete', uploads: {}, postId: '1234' });
  await publishPrepared(prepared, config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.length, 1);
  assert.equal(f.completed[0][0], '1234');
  const changed = { ...config, authorIds: '43' };
  await publishPrepared(await prepare(f.host, sample), changed, f.store, f.ui, new Client(changed, f.fetcher));
  assert.deepEqual(f.requests.map(r => r.method), ['GET', 'GET', 'PATCH', 'GET']);
  assert.ok(f.requests.every(r => r.url.endsWith('/1234')));
});

test('account discovery uses token-only GETs and discards unrelated account/site fields', async () => {
  const requests = [];
  const client = new Client({ token: config.token }, async (url, options) => {
    requests.push({ url, ...options });
    return new Response(JSON.stringify(url.endsWith('/user') ? { username: 'test-user', email: 'not-retained@example.test' } : [{ ...sites[0], settings: { private: 'not-retained' } }]));
  });
  assert.equal(await client.getAccountUsername(), 'test-user');
  assert.deepEqual(await client.listSites(), sites);
  assert.deepEqual(requests.map(request => request.url), ['https://api.typlog.com/v3/user', 'https://api.typlog.com/v3/sites']);
  assert.ok(requests.every(request => request.method === 'GET' && !('X-Site-Id' in request.headers) && request.headers.Authorization === 'Bearer ' + config.token));
  await assert.rejects(new Client({ token: config.token }, async () => new Response('[{"id":12,"slug":"evil.example/path"}]')).listSites(), /无效/);
});

test('profile permission failure still lists blogs and authors, and allows manually entering only username', async () => {
  const capture = captureForm();
  try {
    const pending = configure({ token: config.token }, services({ getAccountUsername: async () => { throw new Error('HTTP 401'); }, listAuthors: async () => profiles.slice(0, 1) }));
    const root = capture.root; await tick();
    assert.equal(root.querySelector('select').value, '12');
    assert.equal(root.querySelector('[name=username]').value, '');
    assert.equal(root.querySelector('[name=authorIds]').value, '42');
    assert.match(root.querySelector('.error').textContent, /profile/);
    const username = root.querySelector('[name=username]'); username.value = config.username; username.dispatchEvent(new window.Event('input'));
    submitForm(root); assert.deepEqual(await pending, { ...config, encryptToken: false, authorProfiles: { siteId: '12', slug: config.slug, authors: profiles.slice(0, 1) }, siteCache: { username: config.username, sites } });
  } finally { capture.restore(); }
});

test('changed title, tags, body and image update one document post with cached uploads', async () => {
  const f = fixture();
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  const changed = sample.replace('标题 & <测试>', '新标题').replace('tag: 写作', 'tag: 新标签').replace('**正文**', '**新的正文**');
  const target = await publicationTarget(await prepare(f.host, changed), config, f.store);
  assert.equal(target.record.postId, '9876');
  await publishPrepared(await prepare(f.host, changed), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newPost')).length, 1);
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newMediaObject')).length, 1);
  const edit = f.requests.find(r => r.body?.includes('metaWeblog.editPost'));
  const call = new DOMParser().parseFromString(edit.body, 'application/xml');
  assert.equal(call.querySelectorAll('params > param').length, 5);
  assert.equal(call.querySelector('param string').textContent, '9876');
  assert.match(edit.body, /新标题/); assert.match(edit.body, /新标签/); assert.match(edit.body, /新的正文/);
  assert.match(edit.body, /<boolean>0<\/boolean>/);
  f.host.getFileObject = async () => ({ mimeType: 'image/png', data: 'bmV3LWltYWdl' });
  await publishPrepared(await prepare(f.host, changed), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newMediaObject')).length, 2);
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.editPost')).length, 2);
});

test('published or unknown-state associated posts are never overwritten or silently replaced', async () => {
  for (const status of ['published', undefined]) {
    const f = fixture();
    await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
    const requests = [];
    const published = async (url, options) => { requests.push({ url, ...options }); return new Response(JSON.stringify({ status })); };
    await assert.rejects(publishPrepared(await prepare(f.host, sample + '\nNew body'), config, f.store, f.ui, new Client(config, published)), /本次未更新，也未新建/);
    assert.deepEqual(requests.map(r => r.method), ['GET']);
  }
});

test('a lost update response retries the same post ID and never starts a new creation', async () => {
  const f = fixture();
  await publishPrepared(await prepare(f.host, sample), config, f.store, f.ui, new Client(config, f.fetcher));
  const changed = sample + '\nUpdated body';
  const lost = async (url, options) => {
    if (options.body?.includes('metaWeblog.editPost')) throw new TypeError('lost update response');
    return f.fetcher(url, options);
  };
  await assert.rejects(publishPrepared(await prepare(f.host, changed), config, f.store, f.ui, new Client(config, lost)), /lost update response/);
  const association = await publicationTarget(await prepare(f.host, changed), config, f.store);
  assert.equal(association.record.postId, '9876'); assert.equal(association.record.stage, 'updating');
  await publishPrepared(await prepare(f.host, changed), config, f.store, f.ui, new Client(config, f.fetcher));
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newPost')).length, 1);
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newMediaObject')).length, 1);
});

test('manual legacy association updates a supplied draft instead of creating a new one', async () => {
  const f = fixture(); const prepared = await prepare(f.host, '# Title\n\nChanged before upgrade');
  const target = await publicationTarget(prepared, config, f.store);
  target.record.postId = '1234'; target.record.stage = 'created';
  await publishPrepared(prepared, config, f.store, f.ui, new Client(config, f.fetcher), target);
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.newPost')).length, 0);
  assert.equal(f.requests.filter(r => r.body?.includes('metaWeblog.editPost')).length, 1);
  assert.equal((await publicationTarget(prepared, config, f.store)).record.postId, '1234');
});

test('inline encryption validates passwords and locked settings preserve the encrypted Token', async () => {
  const capture = captureForm();
  try {
    let pending = configure(config, services()); let root = capture.root; await tick();
    clickButton(root, 'Token 保存');
    const choice = root.querySelector('[name=encryptToken]'); choice.checked = true; choice.dispatchEvent(new window.Event('change'));
    assert.equal(root.querySelector('.password-fields').hidden, false);
    submitForm(root); assert.match(root.querySelector('.error').textContent, /至少需要 12/);
    root.querySelector('[name=encryptionPassword]').value = 'test-local-password';
    root.querySelector('[name=encryptionConfirmation]').value = 'different-password';
    submitForm(root); assert.match(root.querySelector('.error').textContent, /不一致/);
    root.querySelector('[name=encryptionConfirmation]').value = 'test-local-password';
    submitForm(root); assert.equal((await pending).encryptionPassword, 'test-local-password');
    let rollbacks = 0;
    pending = configure({ ...config, token: '', tokenLocked: true, hasEncryptedToken: true, encryptToken: true, authorProfiles: { siteId: config.siteId, slug: config.slug, authors: profiles } }, services({ getAccountUsername: async () => { throw new Error('locked settings must not fetch'); }, rollbackToken: async () => { rollbacks++; return undefined; } }));
    root = capture.root; await tick(); clickButton(root, 'Token 保存');
    assert.equal(root.querySelector('[name=token]').disabled, true);
    assert.equal(root.querySelector('.password-fields').hidden, true);
    assert.equal(root.querySelector('.authors').hidden, false);
    clickButton(root, '改回明文保存…'); await tick(); assert.equal(rollbacks, 1);
    assert.equal(root.querySelector('[name=token]').disabled, true);
    assert.equal(root.querySelector('[name=encryptToken]').checked, true);
    root.querySelector('[name=authorIds]').value = '43';
    submitForm(root); const saved = await pending;
    assert.equal(saved.preserveToken, true); assert.equal(saved.token, ''); assert.equal(saved.authorIds, '43');
  } finally { capture.restore(); }
});

test('cancelled replacement leaves the old Token and encryption choice untouched', async () => {
  const capture = captureForm();
  try {
    const pending = configure({ ...config, hasEncryptedToken: true, encryptToken: true }, services({ confirmReplacement: async () => false }));
    const root = capture.root; await tick(); clickButton(root, 'Token 保存');
    clickButton(root, '替换 Token…'); await tick();
    assert.equal(root.querySelector('[name=token]').value, config.token);
    assert.equal(root.querySelector('[name=encryptToken]').checked, true);
    clickButton(root, '取消'); await pending;
  } finally { capture.restore(); }
});

test('saved account cache restores all sites before network access and supports a locked site change', async () => {
  const capture = captureForm(); const many = [...sites, { id: '13', slug: 'second-blog', name: 'Second Site' }];
  const siteCache = { username: config.username, sites: many };
  try {
    const pending = configure({ ...config, token: '', tokenLocked: true, hasEncryptedToken: true, encryptToken: true, siteCache, authorProfiles: { siteId: config.siteId, slug: config.slug, authors: profiles } }, services({ listSites: async () => { throw new Error('must use cache'); }, listAuthors: async () => { throw new Error('locked site selection must not fetch'); } }));
    const root = capture.root; await tick(); const picker = root.querySelector('select');
    assert.deepEqual([...picker.options].slice(1).map(o => o.textContent), ['测试站点 (sample-blog)', 'Second Site (second-blog)']);
    assert.equal(picker.value, config.siteId);
    picker.value = '13'; picker.dispatchEvent(new window.Event('change')); await tick();
    assert.equal(root.querySelector('[name=siteId]').value, '13');
    assert.equal(root.querySelector('[name=slug]').value, 'second-blog');
    assert.equal(root.querySelector('.error').textContent, '');
    submitForm(root); const saved = await pending;
    assert.equal(saved.preserveToken, true); assert.deepEqual(saved.siteCache, siteCache);
  } finally { capture.restore(); }
});

test('multiple authors default to the first and No author disables rather than changes the list', async () => {
  const capture = captureForm();
  try {
    const pending = configure({ token: config.token }, services()); const root = capture.root; await tick();
    const choices = [...root.querySelectorAll('.authors input')];
    assert.deepEqual(choices.map(c => c.checked), [true, false]);
    const none = root.querySelector('.author-labels input');
    none.checked = true; none.dispatchEvent(new window.Event('change'));
    assert.equal(root.querySelector('[name=authorIds]').value, '');
    assert.ok(choices.every(c => c.disabled));
    none.checked = false; none.dispatchEvent(new window.Event('change'));
    assert.ok(choices.every(c => !c.disabled)); assert.deepEqual(choices.map(c => c.checked), [true, false]);
    clickButton(root, '取消'); await pending;
  } finally { capture.restore(); }
});
