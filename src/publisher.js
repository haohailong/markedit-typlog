import { tr } from './i18n.js';
import { adminUrl, collectImages, decodeXmlResponse, digest, endpoint, parseDocument, renderDocument, splitTags, xmlCall } from './core.js';

export class Store {
  constructor(host) {
    this.host = host;
    this.directory = host.getDirectoryPath('documents') + '/typlog-publisher';
  }
  async initialize() {
    if (await this.host.getFileInfo(this.directory)) return;
    if (!await this.host.createFile({ path: this.directory, isDirectory: true })) throw new Error(tr('无法创建 Typlog 的本地配置目录。'));
  }
  async read(name, fallback) {
    const path = this.directory + '/' + name;
    const raw = await this.host.getFileContent(path);
    if (raw === undefined) {
      if (await this.host.getFileInfo(path)) throw new Error(tr('无法读取本地配置／推送记录。'));
      return fallback;
    }
    try { return JSON.parse(raw); } catch { throw new Error(tr('本地配置／推送记录损坏，请从配置菜单检查。')); }
  }
  async write(name, value) {
    await this.initialize();
    if (!await this.host.createFile({ path: this.directory + '/' + name, string: JSON.stringify(value, null, 2), overwrites: true })) {
      throw new Error(tr('无法保存本地配置／推送记录；操作已停止。'));
    }
  }
}

