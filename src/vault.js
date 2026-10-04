import { tr } from './i18n.js';

const iterations = 600000;
const encoder = new TextEncoder();
const context = encoder.encode('markedit-typlog/token/v1');
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error(tr('此环境不支持安全加密，Token 未保存。请更新 MarkEdit 和 macOS。'));
}

function readEnvelope(envelope) {
  try {
    if (envelope?.version !== 1 || envelope.iterations !== iterations || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 16384) throw new Error();
    const salt = decode(envelope.salt), iv = decode(envelope.iv), ciphertext = decode(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error();
    return { salt, iv, ciphertext };
  } catch { throw new Error(tr('加密记录损坏或版本不受支持，请从「修改发布配置」重新配置。')); }
}

async function derive(password, salt) {
  requireCrypto();
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token, password) {
  requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  return { envelope: await seal(token, key, salt), key };
}

async function seal(token, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context, tagLength: 128 }, key, encoder.encode(token));
  return { version: 1, iterations, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) };
}

export async function decryptToken(envelope, password) {
  const { salt, iv, ciphertext } = readEnvelope(envelope);
  const key = await derive(password, salt);
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: context, tagLength: 128 }, key, ciphertext);
  return { token: new TextDecoder('utf-8', { fatal: true }).decode(bytes), key };
}

// Keys and decrypted Tokens remain in this window's memory, never in settings.
export class TokenVault {
  constructor(store, prompts) { this.store = store; this.prompts = prompts; this.cache = undefined; }
  settings(stored = {}) {
    const { tokenVault, token, ...metadata } = stored;
    if (!tokenVault) return { ...metadata, token: token ?? '' };
    const cached = this.cache?.signature === JSON.stringify(tokenVault) ? this.cache.token : '';
    return { ...metadata, token: cached, tokenLocked: !cached, hasEncryptedToken: true };
  }
  async open(stored, { allowReset = false, forceUnlock = false } = {}) {
    this.lastOpenUsedPassword = false;
    if (!stored) return stored;
    const { tokenVault, token: legacy, ...metadata } = stored;
    if (!tokenVault) { this.legacy = Boolean(legacy); return { ...metadata, token: legacy ?? '' }; }
    const signature = JSON.stringify(tokenVault);
    if (!forceUnlock && this.cache?.signature === signature) return { ...metadata, token: this.cache.token };
    let failed = false;
    while (true) {
      const input = await this.prompts.unlockPassword({ allowReset, failed, rollback: forceUnlock });
      if (!input) return undefined;
      if (input.settings) return { settings: true };
      if (input.remove && allowReset) {
        if (await this.remove(stored)) return { removed: true };
        continue;
      }
      if (input.reset && allowReset) { this.cache = undefined; return { ...metadata, token: '', reset: true }; }
      try {
        const { token, key } = await decryptToken(tokenVault, input.password);
        this.cache = { signature, token, key, salt: decode(tokenVault.salt) };
        this.lastOpenUsedPassword = true;
        return { ...metadata, token };
      } catch (error) {
        // No automatic plaintext fallback, and no password/error details displayed.
        if (!globalThis.crypto?.subtle) throw error;
        failed = true;
      }
    }
  }
  async save(config, { encrypted = false, previous = {}, passwordVerified = false, password: suppliedPassword, preserveEncrypted = false } = {}) {
    const { token, tokenVault: ignored, encryptToken: ignoredChoice, encryptionPassword, tokenLocked, hasEncryptedToken, hasStoredToken, preserveToken, reset, authorProfiles, ...metadata } = config;
    if (preserveEncrypted) {
      if (!previous.tokenVault || !encrypted) throw new Error(tr('请先输入密码，才能将已有 Token 改为明文保存。'));
      await this.store.write('config.json', { ...metadata, ...(authorProfiles ? { authorProfiles } : {}), ...(previous.plainTextAcknowledged ? { plainTextAcknowledged: true } : {}), tokenVault: previous.tokenVault });
      return true;
    }
    const rollback = !encrypted && previous.tokenVault && this.cache?.signature === JSON.stringify(previous.tokenVault) && token === this.cache.token;
    if (rollback && !passwordVerified) {
      const unlocked = await this.open(previous, { forceUnlock: true });
      if (!unlocked) return false;
    }
    if (!encrypted) {
      if ((previous.plainTextAcknowledged !== true) && !await this.prompts.confirmPlaintext({ rollback: Boolean(rollback) })) return false;
      await this.store.write('config.json', { ...metadata, ...(authorProfiles ? { authorProfiles } : {}), token, plainTextAcknowledged: true });
      this.cache = undefined;
      this.legacy = false;
      return true;
    }
    let key, envelope;
    if (this.cache && suppliedPassword === undefined) {
      key = this.cache.key;
      envelope = await seal(token, key, this.cache.salt);
    } else {
      const password = suppliedPassword ?? await this.prompts.createPassword({ legacy: this.legacy === true });
      if (password === undefined) return false;
      if (password.length < 12) throw new Error(tr('本机加密密码至少需要 12 个字符。'));
      ({ key, envelope } = await encryptToken(token, password));
    }
    await this.store.write('config.json', { ...metadata, ...(authorProfiles ? { authorProfiles } : {}), ...(previous.plainTextAcknowledged ? { plainTextAcknowledged: true } : {}), tokenVault: envelope });
    this.cache = { signature: JSON.stringify(envelope), token, key, salt: decode(envelope.salt) };
    this.legacy = false;
    return true;
  }
  async acknowledgePlaintext(stored, config) {
    if (stored?.token && !stored.tokenVault && stored.plainTextAcknowledged !== true) return this.save(config, { previous: stored });
    return true;
  }
  async remove(stored) {
    if (!await this.prompts.confirmRemoval()) return false;
    const { token, tokenVault, encryptToken, ...metadata } = stored;
    await this.store.write('config.json', metadata);
    this.cache = undefined;
    this.legacy = false;
    return true;
  }
}
