import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const STATIC_DIR = join(ROOT, process.env.BLOG_OUT_DIR || 'docs');
const PORT = Number(process.env.BLOG_PORT || 8080);
const TOKEN = process.env.BLOG_TOKEN || '';
const ALLOWED_CATEGORIES = new Set(['quant', 'travel', 'life']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.7z': 'application/x-7z-compressed',
  '.zip': 'application/zip',
};

let building = false;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function authorize(req) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const queryToken = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
  return bearer === TOKEN || queryToken === TOKEN;
}

function safeFilename(name) {
  const base = name.replace(/\\/g, '/').split('/').pop() || '';
  if (!base || base.includes('..') || !/\.md$/i.test(base)) {
    throw new Error('无效文件名，须为 .md 且不能包含 ..');
  }
  const stem = base.slice(0, -3);
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(stem)) {
    return stem.toLowerCase() + '.md';
  }
  if (!/^[\w.\-\u4e00-\u9fff\u3400-\u4dbf\s]+$/u.test(stem)) {
    throw new Error('文件名包含非法字符');
  }
  return (
    stem
      .trim()
      .replace(/\s+/g, '-')
      .replace(/\.+/g, '.')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '') + '.md'
  );
}

function categoryFromPath(category) {
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error('分类必须是 quant、travel 或 life');
  }
  return category;
}

function saveMarkdown({ category, filename, content }) {
  const cat = categoryFromPath(category);
  const file = safeFilename(filename);
  const dir = join(CONTENT_DIR, cat);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, file);
  writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  return { path: `src/content/blog/${cat}/${file}`, slug: `${cat}/${file.replace(/\.md$/, '')}` };
}

function runBuild() {
  if (building) {
    throw new Error('站点正在构建中，请稍后再试');
  }
  building = true;
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
  } finally {
    building = false;
  }
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let relative = decoded;
  if (relative.endsWith('/')) relative += 'index.html';
  const abs = normalize(join(STATIC_DIR, relative));
  if (!abs.startsWith(STATIC_DIR)) return null;
  return abs;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = resolveStaticPath(url.pathname);
  if (!filePath || !existsSync(filePath)) {
    const fallback = resolveStaticPath(`${url.pathname.replace(/\/?$/, '')}/index.html`);
    if (fallback && existsSync(fallback)) filePath = fallback;
  }
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const data = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
  res.end(data);
  return true;
}

async function handlePublish(req, res) {
  if (!authorize(req)) {
    return json(res, 401, { success: false, error: '未授权，请提供正确的 BLOG_TOKEN' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { success: false, error: '请求体必须是 JSON' });
  }

  const { category, filename, content } = payload;
  if (!category || !filename || !content) {
    return json(res, 400, { success: false, error: '缺少 category、filename 或 content' });
  }

  try {
    const saved = saveMarkdown({ category, filename, content });
    runBuild();
    return json(res, 200, {
      success: true,
      message: '文章已发布',
      path: saved.path,
      slug: saved.slug,
      url: `/blog/${saved.slug}/`,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 400, { success: false, error: err.message || String(err) });
  }
}

async function handleUpload(req, res) {
  if (!authorize(req)) {
    return json(res, 401, { success: false, error: '未授权，请提供正确的 BLOG_TOKEN' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const category = url.searchParams.get('category');
  const filename = url.searchParams.get('filename');
  if (!category || !filename) {
    return json(res, 400, { success: false, error: '请在 query 中提供 category 和 filename' });
  }

  try {
    const content = await readBody(req);
    if (!content.trim()) {
      return json(res, 400, { success: false, error: '文件内容为空' });
    }
    const saved = saveMarkdown({ category, filename, content });
    runBuild();
    return json(res, 200, {
      success: true,
      message: '文章已上传并发布',
      path: saved.path,
      slug: saved.slug,
      url: `/blog/${saved.slug}/`,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 400, { success: false, error: err.message || String(err) });
  }
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/blog/health') {
    return json(res, 200, {
      success: true,
      staticDir: STATIC_DIR,
      publishEnabled: Boolean(TOKEN) || process.env.BLOG_ALLOW_OPEN_PUBLISH === '1',
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/blog/publish') {
    return handlePublish(req, res);
  }

  if (req.method === 'POST' && url.pathname === '/api/blog/upload') {
    return handleUpload(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (serveStatic(req, res)) return;
    return json(res, 404, { success: false, error: 'Not Found' });
  }

  return json(res, 405, { success: false, error: 'Method Not Allowed' });
}).listen(PORT, () => {
  console.log(`Blog server listening on http://0.0.0.0:${PORT}`);
  console.log(`Serving static files from ${STATIC_DIR}`);
  if (!TOKEN) {
    console.warn('Warning: BLOG_TOKEN is empty. Set it before exposing publish API publicly.');
  }
});
