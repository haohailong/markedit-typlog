import { tr } from './i18n.js';
import { menuIcon } from './icon.js';
import { adminUrl, parseDocument, validateConfig } from './core.js';
import { Client, documentRecord, prepare, publicationTarget, publishPrepared, safeError, selectedAuthorLabels, Store } from './publisher.js';
import { configure, confirmPublish, editMetadata, progressPanel, protectToken, unlockToken, confirmPlaintext, confirmTokenRemoval } from './ui.js';
import { TokenVault } from './vault.js';

(() => {
  const host = globalThis.MarkEdit;
  if (!host?.addMainMenuItem || globalThis.__markeditTyplogLoaded) return;
  globalThis.__markeditTyplogLoaded = true;
  const store = new Store(host);
  const vault = new TokenVault(store, { createPassword: protectToken, unlockPassword: unlockToken, confirmPlaintext, confirmRemoval: confirmTokenRemoval });
  let busy = false, panel, currentConfig;
  const alert = (title, message) => host.showAlert({ title, message, buttons: [tr('好')] });
  async function exclusive(action) {
    if (busy) { await alert('Typlog', tr('当前窗口已有一个 Typlog 操作正在进行。')); return; }
    busy = true;
    try { await action(); }
    catch (error) { panel?.remove(); panel = undefined; await alert(tr('Typlog 操作未完成'), safeError(error, currentConfig)); }
    finally { panel?.remove(); panel = undefined; busy = false; currentConfig = undefined; }
  }
  async function syncAccountCache(stored, config) {
    const client = new Client(config);
    const [account, sites] = await Promise.allSettled([client.getAccountUsername(), client.listSites()]);
    const updates = {};
    if (account.status === 'fulfilled') updates.username = account.value;
    if (sites.status === 'fulfilled') updates.siteCache = { username: updates.username ?? config.username, sites: sites.value };
    if (Object.entries(updates).some(([key, value]) => JSON.stringify(stored[key]) !== JSON.stringify(value))) {
      Object.assign(stored, updates);
      await store.write('config.json', stored);
    }
    return { ...config, ...updates };
  }
  async function settings({ replace = false, tab } = {}) {
    const stored = await store.read('config.json', {});
    const previous = vault.settings(stored);
    let passwordVerified = false;
    currentConfig = previous;
    const config = await configure({ ...previous, ...(replace ? { token: '', tokenLocked: false, hasEncryptedToken: false } : {}), encryptToken: Boolean(stored.tokenVault && !replace), hasStoredToken: Boolean(stored.token || stored.tokenVault) }, {
      initialTab: tab,
      removeToken: async () => vault.remove(stored),
      rollbackToken: async () => {
        const unlocked = await vault.open(stored, { forceUnlock: true });
        if (!unlocked || unlocked.settings) return;
        const refreshed = await syncAccountCache(stored, unlocked);
        passwordVerified = true;
        return { token: unlocked.token, username: refreshed.username, siteCache: refreshed.siteCache };
      },
    });
    if (!config) return;
    if (config.removed) { await alert(tr('Token 已删除'), tr('已删除本机 Token，站点配置和草稿关联保留。Typlog 上的 Token 未被撤销。')); return; }
    currentConfig = config;
    if (!await vault.save(config, { encrypted: config.encryptToken, previous: stored, passwordVerified, password: config.encryptionPassword, preserveEncrypted: config.preserveToken })) return;
    await alert(tr('配置已保存'), tr('之后可从「扩展 → Typlog → 推送为草稿」使用，也可以随时修改配置。'));
    return config;
  }
  async function push() {
    const stored = await store.read('config.json', null);
    let config;
    if (stored && (stored.token || stored.tokenVault)) {
      const unlocked = await vault.open(stored, { allowReset: true });
      if (!unlocked) return;
      if (unlocked.settings) { await settings({ tab: 'storage' }); return; }
      const refreshed = vault.lastOpenUsedPassword ? await syncAccountCache(stored, unlocked) : unlocked;
      if (unlocked.reset) config = await settings({ replace: true });
      else config = validateConfig(refreshed);
      if (!config) return;
      currentConfig = config;
      if (!await vault.acknowledgePlaintext(stored, config)) return;
    }
    else config = await settings();
    if (!config) return;
    currentConfig = config;
    const source = host.editorAPI.getText();
    if (!source.trim()) throw new Error(tr('当前文档为空。'));
    const parsed = parseDocument(source);
    const fileInfo = await host.getFileInfo();
    const association = await documentRecord(store, config, fileInfo?.filePath);
    const preferences = await store.read('preferences.json', {});
    const metadata = await editMetadata(parsed, { postId: association.record?.postId, openAfter: preferences.openAfter !== false });
    if (!metadata) return;
    await store.write('preferences.json', { ...preferences, openAfter: metadata.openAfter });
    panel = progressPanel();
    const client = new Client(config);
    panel.update(tr('正在核对文章作者…'));
    const profiles = config.authorIds ? await client.listAuthors() : undefined;
    const authors = profiles ? selectedAuthorLabels(config.authorIds, profiles) : [];
    if (profiles) await store.write('config.json', { ...await store.read('config.json', {}), authorProfiles: { siteId: config.siteId, slug: config.slug, authors: profiles } });
    panel.update(tr('正在读取文章和图片…'));
    const prepared = await prepare(host, source, { ...parsed, title: metadata.title, tags: metadata.tags });
    const target = await publicationTarget(prepared, config, store);
    if (metadata.existingPostId) target.record = { ...target.record, postId: metadata.existingPostId, stage: 'created', contentHash: undefined };
    if (target.record.postId) { panel.update(tr('核对已有草稿…')); await client.assertDraft(target.record.postId); }
    panel.remove(); panel = undefined;
    const confirmation = await confirmPublish(prepared.parsed, prepared.assets.length, config, authors, target.record.postId);
    if (!confirmation) return;
    const ui = {
      progress: text => { if (!panel) panel = progressPanel(); panel.update(text); },
      confirm: async () => true,
      recover: async config => {
        const choice = await host.showAlert({
          title: tr('上次创建请求的结果不确定'),
          message: tr('请先查看 Typlog 后台。若草稿已生成，填写文章 ID 继续；只有确认没有生成时，才重新创建。'),
          buttons: [tr('填写已有文章 ID'), tr('已确认没有生成，重新创建'), tr('取消')],
        });
        if (choice === 1) return {};
        if (choice !== 0) return;
        const id = (await host.showTextBox({ title: tr('已有草稿的文章 ID'), placeholder: tr('后台文章地址最后的数字') }))?.trim();
        if (!id) return;
        if (!/^[1-9]\d*$/.test(id)) throw new Error(tr('文章 ID 必须是正整数。'));
        if (await host.showAlert({ title: tr('继续处理此草稿？'), message: adminUrl(config, id) + tr('\n作者：') + (authors.join(tr('、')) || tr('不设作者')), buttons: [tr('继续'), tr('取消')] }) !== 0) return;
        return { postId: id };
      },
      complete: async (id, url, existing) => {
        panel?.remove(); panel = undefined;
        if (metadata.openAfter) window.open(url, '_blank');
        else await alert(existing ? tr('原草稿已准备好') : tr('Typlog 草稿已准备好'), tr('文章 ID：{id}\n作者：{authors}\n可从 Typlog 后台继续编辑。', { id, authors: authors.join(tr('、')) || tr('不设作者') }));
      },
    };
    await publishPrepared(prepared, config, store, ui, client, target);
  }
  host.addMainMenuItem({
    title: 'Typlog', icon: menuIcon,
    children: [
      { title: tr('推送为草稿…'), key: 'T', modifiers: ['Control', 'Option', 'Command'], action: () => exclusive(push) },
      { title: tr('修改发布配置…'), action: () => exclusive(settings) },
      { separator: true },
      { title: tr('打开 Typlog 后台'), action: () => exclusive(async () => {
        const config = await store.read('config.json', {});
        if (!/^[a-z0-9][a-z0-9_-]*$/i.test(config.slug ?? '')) throw new Error(tr('请先配置站点。'));
        window.open('https://typlog.com/admin/' + encodeURIComponent(config.slug) + '/', '_blank');
      }) },
    ],
  });
})();
