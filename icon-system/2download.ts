import { promises as fs } from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import {
  SITE_ICONS_DIR,
  CATEGORY_ICONS_DIR,
  createConcurrencyLimit,
  extractDomain,
  normalizeFilename,
  ensureDir,
  fetchWithTimeout,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  createCommonHeaders
} from './tools.js';
import type { IconTask } from './1analyse.js';
export interface DownloadResult {
  taskId: string;
  success: boolean;
  type: 'site' | 'category';
  path?: string;
  error?: string;
}
const SITE_ICON_SOURCES = [
    {
    name: 'Logo.dev API',
    description: '现代化的Logo API服务，高质量图标',
    getUrl: (domain: string) => `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ&format=png&size=64`,
    timeout: 6000,
    headers: {
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://www.logo.dev/'
    },
    features: ['modern', 'high-quality', 'reliable']
  },
  {
    name: 'Clearbit Logo API',
    description: '高质量商业图标，彩色支持，响应快速',
    getUrl: (domain: string) => `https://logo.clearbit.com/${domain}`,
    timeout: 6000,
    headers: {
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://clearbit.com/'
    },
    features: ['color', 'high-quality', 'commercial']
  },
  {
    name: 'Unavatar API',
    description: '通用头像和图标服务，支持多种源',
    getUrl: (domain: string) => `https://unavatar.io/${domain}`,
    timeout: 4000,
    headers: {
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://unavatar.io/'
    },
    features: ['universal', 'reliable', 'fast']
  },
  {
    name: 'Favicon.io API',
    description: '直接获取网站favicon',
    getUrl: (domain: string) => `https://${domain}/favicon.ico`,
    timeout: 4000,
    headers: {
      'Accept': 'image/x-icon,image/vnd.microsoft.icon,image/*,*/*;q=0.8'
    },
    features: ['direct', 'standard', 'simple']
  },
  {
    name: 'DuckDuckGo Favicon API',
    description: '隐私友好的图标服务，无跟踪',
    getUrl: (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    timeout: 4000,
    headers: {
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://duckduckgo.com/'
    },
    features: ['privacy', 'no-tracking', 'stable']
  },
  {
    name: 'HTML解析方法',
    description: 'HTML页面解析获取favicon，保底方案',
    getUrl: (domain: string) => `https://${domain}`,
    timeout: 5000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    features: ['fallback', 'html-parsing', 'comprehensive'],
    isHtmlParsing: true
  }
];
/**
 * 分类图标API源列表 - 精简稳定版
 *
 * 优化策略：
 * - 只保留3个最稳定的API源
 * - 简化搜索逻辑，提高可靠性
 * - 统一超时时间为5秒，重试1次
 */
const CATEGORY_ICON_SOURCES = [
  {
    name: 'Iconify API',
    description: '大型图标库聚合器，最稳定可靠',
    getUrl: (keyword: string) => `https://api.iconify.design/search?query=${encodeURIComponent(keyword)}&limit=6`,
    timeout: 5000,
    headers: {
      'Accept': 'application/json'
    },
    isDirect: false
  },
  {
    name: 'Simple Icons CDN',
    description: '品牌和流行图标库',
    getUrl: (keyword: string) => `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${encodeURIComponent(keyword.toLowerCase())}.svg`,
    timeout: 5000,
    headers: {
      'Accept': 'image/svg+xml'
    },
    isDirect: true
  },
  {
    name: 'Feather Icons CDN',
    description: '简洁美观的图标库',
    getUrl: (keyword: string) => `https://cdn.jsdelivr.net/npm/feather-icons@latest/dist/icons/${encodeURIComponent(keyword.toLowerCase())}.svg`,
    timeout: 5000,
    headers: {
      'Accept': 'image/svg+xml'
    },
    isDirect: true
  }
];
/**
 * 下载网站和分类图标
 * @param {IconTask[]} siteTasks - 网站任务列表
 * @param {IconTask[]} categoryTasks - 分类任务列表
 * @returns {Promise<DownloadResult[]>} - 下载结果列表
 */
export async function downloadIcons(siteTasks: IconTask[], categoryTasks: IconTask[]): Promise<DownloadResult[]> {
  await ensureDir(SITE_ICONS_DIR);
  await ensureDir(CATEGORY_ICONS_DIR);
  const limit = createConcurrencyLimit(5);
  logInfo(`开始下载图标，共 ${siteTasks.length} 个网站和 ${categoryTasks.length} 个分类...`);
  const sitePromises = siteTasks.map(task => 
    limit(() => downloadSiteIcon(task)));
  const categoryPromises = categoryTasks.map(task => 
    limit(() => downloadCategoryIcon(task)));
  const allResults = await Promise.all([...sitePromises, ...categoryPromises]);
  const successful = allResults.filter(result => result.success).length;
  const failed = allResults.length - successful;
  logSuccess(`图标下载完成! 成功: ${successful}, 失败: ${failed}`);
  return allResults;
}
/**
 * HTML解析方法获取favicon
 * @param {string} domain - 域名
 * @param {Object} source - API源配置
 * @returns {Promise<{data: Buffer, extension: string} | null>} - 图标数据和扩展名或null
 */
async function parseHtmlForFavicon(domain: string, source: any): Promise<{data: Buffer, extension: string} | null> {
  try {
    const url = `https://${domain}`;
    const headers = createCommonHeaders('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const response = await fetchWithTimeout(url, { headers }, source.timeout, 2);
    if (response.statusCode !== 200) {
      return null;
    }
    const html = await response.body.text();
    const faviconUrls = extractFaviconUrls(html, domain);
    for (const faviconUrl of faviconUrls) {
      try {
        const faviconResponse = await fetchWithTimeout(faviconUrl, {
          headers: createCommonHeaders('image/*')
        }, 5000, 1);
        if (faviconResponse.statusCode === 200) {
          const iconData = Buffer.from(await faviconResponse.body.arrayBuffer());
          if (iconData.length > 0) {
            const extension = detectImageExtension(iconData, faviconUrl);
            return { data: iconData, extension };
          }
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  } catch (error: any) {
    throw error;
  }
}
/**
 * 从HTML中提取favicon URL
 * @param {string} html - HTML内容
 * @param {string} domain - 域名
 * @returns {string[]} - favicon URL列表
 */
function extractFaviconUrls(html: string, domain: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/gi,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/gi,
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith('//')) {
        url = `https:${url}`;
      } else if (url.startsWith('/')) {
        url = `https://${domain}${url}`;
      } else if (!url.startsWith('http')) {
        url = `https://${domain}/${url}`;
      }
      urls.push(url);
    }
  }
  urls.push(`https://${domain}/favicon.ico`);
  return Array.from(new Set(urls));
}
/**
 * 检测图像文件类型并返回合适的扩展名
 * @param {Buffer} data - 图像数据
 * @param {string} url - 图像URL（用于后备检测）
 * @returns {string} - 文件扩展名
 */
function detectImageExtension(data: Buffer, url: string): string {
  if (data.length >= 8) {
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return 'png';
    }
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return 'jpg';
    }
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
      return 'gif';
    }
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      return 'webp';
    }
    if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) {
      return 'ico';
    }
    if (data[0] === 0x3C) {
      const text = data.toString('utf8', 0, Math.min(100, data.length));
      if (text.includes('<svg') || text.includes('<?xml')) {
        return 'svg';
      }
    }
  }
  const urlExtension = url.split('.').pop()?.toLowerCase();
  if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'].includes(urlExtension)) {
    return urlExtension === 'jpeg' ? 'jpg' : urlExtension;
  }
  return 'ico';
}
/**
 * 下载网站图标
 * @param {IconTask} task - 网站任务
 * @returns {Promise<DownloadResult>} - 下载结果
 */
