import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'deploy', 'github-redirect');
const out = join(root, 'docs');

mkdirSync(out, { recursive: true });
cpSync(join(src, 'index.html'), join(out, 'index.html'));
cpSync(join(src, '404.html'), join(out, '404.html'));
writeFileSync(join(out, '.nojekyll'), '');

console.log('已生成 GitHub Pages 跳转页到 docs/');
console.log('推送后访问 https://xzcawl.github.io/personal-blog/ 将跳转到 http://120.48.157.95:8080/');
console.log('若已配置 Nginx 80 端口反代，可把跳转地址改为 http://120.48.157.95/');
