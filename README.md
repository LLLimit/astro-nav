<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/images/brand-lockup-white.png">
    <source media="(prefers-color-scheme: light)" srcset="public/images/brand-lockup-black.png">
    <img src="public/images/brand-lockup-black.png" width="420" alt="LLLimit 导航站">
  </picture>
</p>

<h1 align="center">astro-nav</h1>

<p align="center">
  基于 Astro 的全栈导航站，让收藏有序，让常用网站触手可及。<br>
  两级分类 · 管理后台 · 即时搜索 · 液态玻璃 2.0
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Astro-5-FF5D01?style=flat-square&amp;logo=astro&amp;logoColor=white" alt="Astro 5">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&amp;logo=tailwindcss&amp;logoColor=white" alt="Tailwind CSS 3">
  <img src="https://img.shields.io/badge/MySQL-8-4479A1?style=flat-square&amp;logo=mysql&amp;logoColor=white" alt="MySQL 8">
  <br>
  <img src="https://img.shields.io/badge/Drizzle_ORM-222222?style=flat-square&amp;logo=drizzle&amp;logoColor=C5F74F" alt="Drizzle ORM">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/WebGL-2-990000?style=flat-square&amp;logo=webgl&amp;logoColor=white" alt="WebGL 2">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-222222?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <a href="https://map.darkduck.fun/"><strong>在线演示</strong></a> ·
  <a href="https://github.com/LLLimit/astro-nav/releases/latest">下载最新版</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="docs/baota-deploy.md">宝塔部署</a> ·
  <a href="https://github.com/LLLimit/astro-nav/issues">反馈问题</a>
</p>

---

astro-nav 把导航展示与内容管理放在同一个项目中。前台用于浏览分类、查找网站和切换主题；后台用于维护网址、图标、壁纸及站点设置。内容保存在 MySQL 中，后台更新后无需重新构建。

## 功能亮点

| 功能 | 说明 |
| --- | --- |
| 🗂️ 两级分类 | 一级分类侧栏导航、二级分类标签；每个标签默认展示 15 个网址，支持展开与收起 |
| 🔎 即时搜索 | 搜索名称、域名、简介、分类和标签；支持快捷键及百度、Google、Bing、DuckDuckGo |
| 🌓 三种主题 | 中性黑白配色，搭配可选的液态玻璃 2.0；小屏幕布局与折叠侧栏 |
| 💧 壁纸管理 | 最多 30 张壁纸，支持批量上传、改名、排序和设置默认；访客可独立选择 |
| 🛠️ 管理后台 | 分类与网址管理、批量操作、网址解析、图标上传、站点设置和密码修改 |
| 📦 导入导出 | 快速导入及 JSON / CSV 导入导出，方便整理和迁移收藏 |
| 📊 访问统计 | 页面浏览量、独立访客、网址点击、热门网站及趋势图表 |
| 🖼️ 自定义图标 | 分类与网址图标保留原色；自定义 favicon 同步应用于首页、登录页和后台 |

### 分类与浏览

- 侧边栏显示一级分类，分区顶部提供「全部」及手动创建的二级分类标签。
- 桌面布局使用五列，小屏幕自动调整；折叠的网址仍可被站内搜索找到。
- 分类与网址排序只接受非负整数，数字越小越靠前。
- 关闭「在首页显示」后保留后台数据；隐藏一级分类会同时隐藏其子分类与网址。

详细操作见 [两级分类说明](docs/two-level-categories.md)。

### 搜索快捷键

| 按键 | 操作 |
| --- | --- |
| `Ctrl / Command + K` | 聚焦搜索框 |
| `↑` / `↓` | 选择搜索结果 |
| `Enter` | 打开选中的结果或执行搜索 |
| `Esc` | 关闭搜索结果 |

## 液态玻璃 2.0

| 主题 | 视觉与用途 |
| --- | --- |
| 明亮 | 白色表面与中性灰背景，适合日间浏览 |
| 深色 | 黑色与中性灰层次，适合深色界面偏好 |
| 液态玻璃 | 壁纸透镜、边缘色散、局部反光与鼠标形变，支持滚动交互 |

