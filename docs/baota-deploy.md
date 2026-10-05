# 宝塔 Linux 面板部署 astro-nav

以下以域名 `nav.example.com`、项目目录 `/www/wwwroot/astro-nav` 和本机 MySQL 为例。把示例值换成自己的域名、数据库账号和密钥。

## 1. 安装环境并上传项目

在宝塔安装 Nginx、MySQL 8 和 Node.js 版本管理器，安装 Node.js 22.12 或更高版本，并把它设为 Node 项目的命令行版本。域名先解析到服务器。

上传**当前修改后的** `astro-nav` 项目到 `/www/wwwroot/astro-nav`。上传 `src/`、`public/`、`drizzle/`、`scripts/`、`package.json`、`pnpm-lock.yaml`、配置文件等源码；不要上传 Windows 上的 `node_modules/`、`dist/` 或本地 `.env`。依赖和构建产物要在 Linux 服务器上生成。如果要迁移已经上传的图标或壁纸，同时复制项目的 `data/` 目录。

## 2. 在宝塔一键建库

打开 **数据库 → MySQL → 添加数据库**，填写数据库名（例如 `astro-nav`）、专用用户名和随机强密码，字符集选 `utf8mb4`，访问权限选**本地服务器**，然后确定。宝塔会创建数据库和用户；这个项目不需要手工导入建表 SQL。数据库表在第 4 步用迁移命令创建。

## 3. 配置环境变量

在服务器项目根目录复制 `.env.example` 为 `.env`，填入真实值。至少配置：

```dotenv
DATABASE_URL=mysql://astro-nav:你的数据库密码@127.0.0.1:3306/astro-nav
SITE_URL=https://nav.example.com
SITE_TIMEZONE=Asia/Hong_Kong
ADMIN_USERNAME=admin
ADMIN_PASSWORD=至少12位的初始强密码
SESSION_SECRET=至少32位的随机字符串
IP_HASH_SECRET=另一段独立随机字符串
TRUST_PROXY=false
GEOIP_PROVIDER=none
HOST=127.0.0.1
PORT=3000
```

`SITE_URL` 请设置为访客最终访问的 HTTPS 域名，以便生成正确的分享链接和同源校验。数据库密码如果包含 `@`、`:`、`/`、`#`、`?`、`%` 等 URL 特殊字符，放入 `DATABASE_URL` 前要进行 URL 百分号编码。`.env` 不要放进公开仓库，并确保运行 Node 项目的用户能读取它。

## 4. 一条迁移命令建表

在宝塔终端进入项目目录，安装依赖、迁移数据库、构建：

```bash
cd /www/wwwroot/astro-nav
npm install -g pnpm
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

`pnpm db:migrate` 会创建项目所需的数据表；以后更新项目也运行同一个命令。本版新增 `page_views` 表用于页面浏览量和独立访客统计，更新服务器时必须执行迁移。首次安装若想导入原项目的示例分类和网址，可以额外运行 `pnpm db:import-legacy`。如果要保留本地站点已有的内容，请恢复本地数据库备份，并复制 `data/`，不要只导入示例数据。构建阶段需要开发依赖，因此不要先用 `pnpm install --prod`。

## 5. 用宝塔运行和绑定域名

在 **网站 → Node 项目 → 添加 Node 项目** 填写项目路径 `/www/wwwroot/astro-nav`、Node 版本、端口 `3000`。如果面板要求启动文件，填 `scripts/start.mjs`；如果要求启动命令，填 `pnpm start`。宝塔的 Node 项目管理会用 PM2 守护进程。

给域名配置 HTTPS，并将站点反向代理到 `http://127.0.0.1:3000`。不要在防火墙公开 3000 端口。若通过 Nginx 站点设置添加代理，确保转发原始 `Host` 和协议。上传壁纸上限为 5 MB；Nginx 的请求体上限至少设为 `6m`，否则上传时可能出现 413。

访问 `https://nav.example.com/admin`，使用 `.env` 的管理员账号和密码首次登录。空数据库首次登录时才会创建管理员；如果恢复了已有数据库，应使用原管理员账号。

## 常见问题

- **502**：检查宝塔 Node 项目日志、启动文件、`PORT` 和构建是否完成。
- **数据库连接失败**：核对 MySQL 服务、数据库名、专用用户名、密码及 `DATABASE_URL` 中特殊字符编码；确认已运行 `pnpm db:migrate`。
- **后台提示请求来源无效**：核对 `SITE_URL` 与最终 HTTPS 域名完全一致。
- **上传返回 413**：提高 Nginx 的 `client_max_body_size`，并确认项目的 `data/` 目录可写。

参考：[宝塔添加 MySQL 数据库](https://docs.bt.cn/user-guide/database/mysql/add)、[宝塔 Node 项目部署](https://docs.bt.cn/practical-tutorials/nodejs-pm2-deployment)、[宝塔反向代理](https://docs.bt.cn/user-guide/site/php/site-config/reverse-proxy)。