export class Client {
  constructor(config, fetcher) {
    this.config = config;
    // WebKit requires the native fetch receiver to be the Window, not this Client.
    this.fetcher = fetcher ?? ((...args) => globalThis.fetch(...args));
  }
  async request(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await this.fetcher(url, { ...options, signal: controller.signal, redirect: 'error', credentials: 'omit' });
      if (!response.ok) {
        let detail = '';
        try {
          const body = JSON.parse(await response.text());
          if (body.errors?.includes('Invalid author profile')) detail = tr('所选作者不属于此站点，请重新选择作者。');
        } catch { /* Do not display arbitrary server responses or credentials. */ }
        if (!detail) detail = [401, 403].includes(response.status) ? tr('请检查 Token 和 {scope} 权限。', { scope: new URL(url).pathname === '/v3/user' ? 'profile' : 'site' }) : tr('请检查站点配置及请求内容。');
        const error = new Error(tr('Typlog 请求失败（HTTP {status}）。', { status: response.status }) + detail);
        error.safeToRetry = [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status);
        throw error;
      }
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(options.method === 'GET' ? tr('Typlog 读取请求超时，请重试。') : tr('Typlog 请求超时。请先检查后台是否已生成草稿。'));
      throw error;
    } finally { clearTimeout(timer); }
  }
  async rpc(method, values) {
    const text = await this.request(endpoint(this.config), { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: xmlCall(method, values) });
    try { return decodeXmlResponse(text); } catch (error) {
      if (error.rpcFault) error.safeToRetry = true;
      throw error;
    }
  }
  credentials() { return [this.config.siteId, this.config.username, this.config.token]; }
  apiHeaders() {
    return { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.config.token, ...(this.config.siteId ? { 'X-Site-Id': this.config.siteId } : {}) };
  }
  async apiGet(path) {
    const text = await this.request('https://api.typlog.com/v3/' + path, { method: 'GET', headers: this.apiHeaders() });
    try { return JSON.parse(text); } catch { throw new Error(tr('Typlog 返回了无法读取的数据。')); }
  }
  async getAccountUsername() {
    const data = await this.apiGet('user');
    if (typeof data?.username !== 'string' || !data.username.trim()) throw new Error(tr('Typlog 未返回有效的账号用户名。'));
    return data.username.trim();
  }
  async listSites() {
    const data = await this.apiGet('sites');
    if (!Array.isArray(data)) throw new Error(tr('Typlog 返回的站点列表格式不正确。'));
    return data.map(site => {
      if (!/^[1-9]\d*$/.test(String(site.id)) || typeof site.slug !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(site.slug)) throw new Error(tr('站点列表包含无效的 ID 或 slug。'));
      return { id: String(site.id), slug: site.slug, name: typeof site.name === 'string' ? site.name.trim() : '' };
    });
  }
  async listAuthors() {
    const text = await this.request('https://api.typlog.com/v3/authors', { method: 'GET', headers: this.apiHeaders() });
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(tr('Typlog 返回了无法读取的作者列表。')); }
    if (!Array.isArray(data)) throw new Error(tr('Typlog 返回的作者列表格式不正确。'));
    return data.map(author => {
      if (!/^[1-9]\d*$/.test(String(author.id))) throw new Error(tr('作者列表包含无效的作者 ID。'));
      return { id: String(author.id), name: typeof author.name === 'string' ? author.name.trim() : '', username: typeof author.username === 'string' ? author.username.trim() : '' };
    });
  }
  async upload(asset) {
    const result = await this.rpc('metaWeblog.newMediaObject', [...this.credentials(), { name: asset.name, type: asset.mimeType, bits: { __base64: asset.data } }]);
    let url;
    try { url = new URL(result.url); } catch { throw new Error(tr('图片上传响应缺少有效的 URL。')); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(tr('图片上传响应不是安全的 HTTPS 地址。'));
    return url.href;
  }
  async createDraft(title, html, tags) {
    const result = await this.rpc('metaWeblog.newPost', [...this.credentials(), { title, description: html, categories: tags, post_status: 'draft' }, false]);
    if (!/^\d+$/.test(String(result))) throw new Error(tr('创建请求没有返回有效文章 ID。请先检查 Typlog 后台。'));
    return String(result);
  }
  async assertDraft(postId) {
    const post = await this.apiGet('posts/' + encodeURIComponent(postId));
    const status = post.status ?? post.metadata?.status;
    if (status !== 'draft') throw new Error(status ? tr('关联文章（ID {id}）已不是草稿，请到后台编辑。本次未更新，也未新建文章。', { id: postId }) : tr('无法确认关联文章（ID {id}）的草稿状态，请到后台检查。本次未更新，也未新建文章。', { id: postId }));
  }
  async updateDraft(postId, title, html, tags) {
    const result = await this.rpc('metaWeblog.editPost', [String(postId), this.config.username, this.config.token, { title, description: html, categories: tags, post_status: 'draft' }, false]);
    if (result !== true) throw new Error(tr('Typlog 未确认草稿更新成功，请到后台检查；重试会继续更新同一草稿。'));
  }
  async setAuthors(postId) {
    if (!this.config.authorIds) return;
    await this.request('https://api.typlog.com/v3/posts/' + encodeURIComponent(postId), {
      method: 'PATCH',
      headers: this.apiHeaders(),
      body: JSON.stringify({ primary_authors: splitTags(this.config.authorIds).map(Number) }),
    });
    let post;
    try { post = JSON.parse(await this.request('https://api.typlog.com/v3/posts/' + encodeURIComponent(postId), { method: 'GET', headers: this.apiHeaders() })); }
    catch (error) { throw new Error(tr('作者设置请求已发送，但无法确认结果。') + safeError(error, this.config)); }
    const actual = (post.primary_authors ?? []).map(author => String(author.id)).sort();
    const expected = [...new Set(splitTags(this.config.authorIds))].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(tr('后台返回的作者与所选作者不一致，请重试或到后台检查。'));
  }
}

export function authorLabel(author) {
  return author.name ? author.name + (author.username ? ' (@' + author.username + ')' : '') : author.username ? '@' + author.username : tr('未命名作者（ID {id}）', { id: author.id });
}

export function selectedAuthorLabels(authorIds, authors) {
  return splitTags(authorIds).map(id => {
    const author = authors.find(author => author.id === id);
    if (!author) throw new Error(tr('作者 ID {id} 不在本站作者列表中，请在发布配置的作者列表中重新选择。', { id }));
    return authorLabel(author);
  });
}

export function safeError(error, config) {
  let message = error instanceof Error ? error.message : tr('操作未完成。');
  if (config?.token) message = message.split(config.token).join(tr('[Token 已隐藏]'));
  return message;
}

export async function prepare(host, source, parsed = parseDocument(source)) {
  const info = await host.getFileInfo();
  const doc = renderDocument(parsed);
  const parentPath = info?.isDirectory && /\.textbundle\/?$/i.test(info.filePath) ? info.filePath : info?.parentPath;
  const assets = await collectImages(doc, host, parentPath);
  for (const asset of assets) asset.hash = await digest(asset.mimeType + ':' + asset.data.replace(/\s/g, ''));
  return { parsed, doc, assets, filePath: info?.filePath ?? '' };
}

