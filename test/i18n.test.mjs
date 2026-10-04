import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { getLocale, messages, resolveLocale, setLocale, tr } from '../src/i18n.js';
import { configure, confirmPublish, editMetadata, progressPanel } from '../src/ui.js';
import { decodeXmlResponse, splitTags } from '../src/core.js';
import { Client, safeError } from '../src/publisher.js';

test('language preference resolves Chinese scripts and regions and falls back to English', () => {
  for (const [languages, locale] of [[['en-AU'], 'en'], [['zh-Hant'], 'zh-Hant'], [['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-MO'], 'zh-Hant'], [['zh-Hans-TW'], 'zh-Hans'], [['zh-SG'], 'zh-Hans'], [['zh-CN'], 'zh-Hans'], [['ja-JP', 'zh-Hant-HK'], 'zh-Hant'], [['fr-FR'], 'en']]) {
    assert.equal(resolveLocale(languages), locale);
  }
});

test('every application-owned Chinese string has both translations with matching placeholders', async () => {
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const filename of ['core.js', 'publisher.js', 'ui.js', 'main.js', 'vault.js']) {
    const code = await readFile(new URL('../src/' + filename, import.meta.url), 'utf8');
    for (const match of code.matchAll(/'([^'\n]*[\u3400-\u9fff][^'\n]*)'/g)) {
      const key = JSON.parse('"' + match[1].replace(/"/g, '\\"') + '"');
      assert.ok(messages[key], filename + ': missing translation for ' + key);
    }
  }
  for (const [key, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 2);
    for (const translation of translations) {
      assert.ok(translation.trim());
      assert.deepEqual(placeholders(translation), placeholders(key), key);
    }
  }
});

test('localized forms preserve user content, show token instructions, and accept Chinese commas', async () => {
  const dom = new JSDOM(''); globalThis.document = dom.window.document; globalThis.DOMParser = dom.window.DOMParser;
  const roots = [], attach = dom.window.Element.prototype.attachShadow;
  dom.window.Element.prototype.attachShadow = function(options) { const root = attach.call(this, options); roots.push(root); return root; };
  const config = { token: 'test-only-token', username: 'account', slug: 'sample', siteId: '12', authorIds: '' };
  const api = { getAccountUsername: async () => 'account', listSites: async () => [{ id: '12', slug: 'sample', name: 'User Blog' }], listAuthors: async () => [] };
  try {
    for (const [locale, link, newToken, cancel] of [['zh-Hans', 'API 密钥页面', '+ 新密钥', '取消'], ['zh-Hant', 'API 權杖頁面', '+ 新權杖', '取消'], ['en', 'tokens', '+ New token', 'Cancel']]) {
      setLocale(locale);
      const pending = configure(config, api); const root = roots.at(-1);
      assert.equal(root.querySelector('form').lang, getLocale());
      assert.equal(root.querySelector('a').textContent, link);
      assert.ok(root.textContent.includes(newToken));
      assert.equal(root.querySelector('[name=token]').type, 'password');
      assert.equal(root.querySelectorAll('[role=tab]').length, 3);
      assert.equal(root.querySelector('.usage').closest('details'), null);
      const tabs = root.querySelectorAll('[role=tab]'), panes = root.querySelectorAll('[role=tabpanel]');
      tabs[1].click(); assert.equal(panes[0].hidden, true); assert.equal(panes[1].hidden, false);
      tabs[1].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      assert.equal(tabs[0].getAttribute('aria-selected'), 'true'); assert.equal(panes[0].hidden, false);
      assert.equal(panes[1].hidden, true);
      [...root.querySelectorAll('button')].find(b => b.textContent === cancel).click();
      assert.equal(await pending, undefined);

      const metadata = editMetadata({ title: '使用者的标题', tags: ['Writing'] }); const form = roots.at(-1);
      form.querySelector('[name=tags]').value = 'Writing，读书, Writing， 生活';
      form.querySelector('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
      const value = await metadata;
      assert.equal(value.title, '使用者的标题');
      assert.deepEqual(value.tags, ['Writing', '读书', '生活']);
      const confirmation = confirmPublish(value, 2, config, ['Author (@author)'], '99'); const review = roots.at(-1);
      assert.equal(review.querySelectorAll('.review dt').length, 5);
      assert.ok(review.textContent.includes('99'));
      assert.ok(!review.textContent.includes('{id}'));
      review.querySelector('button[type=button]').click(); await confirmation;
      const progress = progressPanel(); assert.ok(roots.at(-1).querySelector('.spinner')); progress.remove();
    }
  } finally { setLocale('en'); dom.window.close(); }
  assert.deepEqual(splitTags('a，b,a\nc'), ['a', 'b', 'c']);
});

test('localized XML faults preserve safe retry classification and credentials stay masked', async () => {
  const dom = new JSDOM(''); globalThis.DOMParser = dom.window.DOMParser;
  const fault = '<methodResponse><fault><value><struct><member><name>faultCode</name><value><int>401</int></value></member><member><name>faultString</name><value><string>Denied</string></value></member></struct></value></fault></methodResponse>';
  const config = { slug: 'sample', siteId: '12', username: 'account', token: 'test-secret' };
  try {
    for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
      setLocale(locale);
      assert.throws(() => decodeXmlResponse(fault), error => error.rpcFault === true && !error.message.includes('{code}'));
      await assert.rejects(new Client(config, async () => new Response(fault)).createDraft('Title', 'Body', []), error => error.safeToRetry === true);
      assert.ok(!safeError(new Error('test-secret'), config).includes('test-secret'));
      const client = new Client(config, async () => new Response('{"status":"published"}'));
      await assert.rejects(client.assertDraft('99'), error => error.message.includes('99') && !error.message.includes('{id}'));
    }
  } finally { setLocale('en'); dom.window.close(); }
});
