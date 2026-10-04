import { getLocale, tr } from './i18n.js';
import { menuIcon } from './icon.js';
import { splitTags, validateConfig } from './core.js';
import { authorLabel, Client, safeError, selectedAuthorLabels } from './publisher.js';

const styles = `
  :host { all:initial; position:fixed; inset:0; z-index:2147483647; color-scheme:light dark; font:13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif; color:light-dark(#242424,#eee); }
  * { box-sizing:border-box; } [hidden] { display:none !important; }
  .backdrop { position:absolute; inset:0; background:#0005; display:flex; align-items:center; justify-content:center; padding:20px; }
  .panel { --panel-padding:24px; width:600px; max-width:100%; max-height:85vh; overflow:auto; padding:var(--panel-padding); background:light-dark(#f5f5f7,#252525); border:1px solid #8883; border-radius:14px; box-shadow:0 12px 42px #0004; }
  .panel.configuration { max-height:calc(100vh - 40px); } .configuration [role=tabpanel] > label { margin:8px 0; } .author-options { margin:8px 0 0; } .author-options .check { margin:0; } .author-options .status { margin:0; max-width:70%; text-align:right; }
  h2 { margin:0; font-size:18px; line-height:1.3; font-weight:600; letter-spacing:-.25px; } .heading { display:flex; align-items:center; gap:10px; } .heading img { width:24px; height:24px; flex:none; } @media(prefers-color-scheme:dark) { .heading img { filter:invert(1); } } p { margin:0; } .heading + .summary { color:light-dark(#666,#b5b5b5); margin:8px 0 16px; font-size:12px; }
  label { display:grid; grid-template-columns:124px minmax(0,1fr); align-items:start; column-gap:14px; row-gap:5px; margin:12px 0; font-weight:500; line-height:1.4; } label > input, label > select { margin-top:-5px; } label > small { grid-column:2; }
  input, select { display:block; min-width:0; width:100%; padding:7px 9px; font:inherit; color:inherit; background:light-dark(#fff,#333); border:1px solid #8885; border-radius:6px; }
  input:focus, select:focus { outline:3px solid #087cf050; outline-offset:1px; } small { display:block; font-weight:400; color:light-dark(#666,#b5b5b5); font-size:12px; line-height:1.55; }
  button { border:1px solid #8886; border-radius:6px; padding:6px 12px; cursor:pointer; font:inherit; color:inherit; background:light-dark(#fff,#444); } button.primary { color:white; background:#087cf0; border-color:#087cf0; } button:disabled { opacity:.5; cursor:default; }
  .buttons { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; position:sticky; bottom:calc(-1 * var(--panel-padding)); z-index:1; margin:22px calc(-1 * var(--panel-padding)) calc(-1 * var(--panel-padding)); padding:16px var(--panel-padding); border-top:1px solid #8883; background:light-dark(#f5f5f7,#252525); } .error { color:light-dark(#b3261e,#ff9b94); font-size:12px; white-space:pre-line; margin-top:16px; } .error:empty, .summary:empty, small:empty { display:none; }
  a, button.link { color:light-dark(#006ad4,#65b3ff); } a { text-decoration:none; } a:hover { text-decoration:underline; } .note { font-size:12px; color:light-dark(#626262,#b8b8b8); }
  .check { display:flex; align-items:flex-start; gap:8px; font-weight:400; margin:12px 0; } .check input { flex:none; width:14px; height:14px; margin:3px 0 0; padding:0; accent-color:#087cf0; } .authors { max-height:160px; overflow:auto; margin:12px 0 0; border:1px solid #8884; border-radius:6px; padding:0 12px; background:light-dark(#fff,#333); }
  .summary { white-space:pre-line; overflow-wrap:anywhere; } .row { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; justify-content:space-between; margin:12px 0; } .row .field-title { font-weight:600; } button.link { background:none; border:0; padding:0; } button:focus-visible, a:focus-visible, summary:focus-visible { outline:3px solid #087cf050; outline-offset:3px; }
  .settings-group { padding:12px; background:light-dark(#fff,#2e2e2e); border:1px solid #8883; border-radius:10px; margin-top:10px; } .settings-group > label:first-child { margin-top:5px; } .settings-group > label:last-child { margin-bottom:5px; } .settings-group .row:first-child { margin-top:0; } .settings-group .row:last-child { margin-bottom:0; } .token-help { margin-top:10px; } .status { margin-top:10px; overflow-wrap:anywhere; } .author-group .check { margin-bottom:8px; }
  .tabs { display:flex; gap:2px; margin-top:16px; padding:3px; border-radius:8px; background:light-dark(#e5e5e9,#191919); } .tabs button { flex:1; border:0; background:none; padding:5px 10px; } .tabs button[aria-selected=true] { background:light-dark(#fff,#494949); box-shadow:0 1px 3px #0002; } .usage { margin-top:16px; padding-top:12px; border-top:1px solid #8883; } .usage h3 { font-size:12px; font-weight:600; margin:0 0 6px; } .usage p { font-size:12px; color:light-dark(#666,#b5b5b5); line-height:1.5; margin:6px 0 0; }
  details { margin-top:16px; border:1px solid #8883; border-radius:10px; background:light-dark(#fff,#2e2e2e); } summary { list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 16px; font-size:13px; } summary::-webkit-details-marker { display:none; } summary::after { content:''; width:6px; height:6px; border-top:1.4px solid #888; border-right:1.4px solid #888; transform:rotate(45deg); flex:none; transition:transform .15s; } details[open] > summary::after { transform:rotate(135deg); } .details-body { padding:4px 16px 16px; border-top:1px solid #8882; } .details-body p { color:light-dark(#666,#b5b5b5); font-size:12px; line-height:1.55; margin-top:12px; } .details-body label:last-child { margin-bottom:0; }
  .review { display:grid; grid-template-columns:124px minmax(0,1fr); gap:12px 14px; margin:18px 0 0; padding:16px; background:light-dark(#fff,#2e2e2e); border:1px solid #8883; border-radius:10px; } .review dt { color:light-dark(#666,#b5b5b5); } .review dd { margin:0; overflow-wrap:anywhere; } .progress { display:flex; align-items:center; gap:12px; margin-top:18px; } .spinner { width:18px; height:18px; flex:none; border:2px solid #8884; border-top-color:#087cf0; border-radius:50%; animation:spin .8s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } } @media(prefers-reduced-motion:reduce) { .spinner { animation:none; } summary::after { transition:none; } }
  @media(max-width:520px) { .panel { --panel-padding:20px; } label, .review { grid-template-columns:minmax(0,1fr); gap:6px; } label > small { grid-column:1; } label > input, label > select { margin-top:0; } .review dd + dt { margin-top:8px; } }
`;