液态玻璃使用共享 **WebGL 2** 画布，分类分区、卡片、侧栏、搜索框及按钮按层渲染。圆弧透镜与中心放大呈现背景折射，鼠标经过时产生局部放大、波纹和方向形变。

后台可管理多张壁纸、选择默认壁纸及关闭内置壁纸。访客的壁纸选择仅保存在自己的浏览器中，上传壁纸只用于液态玻璃主题。

> [!NOTE]
> 液态玻璃主要使用访客设备的 GPU，首次启用会提示性能需求。空闲或后台标签页暂停渲染，切回普通主题释放资源；不支持 WebGL 2 时使用 CSS 回退。折射对象是壁纸，并非任意页面内容的实时截图。

光学实现、兼容性与性能范围见 [液态玻璃文档](docs/liquid-glass.md)。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 页面与样式 | Astro 5 · TypeScript · Tailwind CSS 3 |
| 服务运行 | Astro Node Adapter · Node.js |
| 数据存储 | MySQL 8 · Drizzle ORM |
| 数据校验与认证 | Zod · Argon2id · 数据库会话 |
| 统计图表 | ECharts |
| 玻璃渲染 | WebGL 2 · CSS 回退 |
| 部署 | Nginx · Node / PM2 · 支持宝塔面板 |

## 快速开始

### 1. 准备环境

- Node.js，部署建议使用 **22.12 或更高的兼容版本**。
- pnpm。
- MySQL 8，使用 `utf8mb4` 字符集。