export async function documentRecord(store, config, filePath) {
  if (!filePath) throw new Error(tr('请先保存当前文档，再推送草稿。'));
  const key = await digest(JSON.stringify([config.slug, config.siteId, filePath]));
  const name = 'document-' + key + '.json';
  return { name, record: await store.read(name, null) };
}

export async function publicationTarget(prepared, config, store) {
  const { name, record: saved } = await documentRecord(store, config, prepared.filePath);
  let record = saved;
  const contentHash = await digest(JSON.stringify([prepared.parsed, prepared.assets.map(x => x.hash)]));
  if (!record) {
    const identity = [prepared.filePath, prepared.parsed, prepared.assets.map(x => x.hash)];
    for (const prefix of [[config.slug, config.siteId], [config.slug, config.siteId, config.authorIds]]) {
      const key = await digest(JSON.stringify([...prefix, ...identity]));
      record = await store.read('push-' + key + '.json', null);
      if (record) {
        record = { ...record, contentHash: record.postId ? contentHash : undefined, authorIds: record.stage === 'complete' ? config.authorIds : undefined };
        break;
      }
    }
  }
  record ??= { stage: 'new', uploads: {} };
  return { name, record, contentHash };
}

// One journal per saved document and site. An uncertain creation never starts a
// second post automatically; update retries always use the recorded post ID.
export async function publishPrepared(prepared, config, store, ui, client = new Client(config), target) {
  const { parsed, doc, assets } = prepared;
  const { name, record, contentHash } = target ?? await publicationTarget(prepared, config, store);
  if (!await ui.confirm(parsed, assets.length, config, record.postId)) return;
  if (record.postId) await client.assertDraft(record.postId);
  if (record.stage === 'complete' && record.contentHash === contentHash && (record.authorIds === config.authorIds || !config.authorIds)) {
    await store.write(name, record);
    await ui.complete(record.postId, adminUrl(config, record.postId), true);
    return record.postId;
  }
  if (record.stage === 'creating' && !record.postId) {
    const recovery = await ui.recover(config);
    if (!recovery) return;
    if (recovery.postId) {
      await client.assertDraft(recovery.postId);
      record.postId = recovery.postId; record.stage = 'created'; await store.write(name, record);
    } else { record.stage = 'new'; await store.write(name, record); }
  }
  const existing = Boolean(record.postId);
  if (!record.postId || record.contentHash !== contentHash) {
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      ui.progress(tr('上传图片 {current} / {total}：{name}', { current: i + 1, total: assets.length, name: asset.name }));
      if (!record.uploads[asset.hash]) {
        record.uploads[asset.hash] = await client.upload(asset);
        await store.write(name, record);
      }
      for (const node of asset.nodes) node.setAttribute('src', record.uploads[asset.hash]);
    }
    if (record.postId) {
      ui.progress(tr('更新已有草稿（ID {id}）…', { id: record.postId }));
      record.stage = 'updating'; await store.write(name, record);
      await client.updateDraft(record.postId, parsed.title, doc.body.innerHTML, parsed.tags);
    } else {
      ui.progress(tr('创建 Typlog 草稿…'));
      record.stage = 'creating'; await store.write(name, record);
      try { record.postId = await client.createDraft(parsed.title, doc.body.innerHTML, parsed.tags); }
      catch (error) {
        if (error.safeToRetry) { record.stage = 'new'; await store.write(name, record); }
        throw error;
      }
    }
    record.contentHash = contentHash; record.stage = 'created'; await store.write(name, record);
  }
  try {
    if (config.authorIds) { ui.progress(tr('设置文章作者…')); await client.setAuthors(record.postId); }
  } catch (error) {
    throw new Error(tr('草稿已保存（ID {id}），但作者设置失败。再次推送会继续设置作者，不会重复建稿。', { id: record.postId }) + '\n' + safeError(error, config));
  }
  record.stage = 'complete'; record.authorIds = config.authorIds; await store.write(name, record);
  ui.progress(existing ? tr('草稿已更新') : tr('草稿已创建'));
  await ui.complete(record.postId, adminUrl(config, record.postId), existing);
  return record.postId;
}