export function form({ title, description, fields, submitLabel, note, validate, initial = {}, mount }) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style'); style.textContent = styles; shadow.append(style);
    const backdrop = document.createElement('div'); backdrop.className = 'backdrop'; shadow.append(backdrop);
    const panel = document.createElement('form'); panel.className = 'panel'; panel.lang = getLocale(); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', title); backdrop.append(panel);
    // Keep events from form controls out of the editor's document listeners.
    for (const eventName of ['input', 'beforeinput', 'change', 'keyup']) panel.addEventListener(eventName, event => event.stopPropagation());
    addHeading(panel, title);
    const desc = document.createElement('p'); desc.className = 'summary'; desc.textContent = description; panel.append(desc);
    const inputs = {};
    for (const field of fields) {
      const label = document.createElement('label'); const labelText = document.createElement('span'); labelText.textContent = field.label; label.append(labelText);
      const input = document.createElement('input'); input.type = field.type || 'text'; input.name = field.name;
      if (input.type === 'checkbox') { input.checked = Boolean(initial[field.name]); label.className = 'check'; }
      else input.value = initial[field.name] || '';
      input.placeholder = field.placeholder || ''; input.required = Boolean(field.required);
      input.autocomplete = 'off'; input.spellcheck = false;
      if (field.inputMode) input.inputMode = field.inputMode;
      if (input.type === 'checkbox') label.prepend(input); else label.append(input);
      if (field.help) { const small = document.createElement('small'); small.textContent = field.help; label.append(small); }
      panel.append(label); inputs[field.name] = input;
    }
    if (note) { const p = document.createElement('p'); p.className = 'note'; p.textContent = note; panel.append(p); }
    const error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert'); panel.append(error);
    const buttons = document.createElement('div'); buttons.className = 'buttons'; panel.append(buttons);
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tr('取消'); buttons.append(cancel);
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'primary'; submit.textContent = submitLabel; buttons.append(submit);
    const previousFocus = document.activeElement;
    let closed = false;
    const finish = value => { if (closed) return; closed = true; host.remove(); previousFocus?.focus(); resolve(value); };
    const getValues = () => Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value]));
    mount?.({ inputs, panel, finish, getValues, isClosed: () => closed, setError: text => { error.textContent = text; }, setLoading: value => { submit.disabled = value; } });
    cancel.onclick = () => finish(undefined);
    panel.addEventListener('submit', event => {
      event.preventDefault();
      if (submit.disabled) return;
      try { finish(validate(getValues())); }
      catch (e) { error.textContent = e.message; }
    });
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); finish(undefined); }
      if (event.key === 'Tab') {
        const focusable = [...panel.querySelectorAll('input, select, button, summary, a[href]')].filter(element => !element.disabled && element.tabIndex !== -1 && !element.closest('[hidden]') && (!element.closest('details') || element.closest('details').open || element.tagName === 'SUMMARY'));
        const index = focusable.indexOf(shadow.activeElement);
        if ((event.shiftKey && index === 0) || (!event.shiftKey && index === focusable.length - 1)) {
          event.preventDefault(); focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
        }
      }
    });
    document.body.append(host); (Object.values(inputs)[0] ?? submit).focus();
  });
}

