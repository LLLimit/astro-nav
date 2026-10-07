# astro-nav · Astro 全栈导航站

基于 Astro 开发的全栈导航站，包含完整的管理后台，使用 MySQL 存储网站内容与访问统计。支持分类导航、快捷搜索、自定义图标和多种主题，内容可在后台实时管理，更新无需重新构建。

项目仓库：[LLLimit/astro-nav](https://github.com/LLLimit/astro-nav)。

## 液态玻璃 2.0

v1.2.0 升级了液态玻璃渲染：圆弧透镜与中心放大增强背景折射，壁纸取样反射与方向性高光呈现边缘厚度，嵌套组件按层折射外层玻璃。滚动与鼠标交互实时驱动光学效果，配备新的城市默认壁纸，并保留后台壁纸设置。实现范围和性能说明见 [液态玻璃文档](docs/liquid-glass.md)。

在线演示：[map.darkduck.fun](https://map.darkduck.fun/)。

## 功能

- 支持两级分类：侧边栏只显示一级分类，每个一级分类拥有独立分区，顶部显示「全部」及手动创建的二级分类标签，默认选中「全部」，不自动生成「未细分」；支持空分类提示和小屏横向滚动。分区与标签同步适配黑白、液态玻璃主题。管理操作见 [两级分类说明](docs/two-level-categories.md)。
- 网址管理支持筛选「使用默认图标的网址」及「有独立图标的网址」，仅筛选网址。默认图标指未设置图标或显式使用 `/images/default.svg` 的网址。「临时编辑」临时缩短列表文字并将操作按钮独立成行，适合长名称挤出按钮时使用；仅改变本次页面显示，保留原名称。
- 侧边栏可折叠，支持分类滚动定位和当前分类高亮。
- 一级分类和二级分类标签默认最多显示 15 个网址，超过时可展开全部并再次收起；桌面显示五列三行，小屏自适应，折叠的网址仍可通过站内搜索找到。
- 站内即时搜索（名称、域名、描述、分类、标签），Ctrl/Command+K、方向键、Enter、Esc；Google、Bing、百度、DuckDuckGo 搜索模式可记忆。
- 明亮、深色和液态玻璃三种主题。明亮与深色主题使用中性黑白配色；上传的壁纸只在液态玻璃主题显示，未上传时使用项目自带壁纸。首次启用玻璃主题会提示性能需求，并在本机记住选择。
- 液态玻璃使用共享 WebGL 2 画布实时折射壁纸，支持鼠标扰动、边缘色散和滚动惯性；空闲或后台标签页暂停渲染，切回黑白主题释放 GPU 资源。实现范围与兼容性见 [液态玻璃说明](docs/liquid-glass.md)。
- 自定义分类/网址图标保留图片原色；网站设置可上传并预览自定义 favicon，保存后首页、登录页和后台使用同一个浏览器图标。
- `/admin` 管理后台：管理员登录、网址与分类管理、批量启停和删除、网址解析、图标上传、快速导入、JSON/CSV 导入导出、站点设置、密码更新和访问统计。
- 分类管理的「在首页显示」开关关闭后，会隐藏首页中的分类及其网址；一级分类隐藏时，其二级分类也隐藏，后台数据仍保留。分类与网址排序只接受非负整数，数字越小越靠前；数据库迁移会将已有负数排序归零。
- 页面浏览量、独立访客、网址点击（五分钟去重）、按日聚合、热门网站及 ECharts 趋势和设备等分布图。统计使用匿名哈希，不存储原始 IP。
- Argon2id 密码、数据库会话、HttpOnly Cookie、同源写入检查、登录限流、服务端权限校验、SSRF 防护、上传格式和大小限制。

## 技术栈

Astro 5、TypeScript、Tailwind CSS、Astro Node Adapter、Drizzle ORM、MySQL 8、Zod、ECharts、Node.js 20+。不依赖 Docker。

## 本地开发

1. 准备 Node.js 20+、pnpm 和 MySQL 8，创建 UTF8MB4 数据库与专用用户：

   ```sql
   CREATE DATABASE nav CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'nav'@'127.0.0.1' IDENTIFIED BY '请替换强密码';
   GRANT ALL PRIVILEGES ON nav.* TO 'nav'@'127.0.0.1';
   ```

2. 复制 `.env.example` 为 `.env`，填写 `DATABASE_URL`、`SITE_URL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`IP_HASH_SECRET` 和 `SESSION_SECRET`。将 `.env` 设为只允许运行用户读取。密码和密钥不要提交到代码仓库。
3. 安装依赖、迁移并启动：

   ```text
   pnpm install
   pnpm db:migrate
   pnpm db:import-legacy
   pnpm dev
   ```

4. 浏览 `/admin`。当管理员表为空时，首次登录会使用环境变量创建账号并保存 Argon2id 哈希；以后不会重设密码。`pnpm db:import-legacy` 用于导入示例导航数据，可按需执行；重复运行时会跳过已有网址。

`pnpm db:generate` 用于开发新 Schema 迁移；部署已有版本时运行 `pnpm db:migrate`，不要用数据库重置或 `push` 代替迁移。上传数据保存在项目根目录 `data/icons`、`data/logos`、`data/backgrounds`，构建不会清理该目录。

## 生产部署（宝塔 / 普通 Node 环境）

宝塔面板的逐步操作见 [宝塔部署指南](docs/baota-deploy.md)。

1. 在宝塔创建 MySQL 8 数据库（UTF8MB4）和 Node 项目，配置项目环境变量。确保 `DATABASE_URL` 指向已创建的数据库，`SITE_URL` 是最终 HTTPS 网址，`ADMIN_PASSWORD` 至少 12 位，`IP_HASH_SECRET` 为独立随机值。
2. 在项目目录执行 `pnpm install --frozen-lockfile`、`pnpm db:migrate`，首次部署可执行 `pnpm db:import-legacy`，然后 `pnpm build`。
3. Node 启动命令是 `pnpm start`，它会读取 `.env` 并启动 `dist/server/entry.mjs`。设 `HOST=127.0.0.1`、`PORT=3000`，由宝塔 Node 项目管理保持进程运行。不要把 3000 端口对公网开放。
4. Nginx 配置 HTTPS 证书，并反向代理到 `127.0.0.1:3000`。下面放在站点的 `server` 块内，证书和 80→443 跳转由面板配置：

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Geo-Country "";
       proxy_set_header X-Geo-Region "";
   }
   location /_astro/ {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       expires 30d;
   }
   ```

   `/media/` 由 Node 从 `data/` 提供，不要在 Nginx 指向构建目录。仅在 Node 确实只能由可信代理访问、且代理覆盖客户端传入的 `X-Forwarded-For` 时设置 `TRUST_PROXY=true`。默认 `false`，此时访问去重按代理地址进行。

5. 健康检查：首页、`/admin`、`/robots.txt`、`/sitemap.xml`。登录后添加分类和网址，刷新首页确认立即可见；点击网址后检查统计页。

### 地区信息

`GEOIP_PROVIDER=none` 时统计显示 Unknown。可设为 `proxy`，从可信 Nginx 注入的 `X-Geo-Country`（两位国家码）和 `X-Geo-Region` 读取信息；必须把上面两个空值头替换为 Nginx 自己计算的地区变量，不能透传客户端提供的同名头。也可设为 `api`，填写 HTTPS 的 `GEOIP_API_URL`（包含 `{ip}` 占位符），可选 `GEOIP_API_KEY` 会作为 Bearer 令牌发送。API 应返回 `{"country":"HK","region":"Hong Kong"}`；启用它意味着将访问者 IP 发送给所选服务。地区来源不可用不会阻止点击统计。`src/lib/geo.ts` 提供独立 Provider 接口，便于接入本地 GeoIP 数据源。

### 更新

如果部署目录是 Git 克隆，先执行 `git pull`。如果使用下载的压缩包，先将新版本源码覆盖到部署目录，保留 `.env` 与 `data/`。然后执行：

```text
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
重启 Node 项目
```

更新前备份数据库、`data/` 和 `.env`。这些步骤不会覆盖管理员密码或网站内容。不要删除 `data/`，也不要用新的空数据库替换生产数据库。

### 备份与恢复

```text
mysqldump --single-transaction --default-character-set=utf8mb4 -u nav -p nav > nav.sql
mysql -u nav -p nav < nav.sql
```

同时备份 `data/` 和 `.env`，恢复时将它们放回项目根目录，恢复数据库后运行 `pnpm install --frozen-lockfile`、`pnpm build` 并启动 Node。不要将包含密钥的备份放在 Web 可访问目录。

## 验证

```text
pnpm check
pnpm test
pnpm build
```

`pnpm check` 是严格 TypeScript/Astro 检查。安全测试覆盖非 HTTP URL 与本地、私网、元数据 IP 的解析拒绝。完整的数据库联调需要真实 MySQL 和测试账号。

在测试数据库上启动站点后，可设置 `SMOKE_BASE_URL` 为测试站点地址并运行 `pnpm test:live`。它会用 `.env` 中的管理员账号验证分类、网址、导入导出、点击统计与私网地址拦截，然后删除临时分类和网址；请勿对生产数据库运行。

## 常见问题

- **首页无法打开、显示数据库错误**：检查 MySQL 服务、账号权限和 `DATABASE_URL`；先运行 `pnpm db:migrate`。
- **后台无法初始化**：确保数据库为空时已配置 `ADMIN_USERNAME` 和至少 12 位的 `ADMIN_PASSWORD`。
- **登录或写入显示“请求来源无效”**：检查 `SITE_URL` 是否与浏览器当前的协议、域名、端口一致，并检查 HTTPS 代理设置。
- **图标解析失败**：目标网站可能拒绝请求或没有受支持的图标，仍可手动上传 PNG/JPEG/WebP/ICO。SVG 上传不开放，以避免脚本执行风险。
- **上传文件消失**：确认 `data/` 使用持久存储，升级时没有删除该目录。
- **点击数未增加**：五分钟内同一 IP Hash 对同一网站只计一次；检查 `IP_HASH_SECRET` 和代理信任设置。

本项目采用 MIT 许可证，版权和许可条款见 [LICENSE](LICENSE)。