async function downloadSiteIcon(task: IconTask): Promise<DownloadResult> {
  if (!task.url) {
    return {
      taskId: task.id,
      success: false,
      type: 'site',
      error: '缺少URL'
    };
  }
  logInfo(`开始下载网站图标: ${task.name} (${task.id})`);
  const domain = extractDomain(task.url);
  for (const source of SITE_ICON_SOURCES) {
    try {
      if (source.isHtmlParsing) {
        const iconResult = await parseHtmlForFavicon(domain, source);
        if (iconResult) {
          const { data: iconData, extension } = iconResult;
          const fileName = `${normalizeFilename(task.id)}.${extension}`;
          const filePath = path.join(SITE_ICONS_DIR, fileName);
          await fs.writeFile(filePath, iconData);
          logSuccess(`成功下载网站图标: ${task.name} (使用 ${source.name})`);
          return {
            taskId: task.id,
            success: true,
            type: 'site',
            path: filePath
          };
        }
      } else {
        const sourceUrl = source.getUrl(domain);
        const acceptHeader = source.headers?.['Accept'] || 'image/webp,image/apng,image/*,*/*;q=0.8';
        const cleanHeaders = source.headers ? Object.fromEntries(
          Object.entries(source.headers).filter(([_, value]) => value !== undefined)
        ) : {};
        const headers = createCommonHeaders(acceptHeader, cleanHeaders);
        const response = await fetchWithTimeout(sourceUrl, { headers }, source.timeout, 2);
        if (response.statusCode === 200) {
          const iconData = Buffer.from(await response.body.arrayBuffer());
          if (iconData && iconData.length > 0) {
            const fileName = `${normalizeFilename(task.id)}.ico`;
            const filePath = path.join(SITE_ICONS_DIR, fileName);
            await fs.writeFile(filePath, iconData);
            logSuccess(`成功下载网站图标: ${task.name} (使用 ${source.name})`);
            return {
              taskId: task.id,
              success: true,
              type: 'site',
              path: filePath
            };
          }
        }
      }
    } catch (error: any) {
      logWarning(`从 ${source.name} 下载图标失败: ${task.name} - ${error.message}`);
    }
  }
  logError(`所有图标源都无法为 ${task.name} 获取图标`);
  return {
    taskId: task.id,
    success: false,
    type: 'site',
    error: '所有图标源都失败'
  };
}
/**
 * 通过API搜索并下载分类图标 - 精简版
 * @param {IconTask} task - 分类任务
 * @returns {Promise<Buffer | null>} - 图标数据或null（如果失败）
 */
