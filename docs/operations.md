# 部署与运维

生产部署、地区统计、升级和备份操作说明。首次使用宝塔可先阅读 [宝塔部署指南](baota-deploy.md)，项目概览见 [README](../README.md)。

## 生产部署（宝塔 / 普通 Node 环境）

宝塔面板的逐步操作见 [宝塔部署指南](baota-deploy.md)。

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