下载 [Release 源码包](https://github.com/LLLimit/astro-nav/releases/latest)，或克隆仓库：

```bash
git clone https://github.com/LLLimit/astro-nav.git
cd astro-nav
cp .env.example .env
```

Windows PowerShell 使用 `Copy-Item .env.example .env` 复制配置文件。

### 2. 创建数据库

宝塔用户可以在「数据库 → MySQL → 添加数据库」中创建数据库和专用账号。也可以在 MySQL 中执行：

```sql
CREATE DATABASE nav CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nav'@'127.0.0.1' IDENTIFIED BY '请替换强密码';
GRANT ALL PRIVILEGES ON nav.* TO 'nav'@'127.0.0.1';
```

### 3. 填写环境变量

编辑项目根目录的 `.env`，以下为本地开发示例：

```dotenv
DATABASE_URL=mysql://nav:替换为数据库密码@127.0.0.1:3306/nav
SITE_URL=http://localhost:4321
HOST=127.0.0.1
PORT=3000
SITE_TIMEZONE=Asia/Hong_Kong
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为至少12位的初始强密码
SESSION_SECRET=替换为至少32位的随机字符串
IP_HASH_SECRET=替换为另一段独立随机字符串
TRUST_PROXY=false
GEOIP_PROVIDER=none
```

数据库密码中的 URL 特殊字符需要进行百分号编码。可运行下面的命令生成随机密钥，为两个密钥分别生成不同的值：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 4. 安装并启动

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

默认开发地址为 `http://localhost:4321`，后台入口为 `/admin`。使用 `.env` 中的账号和密码首次登录；管理员表为空时才会创建初始管理员，已有账号不会被重设。

想导入示例分类和网址时，可额外运行 `pnpm db:import-legacy`；重复执行会跳过已有网址。

## 生产部署与升级

### 生产部署

将 `SITE_URL` 改为最终 HTTPS 地址，确认数据库配置后执行：

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

`pnpm start` 读取 `.env` 并运行构建后的 Node 服务。通过 PM2 或宝塔保持进程运行，Nginx 代理到 `.env` 中的 `HOST` 和 `PORT`；端口可以修改，代理目标需保持一致。

- **宝塔部署**：[建库、配置、PM2 与 HTTPS 操作指南](docs/baota-deploy.md)。
- **普通服务器与运维**：[Nginx、地区统计、升级和备份](docs/operations.md)。

### 覆盖升级

先备份数据库、`.env` 和 `data/`。Git 部署执行 `git pull`；压缩包部署将新版源码覆盖到原目录，然后执行：

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

完成后重启原 Node / PM2 项目。服务器的 `.env` 和 `data/` 需要保留；不要用空数据库替换已有数据库。构建需要开发依赖，不要在构建前使用 `pnpm install --prod`。

## 项目结构

```text
src/
├── components/    导航、搜索、卡片等界面组件
├── db/            数据模型与查询
├── layouts/       页面布局
├── lib/           认证、校验、上传与公共逻辑
├── pages/         首页、后台与 API
├── scripts/       前台、后台与液态玻璃交互
└── styles/        主题样式
public/            静态图标、Logo 与内置壁纸
drizzle/           数据库迁移
scripts/           启动、示例数据导入与联调脚本
tests/             测试
docs/              部署、操作与实现说明
data/              运行时上传文件（不提交到 Git）
```

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [宝塔部署](docs/baota-deploy.md) | 从准备环境到绑定域名 |
| [部署与运维](docs/operations.md) | 代理、地区统计、升级与备份恢复 |
| [两级分类](docs/two-level-categories.md) | 分类归属、标签与展开收起 |
| [液态玻璃 2.0](docs/liquid-glass.md) | 渲染、壁纸管理与性能范围 |
| [博客介绍](docs/blog-astro-nav.md) | 项目介绍与安装教程的 Markdown 文章 |
| [导航导入方案](docs/navigation-import-plan.md) | 尚未实现的后续导入规划 |

<details>
<summary><strong>后台使用提示</strong></summary>

- 网址列表支持筛选使用默认图标或独立图标的网址。默认图标指未设置图标或显式使用 `/images/default.svg`。
- 「临时编辑」会缩短当前列表文字并将操作按钮独立成行，便于处理长名称；原名称保持不变。
- 壁纸上传、改名或排序后，需要点击「保存设置」发布；移除壁纸仅隐藏候选项，保留原始文件。
- 浏览器选择的壁纸不改变网站默认设置，已移除的选项会在刷新时回到默认背景。

</details>

<details>
<summary><strong>常见问题</strong></summary>

| 问题 | 排查方向 |
| --- | --- |
| 首页显示数据库错误 | 检查 MySQL、`DATABASE_URL` 和账号权限，确认已执行迁移 |
| 后台无法初始化 | 空管理员表需要正确配置账号及至少 12 位的密码；已有数据库使用原账号 |
| 请求来源无效 | 检查 `SITE_URL` 与实际协议、域名和端口是否一致 |
| 图标解析失败 | 可手动上传 PNG / JPEG / WebP / ICO；SVG 上传不开放 |
| 升级后上传文件消失 | 检查原 `data/` 是否保留，且运行用户有读写权限 |
| 点击数未增加 | 同一 IP Hash 对同一网址五分钟内只计一次，检查密钥和代理设置 |
| 地区统计为 Unknown | 默认不启用地区来源，配置方式见运维文档 |

</details>

<details>
<summary><strong>开发与验证命令</strong></summary>

```bash
pnpm check
pnpm test
pnpm build
```

`pnpm db:generate` 用于开发新 Schema 的迁移；部署已有版本只需运行 `pnpm db:migrate`。

真实数据库联调可设置 `SMOKE_BASE_URL` 并运行 `pnpm test:live`。它会使用 `.env` 中的管理员账号创建临时分类和网址、验证 API 后清理数据，仅用于测试数据库。

</details>

## 安全与数据

管理员密码使用 Argon2id 哈希，登录使用数据库会话与 HttpOnly Cookie。服务端提供权限校验、同源写入检查、登录限流、SSRF 防护及上传格式与大小限制。

访问统计保存匿名哈希，不存储原始 IP。启用外部地区查询 API 时会将访客 IP 发送到所配置的服务，配置说明见运维文档。

源码包不包含 `.env`、数据库和用户上传文件。站点内容保存在 MySQL 中，图标、Logo 与壁纸保存在 `data/`；迁移服务器时需同时备份这些内容。

## 反馈与许可证

欢迎通过 [Issues](https://github.com/LLLimit/astro-nav/issues) 反馈问题，或提交 Pull Request。

本项目采用 [MIT License](LICENSE)，版权和许可条款见 LICENSE 文件。