function addHeading(panel, title) {
  const heading = document.createElement('div'); heading.className = 'heading'; panel.append(heading);
  const icon = document.createElement('img'); icon.src = 'data:image/png;base64,' + menuIcon; icon.alt = ''; heading.append(icon);
  const text = document.createElement('h2'); text.textContent = title; heading.append(text);
}

export function configure(initial = {}, services = {}) {
  const api = {
    getAccountUsername: config => new Client(config).getAccountUsername(),
    listSites: config => new Client(config).listSites(),
    listAuthors: config => new Client(config).listAuthors(),
    ...services,
  };
  let verifiedToken = initial.username && initial.siteId && initial.slug ? String(initial.token ?? '').trim() : '';
  return form({
    title: tr('Typlog 发布配置'),
    description: '',
    initial,
    fields: [
      { name: 'token', label: tr('API Token'), type: 'password', required: true },
      { name: 'username', label: tr('账号用户名'), help: tr('自动读取登录账号的 username，与作者资料的 username 可能不同。') },
      { name: 'slug', label: tr('站点 slug') },
      { name: 'siteId', label: tr('Site ID'), inputMode: 'numeric' },
      { name: 'authorIds', label: tr('作者 ID（可选）'), help: tr('由作者选择自动填入；手填多位作者时用逗号分隔。') },
      { name: 'encryptToken', label: tr('使用独立密码加密本机 Token'), type: 'checkbox' },
    ],

    submitLabel: tr('保存配置'), validate: input => {
      if (verifiedToken !== input.token.trim()) throw new Error(tr('请先读取账号与站点，或切换到手动配置填写账号和站点信息。'));
      return { ...validateConfig(input), encryptToken: input.encryptToken };
    },
    mount: ({ inputs, panel, finish, getValues, isClosed, setError, setLoading }) => {
      panel.classList.add('configuration');
      const section = document.createElement('div'); inputs.token.closest('label').after(section);
      const tokenGroup = document.createElement('div'); tokenGroup.className = 'settings-group'; section.append(tokenGroup); tokenGroup.append(inputs.token.closest('label'));
      const tokenHelp = document.createElement('small'); tokenHelp.className = 'token-help'; tokenGroup.append(tokenHelp);
      const tokenLink = document.createElement('a'); tokenLink.href = 'https://typlog.com/account/tokens'; tokenLink.textContent = tr('API 密钥页面'); tokenLink.target = '_blank'; tokenLink.rel = 'noopener noreferrer'; tokenLink.setAttribute('aria-label', tr('获取 API Token：') + tokenLink.href); tokenLink.onclick = event => { event.preventDefault(); window.open(tokenLink.href, '_blank'); };
      tokenHelp.append(document.createTextNode(tr('登录 Typlog 后，在 ')), tokenLink, document.createTextNode(tr('，点击「+ 新密钥」，输入名称，权限勾选 profile 和 site 复选框，可生成新 API Token，将其复制到这里。')));
      const tabs = document.createElement('div'); tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', tr('配置方式')); section.append(tabs);
      const automatic = document.createElement('div'); automatic.setAttribute('role', 'tabpanel'); automatic.id = 'typlog-auto-panel'; section.append(automatic);
      const advancedBody = document.createElement('div'); advancedBody.className = 'settings-group'; advancedBody.setAttribute('role', 'tabpanel'); advancedBody.id = 'typlog-manual-panel'; advancedBody.hidden = true; section.append(advancedBody);
      const security = document.createElement('div'); security.className = 'settings-group'; security.setAttribute('role', 'tabpanel'); security.id = 'typlog-storage-panel'; security.hidden = true; section.append(security);
      const panes = [automatic, advancedBody, security];
      const tabButtons = [tr('自动配置'), tr('手动配置'), tr('Token 保存')].map((title, index) => {
        const tab = document.createElement('button'); tab.type = 'button'; tab.textContent = title; tab.setAttribute('role', 'tab'); tab.id = 'typlog-tab-' + index; tab.setAttribute('aria-controls', panes[index].id); tabs.append(tab); return tab;
      });
      panes.forEach((pane, index) => pane.setAttribute('aria-labelledby', tabButtons[index].id));
      function selectTab(index) {
        panes.forEach((pane, n) => { pane.hidden = n !== index; });
        tabButtons.forEach((tab, n) => { tab.setAttribute('aria-selected', String(n === index)); tab.tabIndex = n === index ? 0 : -1; });
      }
      tabButtons.forEach((tab, index) => {
        tab.onclick = () => selectTab(index);
        tab.onkeydown = event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3; selectTab(next); tabButtons[next].focus(); }
        };
      });
      selectTab(0);
      const connectionRow = document.createElement('div'); connectionRow.className = 'row'; connectionRow.style.justifyContent = 'flex-end'; automatic.append(connectionRow);
      const connect = document.createElement('button'); connect.type = 'button'; connect.textContent = tr('读取账号与站点'); connectionRow.append(connect);
      const account = document.createElement('small'); account.className = 'status'; account.setAttribute('role', 'status'); connectionRow.prepend(account);
      const blogGroup = document.createElement('div'); blogGroup.className = 'settings-group'; automatic.append(blogGroup);
      const siteLabel = document.createElement('label'); const siteTitle = document.createElement('span'); siteTitle.textContent = tr('站点'); siteLabel.append(siteTitle); blogGroup.append(siteLabel);
      const picker = document.createElement('select'); picker.setAttribute('aria-label', tr('站点')); siteLabel.append(picker);
      const siteNote = document.createElement('small'); siteLabel.append(siteNote);
      const authorSection = document.createElement('div'); authorSection.className = 'settings-group author-group'; automatic.append(authorSection);
      const authorRow = document.createElement('div'); authorRow.className = 'row'; authorSection.append(authorRow);
      const authorTitle = document.createElement('span'); authorTitle.className = 'field-title'; authorTitle.textContent = tr('作者'); authorRow.append(authorTitle);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'link'; button.textContent = tr('选择文章作者…'); authorRow.append(button);
      const help = document.createElement('small'); help.textContent = tr('从本站作者中勾选。仅有一位时自动选中；留空可在后台添加。'); authorSection.append(help);
      const authorOptions = document.createElement('div'); authorOptions.className = 'row author-options'; authorSection.append(authorOptions);
      const noneLabel = document.createElement('label'); noneLabel.className = 'check';
      const none = document.createElement('input'); none.type = 'checkbox'; noneLabel.append(none, document.createTextNode(tr('不设作者'))); authorOptions.append(noneLabel);
      const selected = document.createElement('small'); selected.className = 'status'; selected.setAttribute('role', 'status'); authorOptions.append(selected);
      const box = document.createElement('div'); box.className = 'authors'; box.hidden = true; authorSection.append(box);
      for (const key of ['username', 'slug', 'siteId', 'authorIds']) advancedBody.append(inputs[key].closest('label'));
      const instructions = document.createElement('div'); instructions.className = 'usage'; section.after(instructions);
      const instructionsTitle = document.createElement('h3'); instructionsTitle.textContent = tr('使用说明'); instructions.append(instructionsTitle);
      const instructionsText = document.createElement('p'); instructionsText.textContent = tr('站点需在 Settings → Integrations 启用 XML-RPC。首次读取图片，在 File → Grant Folder Access 授权图片目录。'); instructions.append(instructionsText);
      const privacy = document.createElement('p'); instructions.append(privacy);
      const updateStorage = () => { privacy.textContent = inputs.encryptToken.checked ? tr('已选择独立密码加密。退出 MarkEdit 后再次打开，或打开新文档窗口时需输入本机加密密码。') : tr('已选择明文保存，无需解锁。可在「Token 保存」中启用加密。请勿分享配置文件。'); };
      inputs.encryptToken.onchange = updateStorage; updateStorage();
      security.append(inputs.encryptToken.closest('label'));
      const securityHelp = document.createElement('small'); securityHelp.textContent = tr('密码加密为可选设置，默认明文保存。请设置独立的本机加密密码，与 Typlog 登录密码无关；加密可防止 Token 在配置文件中被直接读取。'); security.append(securityHelp);
      const securityActions = document.createElement('div'); securityActions.className = 'row'; security.append(securityActions);
      const replaceToken = document.createElement('button'); replaceToken.type = 'button'; replaceToken.textContent = tr('替换 Token…'); securityActions.append(replaceToken);
      replaceToken.onclick = () => { inputs.token.value = ''; inputs.token.dispatchEvent(new document.defaultView.Event('input', { bubbles: true })); inputs.token.focus(); };
      const removeToken = document.createElement('button'); removeToken.type = 'button'; removeToken.textContent = tr('删除本机 Token…'); removeToken.disabled = !(initial.hasStoredToken ?? initial.token) || !api.removeToken; securityActions.append(removeToken);
      removeToken.onclick = async () => {
        setLoading(true); removeToken.disabled = true;
        try { if (await api.removeToken()) finish({ removed: true }); }
        catch (error) { setError(safeError(error, { token: inputs.token.value })); }
        finally { if (!isClosed()) { setLoading(false); removeToken.disabled = false; } }
      };
      const recoveryHelp = document.createElement('small'); recoveryHelp.textContent = tr('取消加密并保存，验证本机加密密码后可改回明文。替换或删除 Token 不会清除草稿关联；删除本机记录不会撤销 Typlog 上的 Token。'); security.append(recoveryHelp);
      let sites = [], authors, authorScope, generation = 0;
      // An existing blank author setting is deliberate and survives refresh/restart.
      let wantsNone = Boolean(initial.siteId && initial.authorIds === '');
      none.checked = wantsNone;
      const token = () => inputs.token.value.trim();
      const stamp = () => JSON.stringify([token(), inputs.siteId.value, inputs.slug.value]);
      const current = ticket => !isClosed() && ticket === generation;
      function loading(value) { setLoading(value); connect.disabled = value; button.disabled = value; picker.disabled = value; }
      function begin() { const ticket = ++generation; loading(true); setError(''); return ticket; }
      function end(ticket) { if (current(ticket)) loading(false); }
      function resetAuthors() { authors = undefined; authorScope = undefined; box.replaceChildren(); box.hidden = true; selected.textContent = ''; }
      function updateAuthors() {
        none.checked = wantsNone;
        if (!authors || stamp() !== authorScope) return;
        try { selected.textContent = selectedAuthorLabels(inputs.authorIds.value, authors).join(tr('、')) || (wantsNone ? tr('不设作者') : tr('未选择作者'));
          selected.hidden = !box.hidden || wantsNone; }
        catch (error) { selected.textContent = error.message; }
        const ids = splitTags(inputs.authorIds.value);
        for (const check of box.querySelectorAll('input')) check.checked = ids.includes(check.value);
      }
      none.onchange = () => {
        wantsNone = none.checked;
        if (wantsNone) inputs.authorIds.value = '';
        else if (authors?.length === 1) inputs.authorIds.value = authors[0].id;
        updateAuthors();
      };
      async function loadAuthors(ticket, show) {
        const config = getValues();
        if (!/^[1-9]\d*$/.test(config.siteId) || !config.slug || !config.token.trim()) throw new Error(tr('请先读取并选择站点，或切换到手动配置填写站点信息。'));
        const requestedScope = stamp();
        selected.textContent = tr('正在获取本站作者…');
        const result = await api.listAuthors(config);
        if (!current(ticket) || stamp() !== requestedScope) return;
        authors = result; authorScope = requestedScope; box.replaceChildren();
        if (!authors.length) { inputs.authorIds.value = ''; wantsNone = true; selected.textContent = tr('本站暂无作者，不设作者。'); }
        else if (authors.length === 1 && !wantsNone && !inputs.authorIds.value.trim()) inputs.authorIds.value = authors[0].id;
        for (const author of authors) {
          const label = document.createElement('label'); label.className = 'check';
          const check = document.createElement('input'); check.type = 'checkbox'; check.value = author.id;
          label.append(check, document.createTextNode(authorLabel(author))); box.append(label);
          check.onchange = () => {
            inputs.authorIds.value = [...box.querySelectorAll('input:checked')].map(input => input.value).join(', ');
            wantsNone = !inputs.authorIds.value; updateAuthors();
          };
        }
        box.hidden = !show;
        updateAuthors();
      }
      async function chooseSite(site, ticket) {
        if (inputs.siteId.value !== site.id || inputs.slug.value !== site.slug) {
          inputs.authorIds.value = ''; wantsNone = false; resetAuthors();
        }
        inputs.siteId.value = site.id; inputs.slug.value = site.slug;
        siteNote.textContent = '';
        await loadAuthors(ticket, false);
      }
      function renderSites() {
        picker.replaceChildren();
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = sites.length ? tr('请选择站点…') : tr('请先读取账号与站点'); picker.append(placeholder);
        for (const site of sites) { const option = document.createElement('option'); option.value = site.id; option.textContent = (site.name || site.slug) + ' (' + site.slug + ')'; picker.append(option); }
      }
      async function discover() {
        const requestedToken = token();
        if (!requestedToken || /[\r\n]/.test(requestedToken)) { setError(tr('请填写有效的 API Token。')); return; }
        const ticket = begin(); account.textContent = tr('正在读取账号和站点…');
        try {
          const [userResult, sitesResult] = await Promise.allSettled([api.getAccountUsername({ token: requestedToken }), api.listSites({ token: requestedToken })]);
          if (!current(ticket) || token() !== requestedToken) return;
          const warnings = [];
          if (userResult.status === 'fulfilled') {
            verifiedToken = requestedToken; inputs.username.value = userResult.value;
            account.textContent = tr('账号：@{username}', { username: userResult.value });
          } else {
            account.textContent = inputs.username.value ? tr('账号：@{username}（已保存）', { username: inputs.username.value }) : tr('账号用户名未获取，可切换到手动配置填写。');
            warnings.push(/HTTP (401|403)/.test(userResult.reason?.message) ? tr('读取 username 需要 profile 权限；也可在「手动配置」中填写。') : tr('账号读取失败：') + safeError(userResult.reason, { token: requestedToken }));
          }
          if (sitesResult.status === 'fulfilled') {
            sites = sitesResult.value; renderSites();
            const chosen = sites.length === 1 ? sites[0] : sites.find(site => site.id === inputs.siteId.value && site.slug === inputs.slug.value);
            if (chosen) { picker.value = chosen.id; await chooseSite(chosen, ticket); }
            else {
              inputs.siteId.value = ''; inputs.slug.value = ''; inputs.authorIds.value = ''; wantsNone = false; resetAuthors(); none.checked = false;
              siteNote.textContent = sites.length ? tr('请选择一个站点。') : tr('此 Token 未返回可访问的活跃站点，请检查 site 权限或账号站点状态。');
            }
          } else {
            warnings.push(tr('读取站点列表失败：') + safeError(sitesResult.reason, { token: requestedToken }) + tr(' 请检查 site 权限。'));
            sites = []; renderSites();
            if (inputs.siteId.value && inputs.slug.value) {
              const option = document.createElement('option'); option.value = inputs.siteId.value; option.textContent = inputs.slug.value + tr('（已保存的站点）'); picker.append(option); picker.value = inputs.siteId.value;
              siteNote.textContent = tr('暂时使用已保存的站点配置，可重试或手动修改。');
              await loadAuthors(ticket, false);
            }
          }
          if (current(ticket) && warnings.length) setError(warnings.join('\n'));
        } catch (error) {
          if (current(ticket)) { account.textContent = tr('读取未完成，可重试或切换到手动配置。'); setError(safeError(error, { token: requestedToken })); }
        } finally { end(ticket); }
      }
      connect.onclick = discover;
      picker.onchange = async () => {
        const ticket = begin();
        const site = sites.find(site => site.id === picker.value);
        try {
          if (site) await chooseSite(site, ticket);
          else { inputs.siteId.value = ''; inputs.slug.value = ''; inputs.authorIds.value = ''; resetAuthors(); }
        } catch (error) { if (current(ticket)) setError(tr('获取作者失败：') + safeError(error, { token: token() })); }
        finally { end(ticket); }
      };
      button.onclick = async () => {
        const ticket = begin();
        try { await loadAuthors(ticket, true); }
        catch (error) { if (current(ticket)) setError(tr('获取作者失败：') + safeError(error, { token: token() })); }
        finally { end(ticket); }
      };
      inputs.token.addEventListener('input', () => {
        ++generation; loading(false); verifiedToken = ''; sites = []; renderSites(); account.textContent = ''; siteNote.textContent = ''; resetAuthors();
        for (const key of ['username', 'slug', 'siteId', 'authorIds']) inputs[key].value = '';
        wantsNone = false; none.checked = false; setError('');
      });
      for (const key of ['username', 'slug', 'siteId', 'authorIds']) inputs[key].addEventListener('input', () => {
        if (key === 'authorIds') { wantsNone = !inputs.authorIds.value.trim(); updateAuthors(); }
        else { ++generation; loading(false); verifiedToken = token(); resetAuthors(); picker.value = ''; siteNote.textContent = tr('正在使用手动填写的账号和站点配置。'); }
      });
      renderSites();
      if (initial.token) void discover();
    },
  });
}

