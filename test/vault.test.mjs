import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptToken, encryptToken, TokenVault } from '../src/vault.js';
import { setLocale } from '../src/i18n.js';
setLocale('zh-Hans');
const password = 'test-only-unlock-password';
const config = { slug: 'sample-site', siteId: '12', username: 'test-account', authorIds: '', token: 'fake-token-for-security-tests' };
function fixture(prompts = {}) {
  let stored;
  const store = { write: async (name, value) => { assert.equal(name, 'config.json'); stored = JSON.parse(JSON.stringify(value)); } };
  const vault = new TokenVault(store, { createPassword: async () => password, unlockPassword: async () => ({ password }), confirmPlaintext: async () => true, confirmRemoval: async () => true, ...prompts });
  return { vault, store, get stored() { return stored; } };
}

test('disk contains ciphertext, never Token or password; a new window requires unlocking', async () => {
  const f = fixture();
  assert.equal(await f.vault.save(config, { encrypted: true }), true);
  const raw = JSON.stringify(f.stored);
  assert.ok(!raw.includes(config.token)); assert.ok(!raw.includes(password));
  assert.equal(f.stored.token, undefined); assert.equal(f.vault.cache.key.extractable, false);
  let prompts = 0;
  const other = new TokenVault(f.store, { unlockPassword: async () => { prompts++; return { password }; } });
  assert.deepEqual(await other.open(f.stored), config);
  assert.deepEqual(await other.open(f.stored), config);
  assert.equal(prompts, 1);
  const firstIv = f.stored.tokenVault.iv;
  await other.save({ ...config, token: 'replacement-fake-token' }, { encrypted: true });
  assert.notEqual(f.stored.tokenVault.iv, firstIv);
  assert.equal((await decryptToken(f.stored.tokenVault, password)).token, 'replacement-fake-token');
});

