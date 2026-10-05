/**
统一分类opensource
网站：
github
baidu.com
谷歌
具体按照以下样式生成，使用“JavaScript风格格式+单引号”，不要添加"icon字段"和"[]""      
      {
      id: 'github',
      title: 'GitHub',
      description: '全球最大的开源代码托管平台，支持 Git 版本控制，适用于协作开发、项目管理和自动化工作流，是开发者共享与协作的核心工具。'
      shortDesc: '代码托管平台。',
      url: 'https://github.com/',
      category: 'opensource',
      },
描述根据网站实际内容,专业,准确,介绍背景独特优势等等,不要太刻板,臃肿,重复
自动下载图标脚本执行:
npx tsx icon-system/0icon.ts
*/
/**
 * 网站分类列表
 * @type {Array<{id: string, name: string, icon: string}>}
 */
export const categories = [
  {
    id: 'opensource',
    name: '开源平台', icon: '/icons/category/opensource.svg',
  },
  {
    id: 'Studying',
    name: '个人其他站点', icon: '/icons/category/studying.svg',
  },
  {
    id: 'pages',
    name: '静态部署平台', icon: '/icons/category/pages.svg',
  },
];
/**
 * 网站列表
 * @type {Array<{id: string, title: string, description: string, shortDesc: string, url: string, icon: string, category: string}>}
 */
export const sites = [
  //开源      
      {
      id: 'github',
      title: 'GitHub',
      description: '全球最大的开源代码托管平台，支持 Git 版本控制，适用于协作开发、项目管理和自动化工作流，是开发者共享与协作的核心工具。',
      shortDesc: '全球最大代码托管平台。',
      url: 'https://github.com/',
      category: 'opensource',
      icon: '/icons/github.webp',
      },
  //个人其他站点      
      {
      id: 'zywede',
      title: 'zywe.de',
      description: '个人主页与知识集散地。作为技术爱好者，展示自己的全部项目、实践与分享的中心',
      shortDesc: 'zywe个人官网',
      url: 'https://zywe.de/',
      category: 'Studying',
      icon: '/icons/zywede.png',
      },
      {
      id: 'dh_zywede',
      title: 'nav.zywe.de',
      description: '专属导航页,这里汇聚了日常学习、开发与管理服务器所需的所有高效工具与资源链接，快速触达各项在线服务的便捷入口，确保学习与实践的流畅性。',
      shortDesc: '让每个人都有自己的网站式收藏夹',
      url: 'https://dh.zywe.de/',
      category: 'Studying',
      icon: '/icons/dh-zywede.png',
      },
      // pages      
      {
      id: 'github-pages',
      title: 'GitHub Pages',
      description: 'GitHub 提供的静态网站托管服务，支持自定义域名与 HTTPS，可直接从仓库部署，适合个人主页、项目文档与开源展示，集成 Git 工作流，极简且可靠。',
      shortDesc: 'Git 驱动的静态网站托管。',
      url: 'https://pages.github.com/',
      category: 'pages',
      icon: '/icons/github-pages.webp',
      },
      {
      id: 'cloudflare-pages',
      title: 'Cloudflare Pages',
      description: '由全球领先的 CDN 提供商 Cloudflare 推出的前端部署平台，支持 Jamstack 架构，内置构建优化、边缘函数与自动缓存更新，适合高性能 Web 应用与博客。',
      shortDesc: 'CDN 优化的前端部署平台。',
      url: 'https://pages.cloudflare.com/',
      category: 'pages',
      icon: '/icons/cloudflare-pages.webp',
      },
      {
      id: 'vercel',
      title: 'Vercel',
      description: '专为前端开发打造的现代部署平台，由 Next.js 背后团队开发，支持 Serverless 架构、实时预览与多分支部署，适合敏捷开发、商业级应用与个性化项目。',
      shortDesc: 'Next.js 团队出品的部署平台。',
      url: 'https://vercel.com/',
      category: 'pages',
      icon: '/icons/vercel.webp',
      },
];
/**
 * 搜索网站功能
 * @param {string} query - 搜索关键词
 * @returns {Array} - 符合条件的网站列表
 */
export function searchSites(query) {
  if (!query) return sites;
  const lowerQuery = query.toLowerCase();
  return sites.filter(site => {
    return (
      site.title.toLowerCase().includes(lowerQuery) ||
      site.url.toLowerCase().includes(lowerQuery) ||
      site.category.toLowerCase().includes(lowerQuery)
    );
  });
}
/**
 * 将网站数据转换为HTML标记
 * 允许直接在页面中嵌入HTML内容
 * @param {Array} sitesList - 要呈现的网站列表
 * @returns {string} - HTML标记字符串
 */
export function sitesToHtml(sitesList) {
  if (!sitesList || !sitesList.length) return '<p>没有找到符合条件的网站</p>';
  const html = sitesList.map(site => {
    // 转义HTML特殊字符以防止XSS攻击
    const safeTitle = escapeHtml(site.title);
    const safeDesc = escapeHtml(site.shortDesc || site.description);
    const safeUrl = escapeHtml(site.url);
    const safeIcon = escapeHtml(site.icon || '/images/default.svg');
    return `
      <div class="site-card" data-category="${site.category}">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          <div class="site-icon">
            <img src="${safeIcon}" alt="${safeTitle}" loading="lazy" onerror="this.src='/images/default.svg'">
          </div>
          <div class="site-info">
            <h3>${safeTitle}</h3>
            <p>${safeDesc}</p>
          </div>
        </a>
      </div>
    `;
  }).join('');
  return `<div class="sites-grid">${html}</div>`;
}
/**
 * 安全转义HTML特殊字符
 * 防止XSS攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 安全的HTML字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

