import { tr } from './i18n.js';
import MarkdownIt from 'markdown-it';

export const MIMES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
const defaultValidateLink = md.validateLink;
md.validateLink = url => /^file:\/\//i.test(url) || defaultValidateLink(url);

export function splitTags(value) {
  return [...new Set(String(value ?? '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean))];
}

export function parseDocument(source) {
  let content = source.replace(/^\uFEFF/, '');
  let title = '', format = 'markdown', tags = [], hasTags = false;
  if (/^[ \t]*:::(?:typlog-shortcut)?[ \t]*\r?\n/.test(content)) {
    const block = content.match(/^[ \t]*:::(?:typlog-shortcut)?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*(?:\r?\n|$)/);
    if (!block) throw new Error(tr('元数据缺少结束的 :::。'));
    for (const line of block[1].split(/\r?\n/)) {
      const field = line.match(/^[ \t]*(title|tag|tags|format):[ \t]*(.*)$/);
      if (!field) continue;
      const [, key, value] = field;
      if (key === 'title') title = value.trim();
      if (key === 'tag' || key === 'tags') { tags.push(...splitTags(value)); hasTags = true; }
      if (key === 'format') {
        if (!['markdown', 'html'].includes(value.trim())) throw new Error(tr('format 只能是 markdown 或 html。'));
        format = value.trim();
      }
    }
    content = content.slice(block[0].length);
  }
  if (!title) {
    if (format === 'html') {
      title = new DOMParser().parseFromString(content, 'text/html').querySelector('h1')?.textContent.trim() || '';
    } else {
      const tokens = md.parse(content, {});
      const headingIndex = tokens.findIndex(token => token.type === 'heading_open' && token.tag === 'h1' && token.level === 0);
      if (headingIndex !== -1) {
        const heading = tokens[headingIndex];
        const inline = tokens[headingIndex + 1];
        title = (inline.children || []).map(token => ['softbreak', 'hardbreak'].includes(token.type) ? ' ' : token.type === 'html_inline' ? '' : token.content).join('').trim();
        // Preserve the existing omission of an opening title heading; keep later H1s in the body.
        const lines = content.match(/[^\n]*\n|[^\n]+$/g) || [];
        if (!lines.slice(0, heading.map[0]).join('').trim()) content = lines.slice(heading.map[1]).join('');
      }
    }
  }
  return { title, tags: [...new Set(tags)], hasTags, format, content };
}

export function normalizePath(path) {
  const result = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') result.pop(); else result.push(part);
  }
  return '/' + result.join('/');
}

export function resolveImagePath(src, parentPath, homePath) {
  if (/^(https?:)?\/\//i.test(src) || /^data:image\//i.test(src)) return null;
  let path = src;
  if (/^file:\/\//i.test(path)) {
    const url = new URL(path);
    if (url.hostname && url.hostname !== 'localhost') throw new Error(tr('不支持远程 file:// 图片。'));
    if (url.search || url.hash) throw new Error(tr('本地图片文件名中的 # 或 ? 请写成 %23 或 %3F。'));
    path = url.pathname;
  } else {
    path = path.replace(/^(?:image-loader|typlog-media):\/\//i, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(path)) throw new Error(tr('不支持的图片地址协议。'));
    if (/[?#]/.test(path)) throw new Error(tr('本地图片文件名中的 # 或 ? 请写成 %23 或 %3F。'));
  }
  try { path = decodeURIComponent(path); } catch { throw new Error(tr('图片地址包含无效的百分号编码。')); }
  if (path.includes('\0')) throw new Error(tr('无效的图片路径。'));
  if (path.startsWith('~/')) path = homePath + path.slice(1);
  if (!path.startsWith('/')) {
    if (!parentPath) throw new Error(tr('请先保存 Markdown 文档，以便定位相对路径图片。'));
    path = parentPath + '/' + path;
  }
  return normalizePath(path);
}

export function renderDocument(parsed, parser = new DOMParser()) {
  const html = parsed.format === 'html' ? parsed.content : md.render(parsed.content);
  // A detached document is never inserted into the live editor.
  const doc = parser.parseFromString(html, 'text/html');
  for (const node of doc.querySelectorAll('script, iframe, object, embed, base, link, meta')) node.remove();
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || (/^(href|src)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) node.removeAttribute(attr.name);
    }
  }
  for (const image of doc.querySelectorAll('img')) {
    // Older Shortcut documents encode dimensions inside the Markdown image title.
    const title = image.getAttribute('title') || '';
    const dimensions = title.match(/"?\s+((?:(?:width|height)="(?:\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)?|auto)"?\s*)+)$/);
    if (dimensions) {
      for (const [, name, value] of dimensions[1].matchAll(/(width|height)="([^"\s]+)"?/g)) image.setAttribute(name, value);
      image.setAttribute('title', title.slice(0, dimensions.index).trim());
    }
    // Match the Shortcut's stand-alone image figures, preferring title over alt.
    for (const dimension of ['width', 'height']) {
      const value = image.getAttribute(dimension);
      if (value && /^(?:\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)?|auto)$/.test(value)) {
        image.style[dimension] = /^\d+(?:\.\d+)?$/.test(value) ? value + 'px' : value;
      }
    }
    const parent = image.parentElement;
    if (parent?.tagName === 'P' && parent.children.length === 1 && !parent.textContent.trim()) {
      const figure = doc.createElement('figure');
      figure.setAttribute('style', 'text-align:center; margin:1em 0;');
      const caption = image.getAttribute('title') || image.getAttribute('alt');
      parent.replaceWith(figure); figure.appendChild(image);
      if (caption) { const text = doc.createElement('figcaption'); text.textContent = caption; figure.appendChild(text); }
    }
  }
  return doc;
}

export async function collectImages(doc, host, parentPath) {
  const assets = new Map();
  for (const node of doc.querySelectorAll('[srcset]')) {
    const sources = node.getAttribute('srcset');
    // Do not silently publish local paths from picture/srcset variants.
    if (!sources.split(',').every(x => /^https?:\/\//i.test(x.trim()))) {
      throw new Error(tr('srcset 中有本地图片。请先使用单一 img src 图片链接。'));
    }
  }
  for (const image of doc.querySelectorAll('img')) {
    const src = image.getAttribute('src');
    if (!src) throw new Error(tr('正文中有图片缺少 src 地址。'));
    if (/^(https?:)?\/\//i.test(src)) continue;
    let key, object, name;
    if (/^data:image\//i.test(src)) {
      const match = src.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z\d+/=\s]+)$/i);
      if (!match) throw new Error(tr('内嵌图片只支持 base64 编码的 JPEG、PNG、GIF、WebP。'));
      key = src;
      object = { mimeType: match[1].toLowerCase(), data: match[2].replace(/\s/g, '') };
      name = 'inline-' + (assets.size + 1) + '.' + (match[1].split('/')[1] === 'jpeg' ? 'jpg' : match[1].split('/')[1]);
    } else {
      key = resolveImagePath(src, parentPath, host.getDirectoryPath('home'));
      name = key.split('/').at(-1);
      if (assets.has(key)) { assets.get(key).nodes.push(image); continue; }
      const mimeType = MIMES[name.split('.').at(-1).toLowerCase()];
      if (!mimeType) throw new Error(tr('不支持图片格式：{name}（支持 JPEG、PNG、GIF、WebP）。', { name }));
      object = await host.getFileObject(key);
      if (!object?.data) throw new Error(tr('无法读取图片：{name}。请在 MarkEdit「文件 → 授予文件夹访问权限」中选择图片所在目录。', { name }));
      if (object.mimeType && object.mimeType !== mimeType) throw new Error(tr('图片扩展名和实际 MIME 类型不一致：{name}', { name }));
      object = { ...object, mimeType };
    }
    if (!/^(image\/jpeg|image\/png|image\/gif|image\/webp)$/.test(object.mimeType)) throw new Error(tr('不支持此图片类型。'));
    if (!assets.has(key)) assets.set(key, { name, data: object.data, mimeType: object.mimeType, nodes: [] });
    assets.get(key).nodes.push(image);
  }
  return [...assets.values()];
}

export function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function xmlValue(value) {
  if (typeof value === 'boolean') return '<value><boolean>' + Number(value) + '</boolean></value>';
  if (typeof value === 'number') return '<value><int>' + value + '</int></value>';
  if (typeof value === 'string') return '<value><string>' + xmlEscape(value) + '</string></value>';
  if (Array.isArray(value)) return '<value><array><data>' + value.map(xmlValue).join('') + '</data></array></value>';
  if (value && Object.hasOwn(value, '__base64')) return '<value><base64>' + value.__base64 + '</base64></value>';
  return '<value><struct>' + Object.entries(value).map(([key, item]) => '<member><name>' + xmlEscape(key) + '</name>' + xmlValue(item) + '</member>').join('') + '</struct></value>';
}

export function xmlCall(method, values) {
  return '<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>' + xmlEscape(method) + '</methodName><params>' + values.map(value => '<param>' + xmlValue(value) + '</param>').join('') + '</params></methodCall>';
}

export function decodeXmlResponse(text, parser = new DOMParser()) {
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.tagName !== 'methodResponse') throw new Error(tr('Typlog 返回了无效的 XML 响应。'));
  function value(node) {
    if (!node) throw new Error(tr('Typlog 响应缺少 value。'));
    const type = node.firstElementChild;
    if (!type) return node.textContent;
    if (['int', 'i4', 'double'].includes(type.tagName)) return Number(type.textContent);
    if (type.tagName === 'boolean') return type.textContent === '1';
    if (type.tagName === 'array') return [...type.querySelector('data').children].map(value);
    if (type.tagName === 'struct') return Object.fromEntries([...type.children].map(member => [member.querySelector('name').textContent, value([...member.children].find(x => x.tagName === 'value'))]));
    return type.textContent;
  }
  const fault = doc.querySelector('methodResponse > fault > value');
  if (fault) { const details = value(fault); const error = new Error(tr('Typlog XML-RPC 错误 {code}：{message}', { code: details.faultCode, message: details.faultString })); error.rpcFault = true; throw error; }
  return value(doc.querySelector('methodResponse > params > param > value'));
}

export function validateConfig(input) {
  const config = {
    slug: String(input.slug ?? '').trim(),
    siteId: String(input.siteId ?? '').trim().replace(/^#/, ''),
    username: String(input.username ?? '').trim(),
    token: String(input.token ?? '').trim(),
    authorIds: String(input.authorIds ?? '').trim(),
  };
  if (!/^[a-z\d_-]+$/i.test(config.slug)) throw new Error(tr('请填写有效的站点 slug（后台地址中 admin/ 后面的名称）。'));
  if (!/^[1-9]\d*$/.test(config.siteId)) throw new Error(tr('Site ID 应为正整数。'));
  if (!config.username || !config.token) throw new Error(tr('用户名和 API Token 不能为空。'));
  if (/[\r\n]/.test(config.token)) throw new Error(tr('Token 中不能含有换行。'));
  if (config.authorIds && !/^\d+(?:\s*[,，]\s*\d+)*$/.test(config.authorIds)) throw new Error(tr('作者 ID 请填写数字；多位作者用逗号分隔。'));
  if (config.authorIds && splitTags(config.authorIds).some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) throw new Error(tr('作者 ID 应为正整数。'));
  return config;
}

export function endpoint(config) { return 'https://typlog.com/s/' + encodeURIComponent(config.slug) + '/xmlrpc'; }
export function adminUrl(config, postId) { return 'https://typlog.com/admin/' + encodeURIComponent(config.slug) + '/posts/' + encodeURIComponent(postId); }
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