export async function downloadCategoryIconFromAPI(task: IconTask): Promise<Buffer | null> {
  const keywords = extractEnhancedKeywords(task.name, task.id);
  logInfo(`尝试通过API搜索分类图标: ${task.name}，关键词: [${keywords.join(', ')}]`);
  for (const source of CATEGORY_ICON_SOURCES) {
    logInfo(`尝试API源: ${source.name}`);
    for (const keyword of keywords) {
      if (!keyword) continue;
      try {
        logInfo(`  使用关键词: "${keyword}"`);
        if (source.isDirect) {
          const iconData = await downloadDirectIcon(source, keyword);
          if (iconData) {
            logSuccess(`✅ 成功从 ${source.name} 下载分类图标: ${task.name} (关键词: ${keyword})`);
            return iconData;
          }
        } else {
          const iconData = await searchAndDownloadIcon(source, keyword);
          if (iconData) {
            logSuccess(`✅ 成功从 ${source.name} 下载分类图标: ${task.name} (关键词: ${keyword})`);
            return iconData;
          }
        }
      } catch (error: any) {
        logWarning(`  关键词 "${keyword}" 失败: ${error.message}`);
      }
    }
    logWarning(`❌ API源 ${source.name} 的所有关键词都失败，尝试下一个API源`);
  }
  logWarning(`所有API源都无法为分类 ${task.name} 找到合适的图标`);
  return null;
}
/**
 * 直接下载图标（适用于Tabler Icons等直接API）
 * @param {Object} source - API源配置
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Buffer | null>} - 图标数据或null
 */
async function downloadDirectIcon(source: any, keyword: string): Promise<Buffer | null> {
  try {
    const url = source.getUrl(keyword);
    const headers = createCommonHeaders('image/svg+xml', source.headers);
    const response = await fetchWithTimeout(url, { headers }, source.timeout, 1);
    if (response.statusCode === 200) {
      const iconData = Buffer.from(await response.body.arrayBuffer());
      if (iconData.length > 0) {
        return iconData;
      }
    }
  } catch (error: any) {
    throw error;
  }
  return null;
}
/**
 * 搜索并下载图标
 * @param {Object} source - API源配置
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Buffer | null>} - 图标数据或null
 */
async function searchAndDownloadIcon(source: any, keyword: string): Promise<Buffer | null> {
  try {
    const searchUrl = source.getUrl(keyword);
    const headers = createCommonHeaders('application/json', source.headers);
    const searchResponse = await fetchWithTimeout(searchUrl, { headers }, source.timeout, 2);
    if (searchResponse.statusCode !== 200) {
      return null;
    }
    const searchData = await searchResponse.body.json();
    switch (source.name) {
      case 'Iconify API':
        return await downloadFromIconify(searchData);
      default:
        logWarning(`未知的API源: ${source.name}`);
        return null;
    }
  } catch (error: any) {
    throw error;
  }
}
/**
 * 从Iconify API下载图标
 * @param {Object} searchData - 搜索结果数据
 * @returns {Promise<Buffer | null>} - 图标数据或null
 */
async function downloadFromIconify(searchData: any): Promise<Buffer | null> {
  try {
    if (searchData.icons && searchData.icons.length > 0) {
      const firstIcon = searchData.icons[0];
      const [iconSet, iconName] = firstIcon.split(':');
      if (iconSet && iconName) {
        const downloadUrl = `https://api.iconify.design/${iconSet}/${iconName}.svg`;
        const headers = createCommonHeaders('image/svg+xml');
        const response = await fetchWithTimeout(downloadUrl, { headers }, 5000, 1);
        if (response.statusCode === 200) {
          const iconData = Buffer.from(await response.body.arrayBuffer());
          if (iconData.length > 0) {
            return iconData;
          }
        }
      }
    }
  } catch (error: any) {
    throw error;
  }
  return null;
}
/**
 * 下载分类图标
 * 执行策略：直接API搜索，失败则保底兜底
 * @param {IconTask} task - 分类任务
 * @returns {Promise<DownloadResult>} - 下载结果
 */
async function downloadCategoryIcon(task: IconTask): Promise<DownloadResult> {
  logInfo(`开始获取分类图标: ${task.name} (${task.id})`);
  try {
    let iconData: Buffer | null = null;
    let fileName: string;
    let filePath: string;
    iconData = await downloadCategoryIconFromAPI(task);
    if (iconData) {
      fileName = `${normalizeFilename(task.id)}.svg`;
      filePath = path.join(CATEGORY_ICONS_DIR, fileName);
      await fs.writeFile(filePath, iconData);
      logSuccess(`成功通过API搜索下载分类图标: ${task.name}`);
      return {
        taskId: task.id,
        success: true,
        type: 'category',
        path: filePath
      };
    }
    logInfo(`API搜索失败，使用字母图标生成作为保底: ${task.name}`);
    iconData = await generateLetterIcon(task.name, task.id);
    fileName = `${normalizeFilename(task.id)}.svg`;
    filePath = path.join(CATEGORY_ICONS_DIR, fileName);
    await fs.writeFile(filePath, iconData);
    logSuccess(`成功生成字母图标作为保底: ${task.name}`);
    return {
      taskId: task.id,
      success: true,
      type: 'category',
      path: filePath
    };
  } catch (error: any) {
    logError(`获取分类图标失败: ${task.name} - ${error.message}`);
    return {
      taskId: task.id,
      success: false,
      type: 'category',
      error: error.message
    };
  }
}
/**
 * 生成高科技感字母图标
 * @param {string} categoryName - 分类名称，将从中提取前两个字符用于图标显示
 * @param {string} id - 分类ID，用于生成图标风格和确保相同ID生成相同图标
 * @returns {Promise<Buffer>} - SVG图标数据
 */
