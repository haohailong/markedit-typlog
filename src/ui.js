import { getLocale, tr } from './i18n.js';
import { menuIcon } from './icon.js';
import { splitTags, validateConfig } from './core.js';
import { authorLabel, Client, safeError, selectedAuthorLabels } from './publisher.js';

const styles = `
  :host { all:initial; position:fixed; inset:0; z-index:2147483647; color-scheme:light dark; font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif; color:light-dark(#242424,#f0f0f0); }
  * { box-sizing:border-box; } [hidden] { display:none !important; }
  .backdrop { position:absolute; inset:0; background:#0003; display:flex; align-items:center; justify-content:center; padding:20px; }
  .panel { --panel-padding:28px; width:640px; max-width:100%; max-height:calc(100vh - 40px); overflow:auto; padding:var(--panel-padding); background:light-dark(#fcfcfd,#252527); border:1px solid #8884; border-radius:16px; box-shadow:0 18px 60px #0004,0 1px 3px #0002; animation:dialog-in .16s ease-out; }
  h2 { margin:0; font-size:20px; line-height:1.3; font-weight:600; letter-spacing:-.3px; } .heading { display:flex; align-items:center; gap:10px; } .heading img { width:24px; height:24px; flex:none; } @media(prefers-color-scheme:dark) { .heading img { filter:invert(1); } }
  p { margin:0; } .heading + .summary { color:light-dark(#555,#c0c0c5); margin:12px 0 20px; font-size:13px; }
  label { display:grid; grid-template-columns:160px minmax(0,1fr); align-items:center; column-gap:14px; row-gap:6px; margin:14px 0; font-weight:400; line-height:1.5; } label > span { text-align:right; } label > small { grid-column:2; }
  input,select { display:block; min-width:0; width:100%; min-height:34px; padding:6px 10px; font:inherit; color:inherit; background:light-dark(#fff,#323235); border:1px solid #8885; border-radius:8px; } select { appearance:none; -webkit-appearance:none; height:36px; min-height:36px; line-height:20px; padding:7px 34px 7px 12px; border-color:transparent; background:light-dark(#eeeef0,#39393c) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'%3E%3Cpath d='m3 6 3-3 3 3m-6 4 3 3 3-3' fill='none' stroke='%23777' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 12px center; }
  input:focus,select:focus { outline:3px solid #087cf050; outline-offset:1px; } small { display:block; font-weight:400; color:light-dark(#59595f,#c0c0c5); font-size:13px; line-height:1.55; }
  button { min-height:34px; border:1px solid #8885; border-radius:9px; padding:6px 14px; cursor:pointer; font:inherit; color:inherit; background:light-dark(#fff,#414145); box-shadow:0 1px 2px #0001; } button.primary { color:white; background:#087cf0; border-color:#087cf0; } button:disabled { opacity:.5; cursor:default; }
  .buttons { display:flex; flex-wrap:wrap; gap:10px; justify-content:flex-end; position:sticky; bottom:calc(-1 * var(--panel-padding)); z-index:1; margin:24px calc(-1 * var(--panel-padding)) calc(-1 * var(--panel-padding)); padding:16px var(--panel-padding); border-top:1px solid #8883; background:light-dark(#f6f6f8ed,#28282bef); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); }
  .error { color:light-dark(#a5221a,#ffaca5); font-size:13px; white-space:pre-line; margin-top:14px; } .error:empty,.summary:empty,small:empty { display:none; }
  a,button.link { color:light-dark(#0067ce,#78bdff); } a { text-decoration:none; } a:hover { text-decoration:underline; } .note { font-size:13px; line-height:1.55; color:light-dark(#59595f,#c0c0c5); }
  .check { display:flex; align-items:flex-start; gap:9px; font-weight:400; margin:12px 0; } .check input { flex:none; width:17px; height:17px; min-height:0; margin:2px 0 0; padding:0; accent-color:#087cf0; } .check > span { text-align:left; }
  .authors { max-height:156px; overflow:auto; margin:12px 0 0 174px; border:1px solid #8884; border-radius:8px; padding:0 12px; background:light-dark(#f2f2f4,#303034); }
  .summary { white-space:pre-line; overflow-wrap:anywhere; } .row { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; justify-content:space-between; margin:14px 0; } .row .field-title { font-weight:400; } button.link { text-align:left; background:none; border:0; padding:0; box-shadow:none; } button:focus-visible,a:focus-visible,summary:focus-visible { outline:3px solid #087cf050; outline-offset:3px; }
  .configuration-backdrop { align-items:flex-start; padding-top:clamp(12px,3vh,28px); padding-bottom:20px; }
  .configuration { max-height:calc(100vh - clamp(12px,3vh,28px) - 20px); transform-origin:top center; width:640px; padding:0; overflow:hidden; display:flex; flex-direction:column; transition:height .24s cubic-bezier(.22,.61,.36,1); }
  .configuration > .heading { justify-content:center; padding:14px 28px 10px; flex:none; } .configuration > .heading img { width:22px; height:22px; } .configuration h2 { font-size:18px; line-height:26px; letter-spacing:0; } .configuration:lang(zh-Hans) h2 { font-family:"PingFang SC","PingFang TC",-apple-system,sans-serif; } .configuration:lang(zh-Hant) h2 { font-family:"PingFang TC","PingFang SC",-apple-system,sans-serif; } .configuration > .summary { display:none; }
  .tabs { display:flex; justify-content:center; gap:8px; flex:none; padding:4px 24px 10px; border-bottom:1px solid #8883; background:light-dark(#f7f7f9,#29292d); }
  .tabs button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-width:120px; max-width:180px; min-height:58px; padding:5px 12px; border:1px solid transparent; background:none; box-shadow:none; color:light-dark(#606067,#b9b9c1); font-size:13px; line-height:1.3; transition:color .15s ease,background .15s ease,box-shadow .15s ease; }
  .tabs svg { width:26px; height:26px; flex:none; } .tabs button[aria-selected=true] { color:light-dark(#007aff,#72baff); background:linear-gradient(160deg,#ffffffb0,#ffffff28); border-color:#8883; box-shadow:inset 0 1px 0 #ffffff70,0 2px 8px #00000008; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
  @media(prefers-color-scheme:dark) { .tabs button[aria-selected=true] { background:linear-gradient(160deg,#ffffff16,#ffffff06); } }
  .configuration-content { flex:1 1 auto; min-height:0; overflow:auto; padding:18px 28px; scrollbar-gutter:stable; } .configuration-body { display:flow-root; } .site-fields { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:16px; margin-bottom:20px; } .configuration .site-fields label { margin:0; }
  .configuration label:not(.check) { grid-template-columns:minmax(0,1fr); gap:6px; } .configuration label > span { text-align:left; } .configuration label > small { grid-column:1; } .configuration .field-title,.configuration label > span { font-weight:500; }
  .configuration .buttons { position:static; flex:none; margin:0; padding:16px 28px; } .configuration > .error { flex:none; padding:0 28px 14px; margin:0; }
  .settings-group { padding:0; margin:0; } .token-group { padding-bottom:16px; border-bottom:1px solid #8883; margin-bottom:16px; } .token-group > label { margin:0; } .token-help { margin-top:8px; }
  .tab-stage { display:flow-root; } [role=tabpanel]:not([hidden]) { animation:pane-in .18s ease-out; }
  .connection-row { display:flex; align-items:flex-start; gap:12px; margin:0 0 20px; } .author-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 6px; }
  .connection-controls { flex:1; min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:10px 14px; } .connection-controls .status { padding-top:6px; margin:0; min-width:0; overflow-wrap:anywhere; } .connection-row > .field-title { padding-top:6px; } .connection-controls button { grid-column:2; grid-row:1; }
  .configuration [role=tabpanel] > label { margin:0 0 20px; } .configuration [role=tabpanel] > label:last-child { margin-bottom:0; } .author-heading button { min-height:0; } .configuration .author-group { margin-top:20px; } .configuration .authors { margin:0; padding:0; border:0; border-radius:0; max-height:none; overflow:visible; background:none; } .author-choices { margin-top:10px; border:0; background:none; } .author-choices .check { margin:8px 0; padding:0; } .author-choices .check:last-child { margin-bottom:0; } .author-choices[aria-disabled=true] { opacity:.5; } .author-labels { display:flex; align-items:center; flex-wrap:wrap; gap:8px 18px; } .author-labels .check { margin:0; font-weight:400; } .author-status { margin-top:8px; overflow-wrap:anywhere; } .password-fields { margin:14px 0 18px; padding:14px 16px; border:1px solid #8883; border-radius:10px; background:light-dark(#f2f2f4,#303034); } .password-fields label { margin:0 0 12px; } .password-fields label:last-of-type { margin-bottom:8px; } .security-status { margin:0 0 12px; } .recovery-help { margin-top:16px; } .author-status { margin-top:8px; overflow-wrap:anywhere; }
  .security-group { padding:0; } .security-group > .rollback-action { display:block; margin-top:18px; } .recovery-navigation { margin-top:14px; font-size:13px; line-height:1.55; color:light-dark(#59595f,#c0c0c5); } .configuration .security-group > .check { margin:0 0 8px; } .security-group .row { justify-content:flex-start; gap:10px; margin:14px 0; }
  .configuration > .usage { flex:none; margin:0; padding:12px 28px 14px; } .usage { padding-top:14px; border-top:1px solid #8883; margin-top:14px; } .usage h3 { font-size:13px; font-weight:600; margin:0 0 7px; } .usage p { font-size:13px; color:light-dark(#59595f,#c0c0c5); line-height:1.55; margin:7px 0 0; }
  details { margin-top:16px; border:1px solid #8883; border-radius:10px; background:light-dark(#f4f4f6,#303034); } summary { list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 16px; font-size:14px; } summary::-webkit-details-marker { display:none; } summary::after { content:''; width:6px; height:6px; border-top:1.4px solid #888; border-right:1.4px solid #888; transform:rotate(45deg); flex:none; transition:transform .15s; } details[open] > summary::after { transform:rotate(135deg); } .details-body { padding:4px 16px 16px; border-top:1px solid #8882; } .details-body label { grid-template-columns:140px minmax(0,1fr); } .details-body label:last-child { margin-bottom:0; }
  .review { display:grid; grid-template-columns:160px minmax(0,1fr); align-items:baseline; gap:12px 14px; margin:18px 0 0; padding:18px; background:light-dark(#f1f1f3,#303034); border-radius:10px; } .review dt { text-align:right; color:light-dark(#59595f,#c0c0c5); } .review dd { margin:0; overflow-wrap:anywhere; }
  .progress { display:flex; align-items:center; gap:12px; margin-top:20px; } .spinner { width:20px; height:20px; flex:none; border:2px solid #8884; border-top-color:#087cf0; border-radius:50%; animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } } @keyframes pane-in { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } } @keyframes dialog-in { from { opacity:0; transform:scale(.99); } to { opacity:1; transform:scale(1); } }
  @media(prefers-reduced-motion:reduce) { *,*::after { animation:none !important; transition:none !important; } } @media(prefers-reduced-transparency:reduce) { .buttons { background:light-dark(#f6f6f8,#28282b); backdrop-filter:none; -webkit-backdrop-filter:none; } .tabs button[aria-selected=true] { background:light-dark(#fff,#414145); backdrop-filter:none; -webkit-backdrop-filter:none; } }
  @media(prefers-contrast:more) { small,.note,.usage p,.review dt,.heading + .summary { color:light-dark(#333,#eee); } input,select,button { border-color:light-dark(#555,#aaa); } }
  @media(max-width:520px) { .backdrop { padding:12px; } .panel { --panel-padding:20px; max-height:calc(100vh - 24px); } .configuration-content { padding:18px 20px; } .configuration > .heading { padding:16px 20px 6px; } .tabs { padding:8px 12px 12px; gap:3px; } .tabs button { min-width:0; flex:1; padding:7px 5px; font-size:12px; } label,.review,.connection-row,.author-heading,.details-body label { grid-template-columns:minmax(0,1fr); gap:6px; } label > span,.review dt,.connection-row > .field-title,.author-heading > .field-title { text-align:left; } label > small { grid-column:1; } .author-help,.authors { margin-left:0; } .review dd + dt { margin-top:6px; } .configuration > .usage { padding:10px 20px 12px; } .tab-stage { display:flow-root; } }
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
    let closed = false, dispose;
    const finish = value => { if (closed) return; closed = true; dispose?.(); host.remove(); previousFocus?.focus(); resolve(value); };
    const getValues = () => Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value]));
    dispose = mount?.({ inputs, panel, finish, getValues, isClosed: () => closed, setError: text => { error.textContent = text; }, setLoading: value => { submit.disabled = value; } });
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

function fitConfiguration(panel, section, body) {
  const view = panel.ownerDocument.defaultView;
  const request = view.requestAnimationFrame?.bind(view) ?? (callback => view.setTimeout(callback, 0));
  const cancel = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
  let frame, disposed = false;
  function schedule() {
    if (disposed || frame !== undefined) return;
    frame = request(() => {
      frame = undefined;
      if (disposed || !panel.isConnected) return;
      const style = view.getComputedStyle(section);
      // Use layout dimensions so opening transforms do not shrink the measured frame.
      const content = body.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const chrome = [...panel.children].filter(child => child !== section).reduce((height, child) => height + child.offsetHeight, 4);
      if (content + chrome <= 2) return;
      const backdropStyle = view.getComputedStyle(panel.parentElement);
      const limit = Math.max(120, view.innerHeight - parseFloat(backdropStyle.paddingTop) - parseFloat(backdropStyle.paddingBottom));
      panel.style.height = Math.ceil(Math.min(content + chrome, limit)) + 'px';
    });
  }
  const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : undefined;
  observer?.observe(body);
  for (const child of panel.children) if (child !== section) observer?.observe(child);
  view.addEventListener('resize', schedule);
  schedule();
  return () => { disposed = true; observer?.disconnect(); view.removeEventListener('resize', schedule); if (frame !== undefined) cancel(frame); };
}

function addHeading(panel, title) {
  const heading = document.createElement('div'); heading.className = 'heading'; panel.append(heading);
  const icon = document.createElement('img'); icon.src = 'data:image/png;base64,' + menuIcon; icon.alt = ''; heading.append(icon);
  const text = document.createElement('h2'); text.textContent = title; heading.append(text);
}

function tabIcon(index) {
  const paths = [
    ['M8 7H6a4 4 0 0 0 0 8h2', 'M16 7h2a4 4 0 0 1 0 8h-2', 'M7 11h10', 'M12 3v3', 'M12 18v3'],
    ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M8 3v6', 'M16 9v6', 'M10 15v6'],
    ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14v11H5z', 'M12 14v3'],
  ];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  for (const d of paths[index]) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.append(path); }
  return svg;
}

export function configure(initial = {}, services = {}) {
  const api = {
    getAccountUsername: config => new Client(config).getAccountUsername(),
    listSites: config => new Client(config).listSites(),
    listAuthors: config => new Client(config).listAuthors(),
    ...services,
  };
  let existingEncrypted = Boolean(initial.hasEncryptedToken), locked = Boolean(initial.tokenLocked), authorProfiles = initial.authorProfiles, siteCache = initial.siteCache;
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
      { name: 'encryptionPassword', label: tr('本机加密密码'), type: 'password' },
      { name: 'encryptionConfirmation', label: tr('再次输入本机加密密码'), type: 'password' },
    ],

    submitLabel: tr('保存配置'), validate: input => {
      if (verifiedToken !== input.token.trim()) throw new Error(tr('请先读取账号与站点，或切换到手动配置填写账号和站点信息。'));
      if (input.encryptToken && !existingEncrypted) {
        if (input.encryptionPassword.length < 12) throw new Error(tr('本机加密密码至少需要 12 个字符。'));
        if (input.encryptionPassword !== input.encryptionConfirmation) throw new Error(tr('两次输入的密码不一致。'));
      }
      const validated = validateConfig({ ...input, token: locked ? 'encrypted-token-retained' : input.token });
      return { ...validated, token: locked ? '' : validated.token, encryptToken: input.encryptToken,
        ...(existingEncrypted ? { preserveToken: true } : {}),
        ...(input.encryptToken && !existingEncrypted ? { encryptionPassword: input.encryptionPassword } : {}),
        ...(authorProfiles ? { authorProfiles } : {}),
        ...(siteCache ? { siteCache: { ...siteCache, username: validated.username } } : {}),
      };
    },
    mount: ({ inputs, panel, finish, getValues, isClosed, setError, setLoading }) => {
      panel.classList.add('configuration'); panel.parentElement.classList.add('configuration-backdrop');
      const section = document.createElement('div'); section.className = 'configuration-content'; inputs.token.closest('label').after(section);
      const body = document.createElement('div'); body.className = 'configuration-body'; section.append(body);
      const tokenGroup = document.createElement('div'); tokenGroup.className = 'settings-group token-group'; body.append(tokenGroup); tokenGroup.append(inputs.token.closest('label'));
      const tokenHelp = document.createElement('small'); tokenHelp.className = 'token-help'; tokenGroup.append(tokenHelp);
      const tokenLink = document.createElement('a'); tokenLink.href = 'https://typlog.com/account/tokens'; tokenLink.textContent = tr('API 密钥页面'); tokenLink.target = '_blank'; tokenLink.rel = 'noopener noreferrer'; tokenLink.setAttribute('aria-label', tr('获取 API Token：') + tokenLink.href); tokenLink.onclick = event => { event.preventDefault(); window.open(tokenLink.href, '_blank'); };
      inputs.token.disabled = existingEncrypted; inputs.token.required = !existingEncrypted;
      if (locked) inputs.token.placeholder = tr('已有 Token 已加密；无需解锁即可修改设置。');
      tokenHelp.append(document.createTextNode(tr('登录 Typlog 后，在 ')), tokenLink, document.createTextNode(tr('，点击「+ 新密钥」，输入名称，权限勾选 profile 和 site 复选框，可生成新 API Token，将其复制到这里。')));
      const tabs = document.createElement('div'); tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', tr('配置方式')); panel.querySelector('.heading').after(tabs);
      const stage = document.createElement('div'); stage.className = 'tab-stage'; body.append(stage);
      const automatic = document.createElement('div'); automatic.setAttribute('role', 'tabpanel'); automatic.id = 'typlog-auto-panel'; stage.append(automatic);
      const advancedBody = document.createElement('div'); advancedBody.className = 'settings-group'; advancedBody.setAttribute('role', 'tabpanel'); advancedBody.id = 'typlog-manual-panel'; advancedBody.hidden = true; stage.append(advancedBody);
      const security = document.createElement('div'); security.className = 'settings-group security-group'; security.setAttribute('role', 'tabpanel'); security.id = 'typlog-storage-panel'; security.hidden = true; stage.append(security);
      const panes = [automatic, advancedBody, security];
      const tabButtons = [tr('自动配置'), tr('手动配置'), tr('Token 保存')].map((title, index) => {
        const tab = document.createElement('button'); tab.type = 'button'; tab.append(tabIcon(index)); const caption = document.createElement('span'); caption.textContent = title; tab.append(caption); tab.setAttribute('role', 'tab'); tab.id = 'typlog-tab-' + index; tab.setAttribute('aria-controls', panes[index].id); tabs.append(tab); return tab;
      });
      panes.forEach((pane, index) => pane.setAttribute('aria-labelledby', tabButtons[index].id));
      function selectTab(index) {
        section.scrollTop = 0;
        panes.forEach((pane, n) => { pane.hidden = n !== index; });
        tabButtons.forEach((tab, n) => { tab.setAttribute('aria-selected', String(n === index)); tab.tabIndex = n === index ? 0 : -1; });
      }
      tabButtons.forEach((tab, index) => {
        tab.onclick = () => selectTab(index);
        tab.onkeydown = event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3; selectTab(next); tabButtons[next].focus(); }
        };
      });
      selectTab(services.initialTab === 'storage' ? 2 : 0);
      const connectionRow = document.createElement('div'); connectionRow.className = 'connection-row'; automatic.append(connectionRow);
      const accountTitle = document.createElement('span'); accountTitle.className = 'field-title'; accountTitle.textContent = tr('账号'); connectionRow.append(accountTitle);
      const connectionControls = document.createElement('div'); connectionControls.className = 'connection-controls'; connectionRow.append(connectionControls);
      const connect = document.createElement('button'); connect.type = 'button'; connect.textContent = tr('读取账号与站点'); connectionControls.append(connect);
      const account = document.createElement('small'); account.className = 'status'; account.setAttribute('role', 'status'); connectionControls.prepend(account);
      const blogGroup = document.createElement('div'); blogGroup.className = 'settings-group'; automatic.append(blogGroup);
      const siteLabel = document.createElement('label'); const siteTitle = document.createElement('span'); siteTitle.textContent = tr('站点'); siteLabel.append(siteTitle); blogGroup.append(siteLabel);
      const picker = document.createElement('select'); picker.setAttribute('aria-label', tr('站点')); siteLabel.append(picker);
      const siteNote = document.createElement('small'); siteLabel.append(siteNote);
      const authorSection = document.createElement('div'); authorSection.className = 'settings-group author-group'; automatic.append(authorSection);
      const authorRow = document.createElement('div'); authorRow.className = 'row author-heading'; authorSection.append(authorRow);
      const authorTitle = document.createElement('span'); authorTitle.className = 'field-title'; authorTitle.textContent = tr('作者'); authorRow.append(authorTitle);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'link'; button.textContent = tr('刷新作者'); authorRow.append(button);
      const authorLabels = document.createElement('div'); authorLabels.className = 'author-labels'; authorRow.prepend(authorLabels); authorLabels.append(authorTitle);
      const noneLabel = document.createElement('label'); noneLabel.className = 'check';
      const none = document.createElement('input'); none.type = 'checkbox'; noneLabel.append(none, document.createTextNode(tr('不设作者'))); authorLabels.append(noneLabel);
      const authorOptions = document.createElement('div'); authorOptions.className = 'author-choices'; authorOptions.hidden = true; authorOptions.setAttribute('role', 'group'); authorOptions.setAttribute('aria-label', tr('作者')); authorSection.append(authorOptions);
      const selected = document.createElement('small'); selected.className = 'author-status'; selected.setAttribute('role', 'status'); authorSection.append(selected);
      const box = document.createElement('div'); box.className = 'authors'; box.hidden = true; authorOptions.append(box);
      for (const key of ['username', 'slug', 'siteId', 'authorIds']) advancedBody.append(inputs[key].closest('label'));
      const siteFields = document.createElement('div'); siteFields.className = 'site-fields'; inputs.slug.closest('label').before(siteFields);
      siteFields.append(inputs.slug.closest('label'), inputs.siteId.closest('label'));
      const instructions = document.createElement('div'); instructions.className = 'usage'; section.after(instructions);
      const instructionsTitle = document.createElement('h3'); instructionsTitle.textContent = tr('使用说明'); instructions.append(instructionsTitle);
      const instructionsText = document.createElement('p'); instructionsText.textContent = tr('站点需在 Settings → Integrations 启用 XML-RPC。首次读取图片，在 File → Grant Folder Access 授权图片目录。'); instructions.append(instructionsText);
      const privacy = document.createElement('p'); instructions.append(privacy);
      const securityStatus = document.createElement('small'); securityStatus.className = 'security-status'; security.append(securityStatus);
      security.append(inputs.encryptToken.closest('label'));
      const securityHelp = document.createElement('small'); securityHelp.textContent = tr('Token 默认以明文保存在本机。可选独立密码加密，防止已有 Token 被直接从配置文件读取；本机加密密码与 Typlog 登录密码无关，且不会保存。'); security.append(securityHelp);
      const passwordFields = document.createElement('div'); passwordFields.className = 'password-fields'; security.append(passwordFields);
      passwordFields.append(inputs.encryptionPassword.closest('label'), inputs.encryptionConfirmation.closest('label'));
      const passwordNote = document.createElement('small'); passwordNote.textContent = tr('至少 12 个字符。退出应用再打开或新建文档窗口后，首次发布时需要输入此密码；打开设置无需输入。'); passwordFields.append(passwordNote);
      const rollback = document.createElement('button'); rollback.type = 'button'; rollback.className = 'rollback-action'; rollback.textContent = tr('改回明文保存…'); security.append(rollback);
      const updateStorage = () => {
        passwordFields.hidden = !inputs.encryptToken.checked || existingEncrypted;
        inputs.encryptionPassword.required = inputs.encryptionConfirmation.required = false;
        inputs.encryptToken.disabled = existingEncrypted;
        rollback.hidden = !existingEncrypted;
        securityStatus.textContent = existingEncrypted ? tr('已有 Token 已加密保存。修改普通设置无需密码。') : '';
        privacy.textContent = inputs.encryptToken.checked ? tr('Token 使用独立密码加密；首次发布时解锁，打开设置无需密码。') : tr('Token 以明文保存在本机，无需解锁。可在「Token 保存」中启用加密。请勿分享配置文件。');
      };
      inputs.encryptToken.onchange = updateStorage; updateStorage();
      rollback.onclick = async () => {
        setLoading(true); rollback.disabled = true; setError('');
        try {
          const value = await api.rollbackToken?.();
          if (value === undefined || isClosed()) return;
          const restoredToken = typeof value === 'string' ? value : value.token;
          if (value.siteCache) { siteCache = value.siteCache; sites = siteCache.sites; renderSites(); picker.value = inputs.siteId.value; }
          if (value.username) inputs.username.value = value.username;
          inputs.token.value = restoredToken; inputs.token.disabled = false; inputs.token.required = true; inputs.token.placeholder = '';
          verifiedToken = restoredToken.trim(); locked = false; existingEncrypted = false; inputs.encryptToken.checked = false; updateStorage();
          connect.disabled = button.disabled = false;
        } catch (error) { setError(safeError(error, { token: inputs.token.value })); }
        finally { if (!isClosed()) { setLoading(false); rollback.disabled = false; } }
      };
      const recoveryHelp = document.createElement('small'); recoveryHelp.className = 'recovery-help'; recoveryHelp.textContent = tr('忘记本机加密密码？可直接替换新 Token，无需旧密码；不再需要发布时，可删除本机 Token。站点配置和草稿关联会保留。'); security.append(recoveryHelp);
      const securityActions = document.createElement('div'); securityActions.className = 'row'; security.append(securityActions);
      const replaceToken = document.createElement('button'); replaceToken.type = 'button'; replaceToken.textContent = tr('替换 Token…'); securityActions.append(replaceToken);
      replaceToken.onclick = async () => {
        if (!await (api.confirmReplacement ?? confirmTokenReplacement)() || isClosed()) return;
        existingEncrypted = false; locked = false; inputs.token.disabled = false; inputs.token.required = true; inputs.token.placeholder = '';
        inputs.token.value = ''; inputs.encryptToken.checked = false; inputs.encryptionPassword.value = inputs.encryptionConfirmation.value = ''; updateStorage();
        inputs.token.dispatchEvent(new document.defaultView.Event('input', { bubbles: true })); selectTab(0); inputs.token.focus();
      };
      const removeToken = document.createElement('button'); removeToken.type = 'button'; removeToken.textContent = tr('删除本机 Token…'); removeToken.disabled = !(initial.hasStoredToken ?? initial.token) || !api.removeToken; securityActions.append(removeToken);
      removeToken.onclick = async () => {
        setLoading(true); removeToken.disabled = true;
        try { if (await api.removeToken()) finish({ removed: true }); }
        catch (error) { setError(safeError(error, { token: inputs.token.value })); }
        finally { if (!isClosed()) { setLoading(false); removeToken.disabled = false; } }
      };
      let sites = siteCache?.username === initial.username && Array.isArray(siteCache?.sites) ? [...siteCache.sites] : [], authors, authorScope, generation = 0;
      // An existing blank author setting is deliberate and survives refresh/restart.
      let wantsNone = Boolean(initial.siteId && initial.authorIds === '');
      none.checked = wantsNone;
      let rememberedIds = initial.authorIds ?? '';
      const token = () => inputs.token.value.trim();
      const stamp = () => JSON.stringify([token(), inputs.siteId.value, inputs.slug.value]);
      const current = ticket => !isClosed() && ticket === generation;
      function loading(value) { setLoading(value); connect.disabled = value || locked; button.disabled = value || locked; picker.disabled = value; }
      function begin() { const ticket = ++generation; loading(true); setError(''); return ticket; }
      function end(ticket) { if (current(ticket)) loading(false); }
      function resetAuthors() { authors = undefined; authorScope = undefined; box.replaceChildren(); box.hidden = true; authorOptions.hidden = true; selected.hidden = false; selected.textContent = ''; }
      function updateAuthors() {
        none.checked = wantsNone; authorOptions.setAttribute('aria-disabled', String(wantsNone));
        if (!authors || stamp() !== authorScope) return;
        const ids = splitTags(wantsNone ? rememberedIds : inputs.authorIds.value);
        if (!wantsNone) rememberedIds = inputs.authorIds.value;
        selected.hidden = false;
        try {
          selectedAuthorLabels(inputs.authorIds.value, authors);
          selected.textContent = authors.length ? '' : tr('本站暂无作者，不设作者。');
        } catch (error) { selected.textContent = error.message; }
        for (const check of box.querySelectorAll('input')) { check.checked = ids.includes(check.value); check.disabled = wantsNone; }
      }
      none.onchange = () => {
        if (none.checked) { rememberedIds = inputs.authorIds.value || rememberedIds; inputs.authorIds.value = ''; }
        else inputs.authorIds.value = rememberedIds || authors?.[0]?.id || '';
        wantsNone = none.checked; updateAuthors();
      };
      async function loadAuthors(ticket) {
        const config = getValues();
        if (!/^[1-9]\d*$/.test(config.siteId) || !config.slug || !config.token.trim()) throw new Error(tr('请先读取并选择站点，或切换到手动配置填写站点信息。'));
        const requestedScope = stamp();
        selected.hidden = false; selected.textContent = tr('正在获取本站作者…');
        let result;
        try { result = await api.listAuthors(config); }
        catch (error) { if (current(ticket) && stamp() === requestedScope) selected.textContent = ''; throw error; }
        if (!current(ticket) || stamp() !== requestedScope) return;
        authorProfiles = { siteId: inputs.siteId.value, slug: inputs.slug.value, authors: result };
        renderAuthors(result, requestedScope);
      }
      function renderAuthors(result, requestedScope) {
        authors = result; authorScope = requestedScope; box.replaceChildren();
        if (!authors.length) { inputs.authorIds.value = ''; wantsNone = true; }
        else if (!wantsNone && !inputs.authorIds.value.trim()) inputs.authorIds.value = authors[0].id;
        if (authors.length && !rememberedIds) rememberedIds = authors[0].id;
        for (const author of authors) {
          const label = document.createElement('label'); label.className = 'check';
          const check = document.createElement('input'); check.type = 'checkbox'; check.value = author.id;
          label.append(check, document.createTextNode(authorLabel(author))); box.append(label);
          check.onchange = () => {
            if (wantsNone) return;
            inputs.authorIds.value = [...box.querySelectorAll('input:checked')].map(input => input.value).join(', ');
            updateAuthors();
          };
        }
        box.hidden = authorOptions.hidden = !authors.length;
        updateAuthors();
      }
      async function chooseSite(site, ticket) {
        if (inputs.siteId.value !== site.id || inputs.slug.value !== site.slug) {
          inputs.authorIds.value = ''; rememberedIds = ''; wantsNone = false; resetAuthors();
        }
        inputs.siteId.value = site.id; inputs.slug.value = site.slug;
        siteNote.textContent = '';
        if (locked) {
          if (authorProfiles?.siteId === site.id && authorProfiles?.slug === site.slug) renderAuthors(authorProfiles.authors, stamp());
          else { resetAuthors(); selected.textContent = tr('作者列表尚未缓存，可在手动配置中修改作者 ID。'); }
        } else await loadAuthors(ticket);
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
            account.textContent = tr('@{username}', { username: userResult.value });
          } else {
            account.textContent = inputs.username.value ? tr('@{username}（已保存）', { username: inputs.username.value }) : tr('账号用户名未获取，可切换到手动配置填写。');
            warnings.push(/HTTP (401|403)/.test(userResult.reason?.message) ? tr('读取 username 需要 profile 权限；也可在「手动配置」中填写。') : tr('账号读取失败：') + safeError(userResult.reason, { token: requestedToken }));
          }
          if (sitesResult.status === 'fulfilled') {
            sites = sitesResult.value; siteCache = { username: inputs.username.value, sites }; renderSites();
            const chosen = sites.length === 1 ? sites[0] : sites.find(site => site.id === inputs.siteId.value && site.slug === inputs.slug.value);
            if (chosen) { picker.value = chosen.id; await chooseSite(chosen, ticket); }
            else {
              inputs.siteId.value = ''; inputs.slug.value = ''; inputs.authorIds.value = ''; rememberedIds = ''; wantsNone = false; resetAuthors(); none.checked = false;
              siteNote.textContent = sites.length ? tr('请选择一个站点。') : tr('此 Token 未返回可访问的活跃站点，请检查 site 权限或账号站点状态。');
            }
          } else {
            warnings.push(tr('读取站点列表失败：') + safeError(sitesResult.reason, { token: requestedToken }) + tr(' 请检查 site 权限。'));
            renderSites();
            if (inputs.siteId.value && inputs.slug.value) {
              if (!sites.some(site => site.id === inputs.siteId.value)) {
                const option = document.createElement('option'); option.value = inputs.siteId.value; option.textContent = inputs.slug.value + tr('（已保存的站点）'); picker.append(option);
              }
              picker.value = inputs.siteId.value;
              siteNote.textContent = tr('暂时使用已保存的站点配置，可重试或手动修改。');
              await loadAuthors(ticket);
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
        try { await loadAuthors(ticket); }
        catch (error) { if (current(ticket)) setError(tr('获取作者失败：') + safeError(error, { token: token() })); }
        finally { end(ticket); }
      };
      inputs.token.addEventListener('input', () => {
        ++generation; loading(false); verifiedToken = ''; siteCache = undefined; sites = []; authorProfiles = undefined; rememberedIds = ''; renderSites(); account.textContent = ''; siteNote.textContent = ''; resetAuthors();
        for (const key of ['username', 'slug', 'siteId', 'authorIds']) inputs[key].value = '';
        wantsNone = false; none.checked = false; setError('');
      });
      for (const key of ['username', 'slug', 'siteId', 'authorIds']) inputs[key].addEventListener('input', () => {
        if (key === 'authorIds') { wantsNone = !inputs.authorIds.value.trim(); rememberedIds = inputs.authorIds.value; updateAuthors(); }
        else { ++generation; loading(false); verifiedToken = token(); resetAuthors(); picker.value = ''; siteNote.textContent = tr('正在使用手动填写的账号和站点配置。'); }
      });
      renderSites();
      if (initial.username) account.textContent = tr('@{username}', { username: initial.username });
      if (initial.siteId && initial.slug) {
        if (!sites.some(site => site.id === initial.siteId)) sites.push({ id: initial.siteId, slug: initial.slug });
        renderSites(); picker.value = initial.siteId;
      }
      if (authorProfiles && authorProfiles.siteId === initial.siteId && authorProfiles.slug === initial.slug) renderAuthors(authorProfiles.authors, stamp());
      if (locked) {
        connect.disabled = button.disabled = true;
        siteNote.textContent = tr('已有 Token 尚未解锁。发布时输入密码后可在线刷新，或替换新 Token。');
        if (!(authorProfiles && authorProfiles.siteId === initial.siteId && authorProfiles.slug === initial.slug)) selected.textContent = tr('作者列表尚未缓存，可在手动配置中修改作者 ID。');
      } else if (initial.token && !siteCache) void discover();
      else if (initial.token && !(authorProfiles && authorProfiles.siteId === initial.siteId && authorProfiles.slug === initial.slug)) {
        const ticket = begin();
        void loadAuthors(ticket).catch(error => { if (current(ticket)) setError(safeError(error, { token: token() })); }).finally(() => end(ticket));
      }
      return fitConfiguration(panel, section, body);
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

export function confirmMissingDraft(config, postId) {
  return form({
    title: tr('原草稿不存在'),
    description: tr('在站点 {site} 中找不到原草稿（ID {id}）。它可能已在后台删除。是否使用当前文档新建草稿？', { site: config.slug, id: postId }),
    note: tr('新草稿创建成功后，将自动重新关联当前文档。取消则保留原关联。'),
    fields: [], submitLabel: tr('新建草稿'), validate: () => true,
  }).then(Boolean);
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

    ],
    note: tr('这是为此扩展设置的独立密码，与 Typlog 登录密码无关。'),
    submitLabel: tr('继续'),
    mount: ({ panel, finish }) => {
      const guidance = document.createElement('p'); guidance.className = 'recovery-navigation'; panel.querySelector('.note').after(guidance);
      const link = document.createElement('a'); link.href = '#typlog-settings'; link.textContent = tr('Typlog 发布配置');
      guidance.append(document.createTextNode(tr('如果您不记得本机加密密码，可到 ')), link, document.createTextNode(tr(' 替换现有 Token。')));
      link.onclick = event => { event.preventDefault(); finish({ settings: true }); };
    },
    validate: input => {
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

export function confirmTokenReplacement() {
  return form({
    title: tr('替换本机 Token？'),
    description: tr('保存新 Token 后，会覆盖本机旧 Token 或加密记录，无法从此配置恢复旧 Token。请先准备有 profile 和 site 权限的新 Token。'),
    note: tr('取消或尚未保存时，旧记录保留。站点配置和草稿关联不会删除；Typlog 上的旧 Token 不会被撤销。'),
    fields: [], submitLabel: tr('填写新 Token'), validate: () => true,
  }).then(Boolean);
}