export function confirmPublish(parsed, images, config, authors, postId) {
  return form({
    title: postId ? tr('更新已有草稿？') : tr('新建草稿？'),
    description: postId ? tr('本次更新原草稿（ID {id}），不会新建 Post。', { id: postId }) : tr('本次将在所选站点中新建草稿。'),
    fields: [], submitLabel: postId ? tr('更新草稿') : tr('新建草稿'), validate: () => true,
    mount: ({ panel }) => {
      const review = document.createElement('dl'); review.className = 'review'; panel.querySelector('.summary').after(review);
      for (const [label, value] of [[tr('站点'), config.slug], [tr('文章标题'), parsed.title], [tr('标签（可选）'), parsed.tags.join(tr('、')) || tr('无')], [tr('本地图片'), String(images)], [tr('作者'), authors.join(tr('、')) || tr('不设作者')]]) {
        const key = document.createElement('dt'); key.textContent = label; const detail = document.createElement('dd'); detail.textContent = value; review.append(key, detail);
      }
    },
  });
}

export function editMetadata(parsed, { openAfter = true, postId } = {}) {
  return form({
    title: postId ? tr('更新已有草稿') : tr('推送至草稿'),
    description: postId ? tr('将用当前文档更新草稿（ID {id}）。', { id: postId }) : tr('首次推送新建草稿，之后更新同一份草稿。'),
    initial: { title: parsed.title, tags: parsed.tags.join(', '), openAfter, existingPostId: '' },
    fields: [
      { name: 'title', label: tr('文章标题'), required: true },
      { name: 'tags', label: tr('标签（可选）'), help: tr('用英文逗号 , 或中文逗号 ， 分隔。') },
      { name: 'openAfter', type: 'checkbox', label: tr('完成后自动打开文章编辑页面') },
      ...(!postId ? [{ name: 'existingPostId', label: tr('已有草稿的文章 ID（可选）'), inputMode: 'numeric', help: tr('升级前已推送，或文档改名、移动后，可填 ID 关联原草稿。') }] : []),
    ], submitLabel: tr('继续'),
    mount: ({ inputs, panel }) => {
      if (!inputs.existingPostId) return;
      const details = document.createElement('details'); inputs.openAfter.closest('label').after(details);
      const summary = document.createElement('summary'); summary.textContent = tr('关联已有草稿'); const body = document.createElement('div'); body.className = 'details-body'; details.append(summary, body); body.append(inputs.existingPostId.closest('label'));
    },
    validate: input => {
      if (!input.title.trim()) throw new Error(tr('文章标题不能为空。'));
      if (input.existingPostId && !/^[1-9]\d*$/.test(input.existingPostId.trim())) throw new Error(tr('文章 ID 必须是正整数。'));
      return { title: input.title.trim(), tags: splitTags(input.tags), openAfter: input.openAfter, ...(input.existingPostId?.trim() ? { existingPostId: input.existingPostId.trim() } : {}) };
    },
  });
}

