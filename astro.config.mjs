import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';

// 云服务器：在 .env 中设置 BLOG_SITE / BLOG_BASE
// GitHub Pages 项目站：site=https://用户名.github.io  base=/personal-blog/
export default defineConfig({
  site: process.env.BLOG_SITE || 'https://xzcawl.github.io',
  base: process.env.BLOG_BASE || '/personal-blog/',
  outDir: process.env.BLOG_OUT_DIR || 'docs',
  markdown: {
    remarkPlugins: [remarkGfm],
  },
});