test('wrong passwords and altered ciphertext fail authentication without plaintext fallback', async () => {
  const { envelope } = await encryptToken(config.token, password);
  await assert.rejects(decryptToken(envelope, 'wrong-password-for-test'));
  const bytes = Buffer.from(envelope.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(decryptToken({ ...envelope, ciphertext: bytes.toString('base64') }, password));
  let prompts = 0;
  const f = fixture({ unlockPassword: async ({ failed }) => { assert.equal(failed, prompts > 0); return ++prompts === 1 ? { password: 'wrong-password-for-test' } : undefined; } });
  assert.equal(await f.vault.open({ ...config, tokenVault: envelope }), undefined);
  assert.equal(f.stored, undefined);
  assert.equal(f.vault.cache, undefined);
});

test('optional encryption can be cancelled without changing the previous plaintext configuration', async () => {
  const f = fixture({ createPassword: async ({ legacy }) => { assert.equal(legacy, true); return undefined; } });
  const loaded = await f.vault.open(config);
  assert.equal(await f.vault.save(loaded, { encrypted: true, previous: config }), false);
  assert.equal(f.stored, undefined);
  f.vault.prompts.createPassword = async () => password;
  assert.equal(await f.vault.save(loaded, { encrypted: true, previous: config }), true);
  assert.equal(f.stored.token, undefined);
  assert.equal((await decryptToken(f.stored.tokenVault, password)).token, config.token);
});

test('forgotten-password reset retains site settings and does not modify disk until save', async () => {
  const f = fixture(); await f.vault.save(config, { encrypted: true });
  const before = JSON.stringify(f.stored);
  const reset = new TokenVault(f.store, { unlockPassword: async ({ allowReset }) => { assert.equal(allowReset, true); return { reset: true }; }, createPassword: async () => password });
  const fresh = await reset.open(f.stored, { allowReset: true });
  assert.equal(fresh.slug, config.slug); assert.equal(fresh.siteId, config.siteId); assert.equal(fresh.token, '');
  assert.equal(JSON.stringify(f.stored), before);
  await reset.save({ ...fresh, token: 'new-fake-token' }, { encrypted: true });
  assert.notEqual(JSON.stringify(f.stored), before);
});

test('unsupported or malformed envelopes cannot bypass encryption or choose costly KDF parameters', async () => {
  const { envelope } = await encryptToken(config.token, password);
  for (const invalid of [{ ...envelope, version: 2 }, { ...envelope, iterations: 2147483647 }, { ...envelope, iv: '' }, { ...envelope, salt: 'invalid' }]) {
    await assert.rejects(decryptToken(invalid, password), /加密记录损坏/);
  }
});

test('failed disk writes do not mark the window cache as successfully saved', async () => {
  const store = { write: async () => { throw new Error('simulated storage failure'); } };
  const vault = new TokenVault(store, { createPassword: async () => password });
  await assert.rejects(vault.save(config, { encrypted: true }), /simulated storage failure/);
  assert.equal(vault.cache, undefined);
});

test('default plaintext storage warns once and never asks for an encryption password', async () => {
  let notices = 0;
  const f = fixture({ confirmPlaintext: async () => { notices++; return true; }, createPassword: async () => { throw new Error('must not prompt'); } });
  assert.equal(await f.vault.save(config), true);
  assert.equal(f.stored.token, config.token); assert.equal(f.stored.tokenVault, undefined);
  const other = new TokenVault(f.store, { confirmPlaintext: async () => { throw new Error('must not warn again'); } });
  const loaded = await other.open(f.stored);
  assert.equal(await other.acknowledgePlaintext(f.stored, loaded), true);
  assert.equal(await other.save(loaded, { previous: f.stored }), true);
  assert.equal(notices, 1);
});

test('cancelling the first plaintext notice preserves the original file and stops the operation', async () => {
  const f = fixture({ confirmPlaintext: async () => false });
  assert.equal(await f.vault.acknowledgePlaintext(config, config), false);
  assert.equal(f.stored, undefined);
});

test('switching an unlocked encrypted Token to plaintext verifies the password and then confirms', async () => {
  const f = fixture(); await f.vault.save(config, { encrypted: true });
  const encrypted = f.stored;
  const calls = [];
  f.vault.prompts.unlockPassword = async options => { calls.push('password'); assert.equal(options.rollback, true); assert.equal(options.allowReset, false); return { password }; };
  f.vault.prompts.confirmPlaintext = async ({ rollback }) => { calls.push('notice'); assert.equal(rollback, true); return true; };
  assert.equal(await f.vault.save(config, { previous: encrypted }), true);
  assert.deepEqual(calls, ['password', 'notice']);
  assert.equal(f.stored.token, config.token); assert.equal(f.stored.tokenVault, undefined);
  assert.equal(f.vault.cache, undefined);
});

test('wrong password or cancelled rollback never replaces the encrypted record with plaintext', async () => {
  for (const cancelAt of ['password', 'notice']) {
    const f = fixture(); await f.vault.save(config, { encrypted: true });
    const original = f.stored; const raw = JSON.stringify(original); let attempts = 0;
    f.vault.prompts.unlockPassword = async () => cancelAt === 'password' ? (++attempts === 1 ? { password: 'wrong-password-for-test' } : undefined) : { password };
    f.vault.prompts.confirmPlaintext = async () => false;
    assert.equal(await f.vault.save(config, { previous: original }), false);
    assert.equal(JSON.stringify(f.stored), raw);
  }
});

test('a password entered when opening settings also authorizes rollback in that same operation', async () => {
  const f = fixture(); await f.vault.save(config, { encrypted: true });
  let unlocks = 0;
  const other = new TokenVault(f.store, { unlockPassword: async () => { unlocks++; return { password }; }, confirmPlaintext: async () => true });
  const loaded = await other.open(f.stored);
  assert.equal(await other.save(loaded, { previous: f.stored, passwordVerified: other.lastOpenUsedPassword }), true);
  assert.equal(unlocks, 1);
});

test('forgotten-password replacement and deletion need no old password and retain metadata', async () => {
  const f = fixture(); await f.vault.save(config, { encrypted: true });
  const old = f.stored;
  const replacement = new TokenVault(f.store, { unlockPassword: async () => ({ reset: true }), confirmPlaintext: async () => true });
  const fresh = await replacement.open(old, { allowReset: true });
  assert.equal(await replacement.save({ ...fresh, token: 'new-fake-token' }, { previous: old }), true);
  assert.equal(f.stored.token, 'new-fake-token'); assert.equal(f.stored.slug, config.slug);
  const deletion = new TokenVault(f.store, { unlockPassword: async () => ({ remove: true }), confirmRemoval: async () => true });
  assert.deepEqual(await deletion.open(old, { allowReset: true }), { removed: true });
  assert.equal(f.stored.token, undefined); assert.equal(f.stored.tokenVault, undefined);
  assert.equal(f.stored.siteId, config.siteId); assert.equal(f.stored.slug, config.slug);
});

test('cancelled Token deletion leaves encrypted storage and its usable window cache intact', async () => {
  const f = fixture({ confirmRemoval: async () => false }); await f.vault.save(config, { encrypted: true });
  const before = JSON.stringify(f.stored);
  assert.equal(await f.vault.remove(f.stored), false);
  assert.equal(JSON.stringify(f.stored), before);
  assert.equal(f.vault.cache.token, config.token);
});

test('plaintext acknowledgement survives encryption, rollback, replacement, and removal', async () => {
  let notices = 0;
  const f = fixture({ confirmPlaintext: async () => { notices++; return true; } });
  await f.vault.save(config);
  const plaintext = f.stored;
  await f.vault.save(config, { encrypted: true, previous: plaintext });
  const encrypted = f.stored;
  let passwords = 0;
  const other = new TokenVault(f.store, {
    unlockPassword: async () => { passwords++; return { password }; },
    confirmPlaintext: async () => { throw new Error('must not repeat acknowledged notice'); },
    confirmRemoval: async () => true,
  });
  await other.open(encrypted);
  await other.save(config, { previous: encrypted });
  assert.equal(passwords, 2); // Rollback still requires password verification.
  assert.equal(notices, 1);
  assert.equal(f.stored.token, config.token);
  await other.remove(f.stored);
  assert.equal(f.stored.plainTextAcknowledged, true);
  await other.save({ ...config, token: 'replacement-test-token' }, { previous: f.stored });
  assert.equal(f.stored.token, 'replacement-test-token');
  assert.equal(notices, 1);
});

test('locked settings edits retain the exact ciphertext without asking for passwords', async () => {
  const f = fixture(); await f.vault.save(config, { encrypted: true });
  const original = f.stored;
  const other = new TokenVault(f.store, { unlockPassword: async () => { throw new Error('unexpected unlock'); }, createPassword: async () => { throw new Error('unexpected password creation'); } });
  const snapshot = other.settings(original);
  assert.equal(snapshot.token, ''); assert.equal(snapshot.tokenLocked, true);
  assert.equal(await other.save({ ...snapshot, authorIds: '42', encryptionPassword: 'must-not-persist' }, { encrypted: true, preserveEncrypted: true, previous: original }), true);
  assert.deepEqual(f.stored.tokenVault, original.tokenVault);
  assert.equal(f.stored.authorIds, '42'); assert.equal(f.stored.encryptionPassword, undefined);
  assert.equal(f.stored.tokenLocked, undefined); assert.equal(f.stored.hasEncryptedToken, undefined);
  await assert.rejects(other.save(snapshot, { preserveEncrypted: true, previous: original }), /请先输入密码/);
  assert.equal((await decryptToken(f.stored.tokenVault, password)).token, config.token);
});

test('an inline password encrypts a replacement with a fresh key and is never persisted', async () => {
  const f = fixture({ createPassword: async () => { throw new Error('no separate password window'); } });
  const firstPassword = 'first-test-only-password';
  await f.vault.save(config, { encrypted: true, password: firstPassword });
  const first = f.stored;
  await f.vault.save({ ...config, token: 'replacement-token-only', encryptionPassword: password }, { encrypted: true, password, previous: first });
  assert.notEqual(f.stored.tokenVault.salt, first.tokenVault.salt);
  assert.equal((await decryptToken(f.stored.tokenVault, password)).token, 'replacement-token-only');
  await assert.rejects(decryptToken(f.stored.tokenVault, firstPassword));
  assert.equal(f.stored.encryptionPassword, undefined);
});