export function progressPanel() {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style'); style.textContent = styles; shadow.append(style);
  const backdrop = document.createElement('div'); backdrop.className = 'backdrop'; shadow.append(backdrop);
  const panel = document.createElement('div'); panel.className = 'panel'; backdrop.append(panel);
  addHeading(panel, tr('推送到 Typlog'));
  const progress = document.createElement('div'); progress.className = 'progress'; panel.append(progress);
  const spinner = document.createElement('span'); spinner.className = 'spinner'; spinner.setAttribute('aria-hidden', 'true'); progress.append(spinner);
  const message = document.createElement('p'); message.textContent = tr('正在准备…'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); progress.append(message);
  document.body.append(host);
  return { update: text => { message.textContent = text; }, remove: () => host.remove() };
}

export function protectToken({ legacy = false } = {}) {
  return form({
    title: tr('设置本机加密密码'),
    description: tr('可选：为本机 Token 设置独立密码，至少 12 个字符，与 Typlog 登录密码无关。加密可防止配置文件中的 Token 被直接读取。密码不会保存；忘记后可删除或替换 Token。'),
    fields: [
      { name: 'password', label: tr('本机加密密码'), type: 'password', required: true },
      { name: 'confirmation', label: tr('再次输入本机加密密码'), type: 'password', required: true },
    ],
    note: tr('退出 MarkEdit 后再次打开，或打开新文档窗口时，需要重新输入本机加密密码。同一窗口内无需每次推送都解锁；取消不会更改原配置。'),
    submitLabel: tr('加密并保存'),
    validate: input => {
      if (input.password.length < 12) throw new Error(tr('本机加密密码至少需要 12 个字符。'));
      if (input.password !== input.confirmation) throw new Error(tr('两次输入的密码不一致。'));
      return input.password;
    },
  });
}

