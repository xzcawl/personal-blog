import { defineConfig } from 'astro/config';

// GitHub Pages 项目站：将仓库名改为你的仓库名，例如 base: '/personal-blog/'
// 用户站 username.github.io 请设为 base: '/'
export default defineConfig({
  site: 'https://xzcawl.github.io',
  base: '/personal-blog',
  outDir: 'docs',
});
