import { promises as fs } from 'fs';
import * as path from 'path';
import { 
  NAV_LINKS_PATH, 
  logInfo, 
  logWarning, 
  logSuccess, 
  logError,
  extractDomain,
  normalizeFilename
} from './tools.js';
export interface IconTask {
  id: string;
  name: string;
  url?: string;
  type: 'site' | 'category';
}
export interface AnalysisResult {
  siteTasks: IconTask[];
  categoryTasks: IconTask[];
}
/**
 * @param {string} objectBlock - 包含属性的对象块字符串
 * @param {string} propName - 要提取的属性名
 * @returns {string|null} - 提取的属性值，如果不存在则返回null
 */
function extractProperty(objectBlock: string, propName: string): string | null {
  const patterns = [
    new RegExp(`"${propName}"\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${propName}\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${propName}\\s*:\\s*'([^']+)'`, 'i')
  ];
  for (const pattern of patterns) {
    const match = objectBlock.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}
/**
 * 分析 navLinks.js 文件，找出缺少图标的网站和分类
 * @returns {Promise<AnalysisResult>} 分析结果，包含网站和分类任务
 */
export async function analyzeNavLinks(): Promise<AnalysisResult> {
  try {
    const content = await fs.readFile(NAV_LINKS_PATH, 'utf-8');
    logInfo(`正在分析 navLinks.js 文件...`);
    const categoryTasks = await analyzeCategoriesInContent(content);
    const siteTasks = await analyzeSitesInContent(content);
    logSuccess(`分析完成! 发现 ${siteTasks.length} 个网站和 ${categoryTasks.length} 个分类需要下载图标`);
    return { siteTasks, categoryTasks };
  } catch (error) {
    logError('分析 navLinks.js 文件失败:', error);
    throw error;
  }
}
/**
 * 分析内容中的分类数据
 * @param {string} content - navLinks.js 文件内容
 * @returns {Promise<IconTask[]>} 分类任务列表
 */
async function analyzeCategoriesInContent(content: string): Promise<IconTask[]> {
  const tasks: IconTask[] = [];
  const categoryRegex = /export\s+const\s+categories\s*=\s*\[([\s\S]*?)\];/;
  const match = content.match(categoryRegex);
  if (!match) {
    logWarning('无法在 navLinks.js 中找到分类定义');
    return tasks;
  }
  const categoriesBlock = match[1];
  const objectBlockRegex = /\{[\s\S]*?\}(?:,|\s*\n)/g;
  const objectBlocks: string[] = [];
  let blockMatch;
  while ((blockMatch = objectBlockRegex.exec(categoriesBlock)) !== null) {
    objectBlocks.push(blockMatch[0]);
  }
  let categoriesWithIcon = 0;
  let categoriesWithoutIcon = 0;
  const processedIds = new Set(); 
  for (const block of objectBlocks) {
    let id = extractProperty(block, 'id');
    if (!id) continue;
    let name = extractProperty(block, 'name');
    if (!name) continue;
    let icon = extractProperty(block, 'icon');
    if (processedIds.has(id)) continue;
    processedIds.add(id);
    if (!icon) {
      tasks.push({
        id,
        name,
        type: 'category'
      });
      categoriesWithoutIcon++;
      logInfo(`发现缺少图标的分类: ${name} (${id})`);
    } else {
      categoriesWithIcon++;
    }
  }
  logInfo(`统计: ${categoriesWithIcon} 个分类已有图标, ${categoriesWithoutIcon} 个分类缺少图标`);
  return tasks;
}
/**
 * 分析内容中的网站数据
 * @param {string} content - navLinks.js 文件内容
 * @returns {Promise<IconTask[]>} 网站任务列表
 */
async function analyzeSitesInContent(content: string): Promise<IconTask[]> {
  const tasks: IconTask[] = [];
  const sitesArrayMatch = content.match(/export\s+const\s+sites\s*=\s*\[([\s\S]*?)\];/);
  if (!sitesArrayMatch) {
    logWarning('未找到 sites 数组');
    return tasks;
  }
  const sitesContent = sitesArrayMatch[1];
  const objectBlockRegex = /\{[\s\S]*?\}(?:,|\s*\n)/g;
  const objectBlocks: string[] = [];
  let blockMatch;
  while ((blockMatch = objectBlockRegex.exec(sitesContent)) !== null) {
    objectBlocks.push(blockMatch[0]);
  }
  let sitesWithIcon = 0;
  let sitesWithoutIcon = 0;
  const processedIds = new Set(); 
  for (const block of objectBlocks) {
    let id = extractProperty(block, 'id');
    if (!id) continue;
    let title = extractProperty(block, 'title');
    if (!title) continue;
    let url = extractProperty(block, 'url');
    if (!url) continue;
    let icon = extractProperty(block, 'icon');
    if (processedIds.has(id)) continue;
    processedIds.add(id);
    if (!icon) {
      tasks.push({
        id,
        name: title || id,
        url,
        type: 'site'
      });
      sitesWithoutIcon++;
      logInfo(`发现缺少图标的网站: ${title || id} (${url})`);
    } else {
      sitesWithIcon++;
    }
  }
  logInfo(`统计: ${sitesWithIcon} 个网站已有图标, ${sitesWithoutIcon} 个网站缺少图标`);
  return tasks;
}