export function unlockToken({ allowReset = false, failed = false, rollback = false } = {}) {
  return form({
    title: tr('输入本机加密密码'),
    description: failed ? tr('本机加密密码不正确或加密记录已损坏，请重试。') : rollback ? tr('请输入当前本机加密密码，以将原 Token 改为明文保存。') : tr('输入此前设置的本机加密密码。Token 仅在当前文档窗口的内存中解密。'),
    fields: [
      { name: 'password', label: tr('本机加密密码'), type: 'password' },
      ...(allowReset ? [{ name: 'reset', label: tr('忘记本机加密密码，改用新的 API Token 重新配置'), type: 'checkbox' }] : []),
    ],
    note: tr('这是为此扩展设置的独立密码，与 Typlog 登录密码无关。') + ' ' + (allowReset ? tr('重新配置时保留站点和草稿关联；保存新 Token 后替换旧的加密记录。') : tr('忘记本机加密密码时，请从「修改发布配置」删除或替换 Token。')),
    submitLabel: tr('继续'),
    mount: ({ panel, finish }) => {
      if (!allowReset) return;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = tr('删除本机 Token…'); panel.querySelector('.buttons').prepend(remove); remove.onclick = () => finish({ remove: true });
    },
    validate: input => {
      if (input.reset) return { reset: true };
      if (!input.password) throw new Error(tr('请输入本机加密密码。'));
      return { password: input.password };
    },
  });
}

export function confirmPlaintext({ rollback = false } = {}) {
  return form({
    title: rollback ? tr('改为明文保存？') : tr('Token 将以明文保存在本机'),
    description: tr('Token 会保存在此 Mac 的 MarkEdit 配置文件中，未使用钥匙串或密码加密。能读取文件或备份的人可能取得 Token，请勿分享配置文件。'),
    note: tr('明文保存无需设置密码。可随时在「Token 保存」中选择独立密码加密，以保护配置文件中的 Token。'),
    fields: [], submitLabel: tr('明文保存'), validate: () => true,
  }).then(Boolean);
}

export function confirmTokenRemoval() {
  return form({
    title: tr('删除本机 Token？'),
    description: tr('删除后需要重新填写 Token 才能推送。站点配置和已有草稿关联保留；Typlog 上的 Token 不会被撤销。'),
    fields: [], submitLabel: tr('删除本机 Token'), validate: () => true,
  }).then(Boolean);
}