async function generateLetterIcon(categoryName: string, id: string): Promise<Buffer> {
  const displayText = categoryName.substring(0, 2);
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const schemes = [
    {
      name: "Cyberpunk / 虚拟空间",
      bg: "#0d0d0d",
      text: "#00ffff",
      filter: `<filter id="cyberGlow" filterUnits="userSpaceOnUse">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0.5  0 0 1 0 1  0 0 0 5 -1" result="glow" />
                <feBlend in="SourceGraphic" in2="glow" mode="normal" />
              </filter>`,
      pattern: `<g opacity="0.15" stroke="#00ffff" stroke-width="0.5" filter="url(#cyberGlow)">
                 <!-- 透视网格 -->
                 <path d="M10,80 L50,95 L90,80" />
                 <path d="M10,60 L50,75 L90,60" />
                 <path d="M10,40 L50,55 L90,40" />
                 <path d="M10,20 L50,35 L90,20" />
                 <path d="M20,10 L20,90" />
                 <path d="M40,10 L40,90" />
                 <path d="M60,10 L60,90" />
                 <path d="M80,10 L80,90" />
               </g>
               <!-- 数字动效 -->
               <g opacity="0.2" fill="#00ffff" font-family="monospace" font-size="8">
                 <text x="15" y="20">010101</text>
                 <text x="65" y="35">11001</text>
                 <text x="25" y="75">0110</text>
                 <text x="75" y="85">10010</text>
               </g>`
    },
    {
      name: "冷感现代 / 未来仪表盘风格",
      bg: "#1a1f2b",
      text: "#ffffff",
      filter: `<filter id="frostGlow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
                <feComponentTransfer in="offsetBlur" result="brightBlur">
                  <feFuncA type="linear" slope="1.2" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="brightBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>`,
      pattern: `<g opacity="0.2" stroke="#b0d0ff" stroke-width="0.6" filter="url(#frostGlow)">
                 <!-- 玻璃拟态曲线 -->
                 <path d="M30,20 Q50,5 70,20 T90,50 Q75,70 50,75 T20,60 Q15,40 30,20" fill="none" />
                 <path d="M40,30 Q50,20 60,30 T70,50 Q60,60 50,60 T30,50 Q35,40 40,30" fill="none" />
                 <!-- 小圆点矩阵 -->
                 <g fill="#ffffff">
                   <circle cx="20" cy="20" r="1" />
                   <circle cx="20" cy="40" r="1" />
                   <circle cx="20" cy="60" r="1" />
                   <circle cx="20" cy="80" r="1" />
                   <circle cx="40" cy="20" r="1" />
                   <circle cx="40" cy="40" r="1" />
                   <circle cx="40" cy="60" r="1" />
                   <circle cx="40" cy="80" r="1" />
                   <circle cx="60" cy="20" r="1" />
                   <circle cx="60" cy="40" r="1" />
                   <circle cx="60" cy="60" r="1" />
                   <circle cx="60" cy="80" r="1" />
                   <circle cx="80" cy="20" r="1" />
                   <circle cx="80" cy="40" r="1" />
                   <circle cx="80" cy="60" r="1" />
                   <circle cx="80" cy="80" r="1" />
                 </g>
               </g>`
    },
    {
      name: "工业科技 / 科研装置",
      bg: "#ffffff",
      text: "#4c4c4c",
      filter: `<filter id="emboss">
                <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
                <feSpecularLighting in="blur" surfaceScale="2" specularConstant="1" specularExponent="20" lighting-color="#ffffff" result="specular">
                  <fePointLight x="-5000" y="-10000" z="20000" />
                </feSpecularLighting>
                <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />
                <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
              </filter>`,
      pattern: `<g opacity="0.6" stroke="#aaaaaa" stroke-width="0.8" filter="url(#emboss)">
                 <!-- 3D 浮雕线 -->
                 <path d="M20,20 L80,20 L80,80 L20,80 Z" fill="none" />
                 <path d="M30,30 L70,30 L70,70 L30,70 Z" fill="none" />
                 <line x1="20" y1="20" x2="30" y2="30" />
                 <line x1="80" y1="20" x2="70" y2="30" />
                 <line x1="80" y1="80" x2="70" y2="70" />
                 <line x1="20" y1="80" x2="30" y2="70" />
                 <!-- 幾何正六边形纹理 -->
                 <g fill="none" stroke="#ddd">
                   <path d="M50,25 L58,30 L58,40 L50,45 L42,40 L42,30 Z" />
                   <path d="M30,50 L38,55 L38,65 L30,70 L22,65 L22,55 Z" />
                   <path d="M70,50 L78,55 L78,65 L70,70 L62,65 L62,55 Z" />
                 </g>
               </g>`
    },
    {
      name: "数字安全 / 区块链可视化",
      bg: "#15192e",
      text: "#32ff6a",
      filter: `<filter id="dataGlow">
                <feFlood flood-color="#32ff6a" flood-opacity="0.3" result="glowColor" />
                <feComposite in="glowColor" in2="SourceAlpha" operator="in" result="innerGlow" />
                <feGaussianBlur in="innerGlow" stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>`,
      pattern: `<g opacity="0.3" stroke="#32ff6a" stroke-width="1.2" stroke-dasharray="4 2">
                 <!-- 数据光线流 -->
                 <path d="M20,20 L40,20 L40,40 L60,40 L60,60 L80,60" fill="none" />
                 <path d="M80,20 L60,20 L60,40 L40,40 L40,60 L20,60" fill="none" />
                 <!-- 中等粗度科技感断线 -->
                 <path d="M20,80 L40,80" stroke-dasharray="4 3" />
                 <path d="M50,80 L70,80" stroke-dasharray="4 3" />
                 <path d="M80,80 L90,80" stroke-dasharray="4 3" />
                 <path d="M20,40 L10,40" stroke-dasharray="4 3" />
                 <path d="M80,40 L90,40" stroke-dasharray="4 3" />
               </g>
               <!-- 数据点 -->
               <g fill="#32ff6a">
                 <circle cx="20" cy="20" r="2" opacity="0.8" />
                 <circle cx="40" cy="40" r="2" opacity="0.8" />
                 <circle cx="60" cy="60" r="2" opacity="0.8" />
                 <circle cx="80" cy="80" r="2" opacity="0.8" />
               </g>`
    },
    {
      name: "智能硬件 / 芯片架构风格",
      bg: "linear-gradient(135deg, #2c2c2c 0%, #4f4f4f 100%)",
      text: "#00e0ff",
      filter: `<filter id="circuitGlow">
                <feFlood flood-color="#00e0ff" flood-opacity="0.4" result="glowColor" />
                <feComposite in="glowColor" in2="SourceAlpha" operator="in" result="innerGlow" />
                <feGaussianBlur in="innerGlow" stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>`,
      pattern: `<g opacity="0.4" stroke="#00e0ff" stroke-width="0.8" filter="url(#circuitGlow)">
                 <!-- 对称电路图结构 -->
                 <path d="M20,20 L80,20" fill="none" />
                 <path d="M20,80 L80,80" fill="none" />
                 <path d="M20,20 L20,80" fill="none" />
                 <path d="M80,20 L80,80" fill="none" />
                 <path d="M20,50 L40,50" fill="none" />
                 <path d="M60,50 L80,50" fill="none" />
                 <path d="M50,20 L50,40" fill="none" />
                 <path d="M50,60 L50,80" fill="none" />
                 <circle cx="50" cy="50" r="10" fill="none" />
                 <circle cx="50" cy="50" r="5" fill="none" />
                 <!-- 矩阵动画元素 -->
                 <g fill="#00e0ff">
                   <rect x="17" y="17" width="6" height="6" opacity="0.6" />
                   <rect x="77" y="17" width="6" height="6" opacity="0.6" />
                   <rect x="17" y="77" width="6" height="6" opacity="0.6" />
                   <rect x="77" y="77" width="6" height="6" opacity="0.6" />
                 </g>
               </g>`
    }
  ];
  const schemeIndex = hash % schemes.length;
  const scheme = schemes[schemeIndex];
  const isTwoChars = displayText.length === 2;
  const hasChinese = /[\u4e00-\u9fa5]/.test(displayText);
  let fontSize: number;
  let yPos: number;
  if (isTwoChars) {
    if (hasChinese) {
      fontSize = 48;
      yPos = 63;
    } else {
      fontSize = 42;
      yPos = 66;
    }
  } else {
    if (hasChinese) {
      fontSize = 60;
      yPos = 65;
    } else {
      fontSize = 52;
      yPos = 68;
    }
  }
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 100 100">
  <defs>
    <!-- 特效滤镜 -->
    ${scheme.filter}
  </defs>
  <!-- 背景 -->
  <rect x="0" y="0" width="100" height="100" rx="5" ry="5" fill="${scheme.bg}" />
  <!-- 线条图案 -->
  ${scheme.pattern}
  <!-- 字母/汉字 -->
  <text x="50" y="${yPos}" font-family="'Segoe UI', Arial, sans-serif" font-size="${fontSize}" font-weight="bold" 
        text-anchor="middle" fill="${scheme.text}">${displayText.toUpperCase()}</text> <!-- 使用 displayText -->
  <!-- 小版权信息 -->
  <text x="50" y="94" font-family="monospace" font-size="3" text-anchor="middle" 
        fill="${scheme.text}" opacity="0.5">z y w e / ${scheme.name.includes('/') ? scheme.name.split('/')[1].trim() : scheme.name}</text>
</svg>
  `.trim();
  return Buffer.from(svg);
}
/**
 * 简化的关键词提取函数 - 精简稳定版
 *
 * 优化策略：
 * 1. 第一优先级：直接使用分类ID进行搜索
 * 2. 第二优先级：使用中文分类名称到英文关键词的映射表
 *
 * @param {string} name - 分类名称
 * @param {string} id - 分类ID
 * @returns {string[]} - 关键词列表，按优先级排序
 */
export function extractEnhancedKeywords(name: string, id: string): string[] {
  const keywords: string[] = [];
  if (id && id.trim() !== '') {
    keywords.push(id.toLowerCase());
  }
  const categoryKeywords = extractCategoryKeywords(name);
  keywords.push(...categoryKeywords);
  const uniqueKeywords = Array.from(new Set(keywords))
    .filter(kw => kw.trim().length > 1)
    .slice(0, 4);
  return uniqueKeywords;
}
/**
 * 智能分类关键词提取系统
 * 支持模糊匹配、多级匹配、同义词匹配的通用映射系统
 * @param {string} categoryName - 分类名称
 * @returns {string[]} - 提取的图标关键词数组
 */
function extractCategoryKeywords(categoryName: string): string[] {
  const keywords: string[] = [];
  const name = categoryName.toLowerCase();
  const exactMapping = getExactCategoryMapping();
  for (const [pattern, iconKeywords] of Object.entries(exactMapping)) {
    if (name.includes(pattern)) {
      keywords.push(...iconKeywords);
      return keywords;
    }
  }
  const keywordMapping = getKeywordCategoryMapping();
  for (const [keyword, iconKeywords] of Object.entries(keywordMapping)) {
    if (name.includes(keyword)) {
      keywords.push(...iconKeywords);
    }
  }
  if (keywords.length === 0) {
    const fuzzyKeywords = getFuzzyCategoryMapping(name);
    keywords.push(...fuzzyKeywords);
  }
  if (keywords.length === 0) {
    keywords.push('circle', 'square', 'star');
  }
  return keywords;
}
/**
 * 精确匹配映射表 - 特定分类的精确映射
 * 优先级最高，匹配后直接返回，不再进行其他匹配
 */
function getExactCategoryMapping(): { [key: string]: string[] } {
  return {
    '测速工具': ['gauge', 'speedometer', 'zap'],
    '站长工具': ['settings', 'tool', 'wrench'],
    '域名工具': ['link', 'globe', 'world'],
    '域名服务': ['server', 'dns', 'globe'],
    '网络安全': ['shield', 'security', 'lock'],
    '国外媒体': ['radio', 'globe', 'broadcast'],
    '免费看赛事': ['tv', 'monitor', 'play'],
    '聊天': ['message-circle', 'chat', 'messages'],
    '编程': ['code', 'terminal', 'laptop'],
    '游戏相关': ['gamepad-2', 'game-controller', 'play'],
    'vps厂商': ['server', 'cloud', 'database'],
    '优质论坛': ['users', 'forum', 'message-square'],
    '开源平台': ['git-branch', 'github', 'code'],
    '在线教育': ['graduation-cap', 'book-open', 'school'],
    '教育平台': ['graduation-cap', 'book', 'users'],
    '学习网站': ['book-open', 'brain', 'lightbulb'],
    '电商平台': ['shopping-cart', 'store', 'credit-card'],
    '购物网站': ['shopping-bag', 'gift', 'tag'],
    '金融服务': ['dollar-sign', 'credit-card', 'bank'],
    '投资理财': ['trending-up', 'pie-chart', 'coins'],
    '医疗健康': ['heart', 'stethoscope', 'pill'],
    '在线医疗': ['user-check', 'heart-pulse', 'hospital'],
    '旅游出行': ['map-pin', 'plane', 'compass'],
    '酒店预订': ['bed', 'building', 'map'],
    '美食餐饮': ['utensils', 'chef-hat', 'coffee'],
    '外卖平台': ['truck', 'utensils', 'clock'],
    '摄影图片': ['camera', 'image', 'aperture'],
    '设计素材': ['palette', 'brush', 'layers'],
    '音乐平台': ['music', 'headphones', 'radio'],
    '视频网站': ['video', 'play', 'film'],
    '直播平台': ['video', 'users', 'broadcast'],
    '社交网络': ['users', 'heart', 'share'],
    '即时通讯': ['message-circle', 'phone', 'video'],
    '新闻资讯': ['newspaper', 'rss', 'bell'],
    '博客平台': ['edit', 'file-text', 'pen-tool'],
    '内容创作': ['edit-3', 'feather', 'type'],
    '云存储': ['cloud', 'hard-drive', 'upload'],
    '文件分享': ['share', 'link', 'download'],
    '办公协作': ['briefcase', 'users', 'calendar'],
    '项目管理': ['trello', 'check-square', 'list'],
    '在线会议': ['video', 'users', 'monitor'],
    '邮箱服务': ['mail', 'inbox', 'send'],
    '搜索引擎': ['search', 'globe', 'compass'],
    '地图导航': ['map', 'navigation', 'compass'],
    '天气预报': ['cloud-sun', 'thermometer', 'wind'],
    '翻译工具': ['languages', 'globe', 'type'],
    '代码托管': ['github', 'git-branch', 'code'],
    '技术文档': ['book', 'file-text', 'help-circle'],
    '在线编程': ['code', 'terminal', 'cpu'],
    '数据分析': ['bar-chart', 'pie-chart', 'trending-up'],
    '人工智能': ['brain', 'cpu', 'zap'],
    '机器学习': ['brain', 'network', 'trending-up'],
    '区块链': ['link', 'shield', 'coins'],
    '加密货币': ['coins', 'trending-up', 'shield']
  };
}
/**
 * 关键词包含匹配映射表 - 通用分类关键词
 * 支持模糊匹配，一个分类名可以匹配多个关键词
 */
function getKeywordCategoryMapping(): { [key: string]: string[] } {
  return {
    '工具': ['tool', 'wrench', 'settings'],
    '平台': ['layers', 'grid', 'square'],
    '服务': ['server', 'cloud', 'globe'],
    '网站': ['globe', 'monitor', 'link'],
    '系统': ['cpu', 'server', 'settings'],
    '软件': ['package', 'download', 'install'],
    '应用': ['smartphone', 'tablet', 'monitor'],
    '插件': ['puzzle', 'plus', 'package'],
    '扩展': ['plus-circle', 'expand', 'maximize'],
    '开发': ['code', 'terminal', 'git-branch'],
    '编程': ['code', 'laptop', 'terminal'],
    '代码': ['code', 'file-code', 'github'],
    '技术': ['cpu', 'server', 'code'],
    '数据': ['database', 'bar-chart', 'hard-drive'],
    '云': ['cloud', 'server', 'upload'],
    '网络': ['wifi', 'globe', 'link'],
    '安全': ['shield', 'lock', 'key'],
    '监控': ['eye', 'activity', 'bar-chart'],
    '测试': ['check-circle', 'bug', 'test-tube'],
    '部署': ['upload', 'server', 'rocket'],
    'api': ['link', 'code', 'server'],
    '接口': ['link', 'plug', 'code'],
    '电商': ['shopping-cart', 'store', 'credit-card'],
    '购物': ['shopping-bag', 'gift', 'tag'],
    '商城': ['store', 'building', 'shopping-cart'],
    '支付': ['credit-card', 'dollar-sign', 'wallet'],
    '金融': ['dollar-sign', 'trending-up', 'bank'],
    '银行': ['building', 'dollar-sign', 'credit-card'],
    '投资': ['trending-up', 'pie-chart', 'coins'],
    '理财': ['coins', 'trending-up', 'calculator'],
    '保险': ['shield', 'umbrella', 'heart'],
    '视频': ['video', 'play', 'film'],
    '音频': ['volume-2', 'headphones', 'music'],
    '音乐': ['music', 'headphones', 'radio'],
    '图片': ['image', 'camera', 'photo'],
    '照片': ['camera', 'image', 'aperture'],
    '设计': ['palette', 'brush', 'edit'],
    '创作': ['edit-3', 'feather', 'pen-tool'],
    '素材': ['layers', 'image', 'package'],
    '媒体': ['radio', 'tv', 'broadcast'],
    '新闻': ['newspaper', 'rss', 'bell'],
    '资讯': ['info', 'bell', 'rss'],
    '博客': ['edit', 'file-text', 'pen-tool'],
    '文章': ['file-text', 'edit', 'book'],
    '社交': ['users', 'heart', 'share'],
    '聊天': ['message-circle', 'chat', 'messages'],
    '通讯': ['phone', 'mail', 'message'],
    '论坛': ['users', 'message-square', 'forum'],
    '社区': ['users', 'home', 'heart'],
    '分享': ['share', 'link', 'send'],
    '交友': ['users', 'heart', 'user-plus'],
    '教育': ['graduation-cap', 'book', 'school'],
    '学习': ['book-open', 'brain', 'lightbulb'],
    '培训': ['users', 'graduation-cap', 'book'],
    '课程': ['book', 'play', 'calendar'],
    '考试': ['check-square', 'edit', 'clock'],
    '学校': ['school', 'building', 'graduation-cap'],
    '大学': ['graduation-cap', 'building', 'book'],
    '健康': ['heart', 'activity', 'shield'],
    '医疗': ['stethoscope', 'pill', 'heart-pulse'],
    '运动': ['activity', 'heart', 'zap'],
    '健身': ['activity', 'heart', 'target'],
    '美食': ['utensils', 'chef-hat', 'coffee'],
    '餐饮': ['utensils', 'coffee', 'store'],
    '旅游': ['map-pin', 'plane', 'compass'],
    '出行': ['car', 'plane', 'map'],
    '酒店': ['bed', 'building', 'map'],
    '住宿': ['home', 'bed', 'key'],
    '地图': ['map', 'navigation', 'compass'],
    '导航': ['navigation', 'compass', 'map-pin'],
    '天气': ['cloud-sun', 'thermometer', 'wind'],
    '游戏': ['gamepad-2', 'play', 'target'],
    '娱乐': ['smile', 'star', 'heart'],
    '直播': ['video', 'broadcast', 'users'],
    '电影': ['film', 'play', 'tv'],
    '电视': ['tv', 'monitor', 'play'],
    '体育': ['activity', 'target', 'award'],
    '赛事': ['trophy', 'target', 'activity'],
    '办公': ['briefcase', 'calendar', 'file-text'],
    '文档': ['file-text', 'book', 'edit'],
    '表格': ['grid', 'table', 'calculator'],
    '演示': ['presentation', 'monitor', 'play'],
    '会议': ['video', 'users', 'calendar'],
    '协作': ['users', 'share', 'link'],
    '管理': ['settings', 'list', 'check-square'],
    '项目': ['folder', 'list', 'check-square'],
    '任务': ['check-square', 'list', 'clock'],
    '日程': ['calendar', 'clock', 'bell'],
    '邮箱': ['mail', 'inbox', 'send'],
    '存储': ['hard-drive', 'database', 'archive'],
    '备份': ['archive', 'hard-drive', 'shield'],
    '同步': ['refresh-cw', 'cloud', 'link'],
    '下载': ['download', 'arrow-down', 'package'],
    '上传': ['upload', 'arrow-up', 'cloud'],
    '文件': ['file', 'folder', 'archive'],
    '搜索': ['search', 'zoom-in', 'eye'],
    '查找': ['search', 'eye', 'zoom-in'],
    '发现': ['compass', 'eye', 'star'],
    '推荐': ['thumbs-up', 'star', 'heart'],
    '翻译': ['languages', 'globe', 'type'],
    '语言': ['languages', 'globe', 'message-circle'],
    '免费': ['gift', 'heart', 'star'],
    '在线': ['globe', 'wifi', 'monitor'],
    '移动': ['smartphone', 'tablet', 'wifi'],
    '桌面': ['monitor', 'laptop', 'desktop'],
    '网页': ['globe', 'monitor', 'link'],
    '客户端': ['download', 'package', 'monitor']
  };
}
/**
 * 模糊匹配函数 - 最后的回退机制
 * 基于分类名称的语义分析，提供合理的图标建议
 * @param {string} name - 分类名称（已转为小写）
 * @returns {string[]} - 模糊匹配的图标关键词
 */
function getFuzzyCategoryMapping(name: string): string[] {
  const fuzzyRules = [
    { pattern: /\d+|v\d|版本/, keywords: ['package', 'download', 'tool'] },
    { pattern: /[a-z]{3,}/, keywords: ['code', 'terminal', 'globe'] },
    { pattern: /网/, keywords: ['globe', 'wifi', 'link'] },
    { pattern: /库/, keywords: ['database', 'archive', 'package'] },
    { pattern: /中心/, keywords: ['target', 'home', 'server'] },
    { pattern: /助手|帮助|辅助/, keywords: ['help-circle', 'user-check', 'tool'] },
    { pattern: /管理/, keywords: ['settings', 'list', 'check-square'] },
    { pattern: /分析/, keywords: ['bar-chart', 'pie-chart', 'trending-up'] },
    { pattern: /监控/, keywords: ['eye', 'activity', 'shield'] },
    { pattern: /优化/, keywords: ['zap', 'trending-up', 'settings'] },
    { pattern: /转换/, keywords: ['refresh-cw', 'arrow-right', 'shuffle'] },
    { pattern: /生成/, keywords: ['plus', 'edit', 'cpu'] },
    { pattern: /检测/, keywords: ['search', 'eye', 'check-circle'] },
    { pattern: /测试/, keywords: ['check-circle', 'bug', 'activity'] },
    { pattern: /下载/, keywords: ['download', 'arrow-down', 'package'] },
    { pattern: /上传/, keywords: ['upload', 'arrow-up', 'cloud'] },
    { pattern: /分享/, keywords: ['share', 'link', 'send'] },
    { pattern: /收藏/, keywords: ['bookmark', 'heart', 'star'] },
    { pattern: /推荐/, keywords: ['thumbs-up', 'star', 'heart'] },
    { pattern: /热门/, keywords: ['trending-up', 'fire', 'star'] },
    { pattern: /最新/, keywords: ['clock', 'bell', 'refresh-cw'] },
    { pattern: /官方/, keywords: ['check-circle', 'shield', 'award'] },
    { pattern: /专业/, keywords: ['award', 'star', 'briefcase'] },
    { pattern: /企业/, keywords: ['briefcase', 'building', 'users'] },
    { pattern: /个人/, keywords: ['user', 'home', 'heart'] }
  ];
  for (const rule of fuzzyRules) {
    if (rule.pattern.test(name)) {
      return rule.keywords;
    }
  }
  return ['circle', 'square', 'star'];
}