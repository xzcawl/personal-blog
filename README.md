# 个人博客（Astro + GitHub Pages）

静态个人博客：文章列表、单篇阅读、在浏览器中撰写并下载 Markdown 后提交到仓库即可发布新文章。

## 本地开发

```bash
cd personal-blog
npm install
npm run dev
```

浏览器打开终端里提示的地址（一般为 `http://localhost:4321/personal-blog/`）。

## 部署前必改：站点地址与路径

打开 `astro.config.mjs`，把 **`site`** 和 **`base`** 改成与你的 GitHub 仓库一致：

| 仓库类型 | `site` 示例 | `base` |
|----------|-------------|--------|
| 项目站 `https://用户名.github.io/仓库名/` | `https://你的用户名.github.io` | `'/仓库名'`（与仓库名相同，前后有斜杠） |
| 用户站 `https://用户名.github.io/`（仓库名为 `用户名.github.io`） | `https://你的用户名.github.io` | `'/'` |

修改后执行 `npm run build`，确认无报错再推送。

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库，将本目录推送到默认分支 `main`（或 `master`，与工作流里分支一致）。
2. 仓库 **Settings → Pages → Build and deployment**：Source 选 **GitHub Actions**。
3. 推送代码后，Actions 中的 **Deploy to GitHub Pages** 会构建并发布；首次需在 **Actions** 里确认工作流已运行成功。
4. 几分钟后用浏览器访问：`https://你的用户名.github.io/仓库名/`（用户站则为 `https://你的用户名.github.io/`）。

## 发表新文章

1. 打开站点上的 **发表文章** 页面，填写标题、文件名（英文短横线形式）、日期与 Markdown 正文。
2. 点击 **下载 .md 文件**，将文件保存到本仓库的 `src/content/blog/`。
3. 提交并推送；GitHub Actions 会重新构建，新文章会出现在首页列表中。

也可直接在 `src/content/blog/` 下新建 `.md` 文件，frontmatter 字段需与 `src/content/config.ts` 中的 schema 一致（`title`、`date`，可选 `description`、`draft`）。

## 项目结构（简要）

- `src/pages/index.astro`：文章列表  
- `src/pages/blog/[...slug].astro`：文章详情  
- `src/pages/publish.astro`：发表文章（生成 Markdown）  
- `src/content/blog/`：文章 Markdown 源文件  
- `.github/workflows/deploy.yml`：GitHub Pages 自动构建部署  
