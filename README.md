# 个人博客（Astro + 云服务器 / GitHub Pages）

静态个人博客：文章列表、单篇阅读、网页一键发布 Markdown。

## 本地开发

```bash
cd personal-blog
npm install
npm run dev
```

浏览器打开终端里提示的地址（GitHub Pages 模式一般为 `http://localhost:4321/personal-blog/`）。

## 部署到云服务器（推荐：上传 MD 即生效）

你的量化 API 已在 `120.48.157.95:3389` 运行；博客占用 **8080** 端口，两者互不干扰。

### 1. 上传代码到服务器

```bash
git clone <你的仓库> /opt/personal-blog
cd /opt/personal-blog
npm install
cp .env.example .env
# 编辑 .env：设置 BLOG_SITE、BLOG_BASE、BLOG_TOKEN
npm run build
```

`.env` 示例（直接 IP 访问）：

```env
BLOG_SITE=http://120.48.157.95:8080
BLOG_BASE=/
BLOG_PORT=8080
BLOG_TOKEN=一串足够长的随机密钥
```

### 2. 启动服务

```bash
npm start
# 或用 pm2 常驻：pm2 start npm --name blog -- start
```

访问 `http://120.48.157.95:8080/` 即可看到博客。

### 3. Nginx 反代（可选，去掉 URL 里的 :8080）

在云服务器安装 Nginx 后：

```bash
sudo cp deploy/nginx-blog.conf /etc/nginx/sites-available/blog
sudo ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

之后可用 `http://120.48.157.95/` 访问（无需写端口）。若启用 Nginx，请把 GitHub 跳转页里的地址改成 `http://120.48.157.95/`（见下方）。

### 4. 让 [xzcawl.github.io/personal-blog](https://xzcawl.github.io/personal-blog) 跳转到云服务器

`xzcawl.github.io` 域名由 **GitHub** 托管，云上的 Nginx **无法**直接接管该域名。做法是：在 GitHub Pages 放跳转页，访问旧链接时自动跳到 `120.48.157.95`。

**云服务器**（真实博客）：

```bash
# .env 用根路径，与跳转目标一致
BLOG_SITE=http://120.48.157.95:8080
BLOG_BASE=/
npm run build && npm start
```

**GitHub Pages**（仅跳转，推送一次即可）：

```bash
npm run build:github-redirect
git add docs && git commit -m "chore: redirect github pages to cloud server"
git push
```

推送后，访问 `https://xzcawl.github.io/personal-blog/` 及子路径（如 `/personal-blog/blog/quant/jq2qmt/`）会跳转到 `http://120.48.157.95:8080/...`。

若已配置 Nginx 80 反代，编辑 `deploy/github-redirect/index.html` 与 `404.html`，把 `120.48.157.95:8080` 改为 `120.48.157.95`，再执行 `npm run build:github-redirect` 并推送。

> 自定义域名（非 github.io）：在 DNS 把 A 记录指向 `120.48.157.95`，用 Nginx 反代 8080 即可，无需 GitHub 跳转。

### 5. 发表新文章（一次上传即上线）

1. 打开 **发表文章** 页面
2. 填写发布密钥（与服务器 `BLOG_TOKEN` 一致，浏览器会记住）
3. 填写标题、分类、正文，点 **直接发布**；或选择已有 `.md` 点 **上传并发布**
4. 服务器会自动：保存 Markdown → 构建站点 → 新文章立即出现在首页

API 说明：

- `POST /api/blog/publish` — JSON 发布（表单使用）
- `POST /api/blog/upload?category=quant&filename=slug.md` — 原始 Markdown 上传
- 均需请求头 `Authorization: Bearer <BLOG_TOKEN>`

## 部署到 GitHub Pages（旧方式）

打开 `astro.config.mjs` 或通过环境变量设置：

| 仓库类型 | `BLOG_SITE` | `BLOG_BASE` |
|----------|-------------|-------------|
| 项目站 | `https://用户名.github.io` | `/personal-blog/` |
| 用户站 | `https://用户名.github.io` | `/` |

推送后 GitHub Actions 会自动构建发布。此方式 **不能** 网页直发，需下载 .md 后提交仓库。

## 项目结构（简要）

- `src/pages/index.astro`：文章列表
- `src/pages/blog/[...slug].astro`：文章详情
- `src/pages/publish.astro`：发表文章（直发 / 下载 / 上传）
- `src/content/blog/`：文章 Markdown 源文件
- `server/index.mjs`：云服务器静态托管 + 发布 API
- `.github/workflows/deploy.yml`：GitHub Pages 自动构建部署
