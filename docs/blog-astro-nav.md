# astro-nav：基于 Astro 的全栈导航站，带管理后台与两级分类

常用的网站越来越多，浏览器收藏夹却很难把它们整理得清楚。我希望有一个自己的导航站：打开就能找到常用工具，分类和网址可以在后台维护，换服务器时也能把数据一起带走。

于是就有了 **astro-nav**。这是一个基于 Astro 开发的全栈导航站，使用 MySQL 保存内容，包含管理后台，适合部署在自己的服务器上。

- GitHub：[LLLimit/astro-nav](https://github.com/LLLimit/astro-nav)
- 版本下载：[GitHub Releases](https://github.com/LLLimit/astro-nav/releases)
- 本文对应版本：[v1.1.1](https://github.com/LLLimit/astro-nav/releases/tag/v1.1.1)

## 首页可以做什么？

### 两级分类，让导航更容易整理

一级分类显示在左侧导航栏，每个一级分类拥有独立的内容分区。分区顶部可以添加二级分类标签，例如：

```text
AI 工具
├── 聊天对话
├── 图像生成
└── 编程助手

在线工具
├── 图片处理
├── 文本处理
└── 开发工具
```

可以点击标签查看对应网址，也可以查看「全部」。「全部」包含直接放在一级分类下及其可见二级分类中的网址，不自动生成「未细分」标签。每个分类或标签默认最多显示 15 个网址，超过时可以展开全部并再次收起；折叠的网址仍然可以通过站内搜索找到。小屏幕下标签可以横向滚动，侧边栏也能折叠。

原来已经使用单层分类的站点，升级后原分类会保留为一级分类，不需要重新整理全部网址。

### 站内搜索和搜索引擎切换

站内搜索支持网站名称、域名、简介、分类和标签，能查找当前可见分类中的网址。除了鼠标操作，也支持 Ctrl/Command + K、方向键、Enter 和 Esc。

搜索区还能切换百度、Google、Bing、DuckDuckGo，方便把导航站当作浏览器起始页。

### 黑白主题与液态玻璃主题

明亮和深色主题以中性黑白为主，按钮与高亮保持统一。液态玻璃主题提供另一种视觉选择，壁纸、搜索框、分类分区和卡片共同组成透明的界面。

液态玻璃通过 WebGL 2 对壁纸进行实时折射，包含鼠标扰动、边缘色散和滚动交互。它主要消耗访问者设备的图形性能，首次启用会提示性能需求。空闲或后台标签页暂停渲染，切回黑白主题时释放相应 GPU 资源；浏览器不支持时使用 CSS 回退效果。

后台可以上传自定义壁纸，壁纸只用于液态玻璃主题。需要说明的是，这里的折射对象是壁纸，并非对任意网页内容进行完整的光学模拟。

## 后台包含哪些功能？

后台入口是网站地址后的 `/admin`，可以直接管理站点内容。

- **分类管理**：创建一级、二级分类，调整归属、排序和是否在首页显示。
- **网址管理**：添加和编辑网址、简介、分类、标签与图标，批量启停或删除。
- **数据导入导出**：快速导入，以及 JSON、CSV 导入导出。
- **网站设置**：维护站点信息，上传自定义 favicon 和液态玻璃壁纸。
- **访问统计**：查看页面浏览量、独立访客、网址点击、趋势和热门网站。
- **账号管理**：管理员登录与密码修改。

分类和网址的排序只接受非负整数，数字越小越靠前。关闭分类的「在首页显示」只会隐藏首页内容，后台数据仍然保留；隐藏一级分类会同时隐藏其下的二级分类与网址。

内容存储在 MySQL 中，通过后台更新后不需要重新构建网站。上传文件保存在项目根目录的 `data/` 中，升级时需要保留。

## 技术栈

项目使用 Astro、TypeScript、Tailwind CSS、Astro Node Adapter、Drizzle ORM 和 MySQL 8，统计图表使用 ECharts。生产环境通过 Node.js 运行，支持 Nginx 反向代理和 PM2 守护，不要求 Docker。

## 安装教程：使用宝塔部署

下面以 Linux 宝塔面板为例。示例域名是 `nav.example.com`，项目目录是 `/www/wwwroot/astro-nav`，运行端口使用 `3100`。请替换成自己的域名和目录；端口可以选择其他未被占用的端口，但应用和代理配置必须一致。

### 1. 准备运行环境

在宝塔安装：

- Nginx。
- MySQL 8。
- Node.js 22.12 或更高的兼容版本，并在 Node 版本管理器中设置命令行版本。

把域名解析到服务器。上传 [Release 压缩包](https://github.com/LLLimit/astro-nav/releases/tag/v1.1.1) 并解压，确认 `package.json` 位于 `/www/wwwroot/astro-nav`，避免多套一层目录。

也可以通过 Git 获取源码：

```bash
cd /www/wwwroot
git clone https://github.com/LLLimit/astro-nav.git astro-nav
cd astro-nav
```

压缩包是源码包，依赖和构建产物要在服务器上生成，不需要上传 Windows 上的 `node_modules/` 或 `dist/`。

### 2. 在宝塔创建 MySQL 数据库

打开 **数据库 → MySQL → 添加数据库**，填写数据库名、专用用户名和强密码，字符集使用 `utf8mb4`，访问权限选择本地服务器。

本文以数据库和用户名均为 `astro_nav` 为例。宝塔负责创建数据库和账号，项目的数据表随后通过迁移命令创建，无需手动导入建表 SQL。

### 3. 配置 `.env`

在项目目录执行：

```bash
cd /www/wwwroot/astro-nav
cp .env.example .env
```

用宝塔文件编辑器打开 `.env`，填写自己的配置：

```dotenv
DATABASE_URL=mysql://astro_nav:替换为数据库密码@127.0.0.1:3306/astro_nav
SITE_URL=https://nav.example.com
HOST=127.0.0.1
PORT=3100
SITE_TIMEZONE=Asia/Hong_Kong
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为至少12位的初始强密码
SESSION_SECRET=替换为至少32位的随机字符串
IP_HASH_SECRET=替换为另一段独立随机字符串
TRUST_PROXY=false
GEOIP_PROVIDER=none
```

上面的密码和密钥都是占位内容，不能直接使用。可以运行下面的命令生成随机密钥，分别为两个密钥生成不同的值：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`SITE_URL` 应填写访客最终访问的 HTTPS 地址。如果数据库密码包含 `@`、`:`、`/`、`#`、`?`、`%` 等 URL 特殊字符，需要先进行 URL 百分号编码，再放入 `DATABASE_URL`。

保留 `.env.example` 中其他配置即可。确保运行项目的用户能读取 `.env`，不要将它上传到公开仓库。

### 4. 安装依赖、创建数据表并构建

在宝塔终端执行：

```bash
cd /www/wwwroot/astro-nav
npm install -g pnpm
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

`pnpm db:migrate` 会创建项目所需的数据表。构建需要开发依赖，因此第一次安装不要使用 `pnpm install --prod`。

如果想先导入示例分类和网址，可以在构建前额外执行下面的命令；想从空站开始就跳过：

```bash
pnpm db:import-legacy
```

### 5. 添加宝塔 PM2 项目

打开 **网站 → Node 项目 → 添加 Node 项目**，选择 **PM2 项目**，按下面填写：

| 配置项 | 示例值 |
| --- | --- |
| 项目名称 | astro-nav |
| Node 版本 | 已安装的兼容版本 |
| 启动文件 | `/www/wwwroot/astro-nav/scripts/start.mjs` |
| 运行目录 | `/www/wwwroot/astro-nav` |
| 负载实例数量 | 1 |
| 包管理器 | pnpm |
| 项目端口（若面板要求） | 3100 |

运行目录应填写项目根目录，不要填写 `scripts/`。如果面板提供启动命令选项，可以使用 `pnpm start`。启动脚本会读取项目的 `.env`，然后运行构建后的服务。

### 6. 配置域名、HTTPS 和反向代理

为域名配置证书，反向代理目标设置为 `http://127.0.0.1:3100`。`3100` 是内部应用端口，访客通过域名的 HTTPS 入口访问，无需向公网开放该端口。

如果自行编辑 Nginx 配置，可在对应的 `server` 块中使用：

```nginx
client_max_body_size 6m;

location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

已有 `location /` 时请修改原配置，不要重复添加。HTTPS 证书和 HTTP 跳转可以通过宝塔面板设置。

`TRUST_PROXY` 默认保留为 `false`。只有确认 Node 服务只能通过可信代理访问，并且代理覆盖客户端提交的转发头时，才改为 `true`，用于按真实访客地址去重统计。地区统计默认不启用，显示 Unknown；接入方式见仓库 README。

### 7. 登录后台并添加内容

访问：

```text
https://nav.example.com/admin
```

使用 `.env` 中设置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。管理员表为空时，首次登录会创建初始管理员；如果恢复的是已有数据库，应使用原来的管理员账号。

然后可以创建一级分类、添加二级分类、录入网址，并在网站设置中上传 favicon 和壁纸。更新内容后刷新首页即可看到。

## 已部署站点如何升级？

先备份 MySQL 数据库、`.env` 和 `data/`。

Git 部署可以在原目录执行 `git pull`；压缩包部署则将新版源码覆盖到原目录，保留 `.env` 和 `data/`。然后运行：

```bash
cd /www/wwwroot/astro-nav
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

最后在宝塔重启原 PM2 项目。

**v1.1.0 新增了两级分类数据库迁移，不能省略 `pnpm db:migrate`。** 原有分类自动保留为一级分类，网址归属保持不变，不需要重新导入数据，也不需要修改启动文件和端口。

## 常见问题

- **访问出现 502**：查看 Node/PM2 日志，确认构建完成，启动文件、运行目录和代理端口正确。
- **数据库连接失败**：检查 MySQL 是否运行，核对账号、密码、数据库名和 URL 编码，并确认执行了迁移。
- **后台提示请求来源无效**：检查 `SITE_URL` 是否与最终访问地址一致。
- **上传出现 413**：检查 Nginx 请求体上限；壁纸上传上限为 5 MB，代理建议至少设置 `6m`。
- **升级后图标或壁纸丢失**：确认服务器原有的 `data/` 目录被保留，并且运行用户具有读写权限。
- **液态玻璃在设备上不够流畅**：切换回明亮或深色主题，普通导航和管理功能不依赖液态玻璃。

## 写在最后

astro-nav 把导航展示和内容管理放在同一个项目里：前台负责查找常用网站，后台负责分类、网址和数据维护。两级分类适合逐渐扩大的收藏库，黑白主题适合日常使用，液态玻璃则提供一种可选的视觉风格。

如果你也想搭建自己的导航站，可以从仓库下载源码，按上面的步骤部署：

- [GitHub 仓库：LLLimit/astro-nav](https://github.com/LLLimit/astro-nav)
- [下载发行版本](https://github.com/LLLimit/astro-nav/releases)
- [查看完整安装说明](https://github.com/LLLimit/astro-nav#readme)

项目采用 MIT 许可证，具体版权与许可条款见仓库的 LICENSE 文件。
