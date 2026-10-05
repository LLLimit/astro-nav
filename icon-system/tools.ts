import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { request } from 'undici';
import pLimit from 'p-limit';
import chalk from 'chalk';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const ICONS_DIR = path.join(PROJECT_ROOT, 'public', 'icons');
export const SITE_ICONS_DIR = path.join(ICONS_DIR, 'downloaded_sites');
export const CATEGORY_ICONS_DIR = path.join(ICONS_DIR, 'downloaded_categories');
export const NAV_LINKS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'navLinks.js');
export const DEFAULT_ICON = '/images/default.svg';
export const DEFAULT_CONCURRENCY = 5;
/**
 * 确保目录存在，如不存在则创建
 * @param {string} dirPath - 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
    logInfo(`创建目录: ${dirPath}`);
  }
}
/**
 * 从URL中提取域名
 * @param {string} url - 完整URL
 * @returns {string} - 提取的域名
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    logWarning(`无法从URL提取域名: ${url}`);
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
}
/**
 * 标准化文件名（移除特殊字符，确保安全）
 * @param {string} filename - 原始文件名
 * @returns {string} - 标准化后的文件名
 */
export function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '-')
    .replace(/-+/g, '-')  
    .replace(/^-|-$/g, ''); 
}
/**
 * 默认的浏览器 User-Agent 列表
 */
const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];
/**
 * 获取随机的浏览器 User-Agent
 * @returns {string} - 随机的 User-Agent 字符串
 */
export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * BROWSER_USER_AGENTS.length);
  return BROWSER_USER_AGENTS[index];
}
/**
 * 创建通用的HTTP请求头
 * @param {string} acceptType - Accept头的内容类型
 * @param {Record<string, string>} extraHeaders - 额外的HTTP头
 * @returns {Record<string, string>} - 完整的HTTP头对象
 */
export function createCommonHeaders(acceptType: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': acceptType,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    ...extraHeaders
  };
}
/**
 * 带超时和重试的fetch函数
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒）
 * @param {number} retries - 重试次数
 * @returns {Promise<Response>} - 响应对象
 */
export async function fetchWithTimeout(
  url: string, 
  options: any = {}, 
  timeout: number = 5000, 
  retries: number = 1
): Promise<any> {
  let lastError;
  const defaultHeaders = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': new URL(url).origin
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const mergedOptions = {
        ...options,
        signal: controller.signal,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      };
      const response = await request(url, mergedOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt); 
        logWarning(`请求失败，${delay}ms后重试 (${attempt + 1}/${retries}): ${url}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
/**
 * 创建并发控制器
 * @param {number} concurrency - 并发数
 * @returns {Function} - 并发控制函数
 */
export function createConcurrencyLimit(concurrency: number = DEFAULT_CONCURRENCY) {
  return pLimit(concurrency);
}
/**
 * 获取当前时间戳（格式化）
 * @returns {string} - 格式化的时间戳
 */
function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
/**
 * 输出成功日志（绿色）
 * @param {...any} args - 日志内容
 */
export function logSuccess(...args: any[]): void {
  console.log(chalk.green(`[${getTimestamp()}] ✓`), ...args);
}
/**
 * 输出信息日志（蓝色）
 * @param {...any} args - 日志内容
 */
export function logInfo(...args: any[]): void {
  console.log(chalk.blue(`[${getTimestamp()}] ℹ`), ...args);
}
/**
 * 输出警告日志（黄色）
 * @param {...any} args - 日志内容
 */
export function logWarning(...args: any[]): void {
  console.log(chalk.yellow(`[${getTimestamp()}] ⚠`), ...args);
}
/**
 * 输出错误日志（红色）
 * @param {...any} args - 日志内容
 */
export function logError(...args: any[]): void {
  console.log(chalk.red(`[${getTimestamp()}] ✗`), ...args);
}
/**
 * 读取文件内容（带错误处理）
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} - 文件内容
 */
export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    logError(`读取文件失败: ${filePath}`, error);
    throw error;
  }
}
/**
 * 写入文件内容（带错误处理）
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    logError(`写入文件失败: ${filePath}`, error);
    throw error;
  }
}
/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} - 是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}
/**
 * 格式化文件大小，转换为人类可读的格式
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
/**
 * 创建浏览器样式的请求头（用于HTML页面请求）
 * @param {Record<string, string>} extraHeaders - 额外的HTTP头
 * @returns {Record<string, string>} - 浏览器样式的HTTP头对象
 */
export function createBrowserHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return createCommonHeaders(
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    {
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...extraHeaders
    }
  );
}
/**
 * 创建图像请求头（用于图像资源请求）
 * @param {string} refererUrl - 引用页面URL
 * @param {Record<string, string>} extraHeaders - 额外的HTTP头
 * @returns {Record<string, string>} - 图像请求的HTTP头对象
 */
export function createImageHeaders(refererUrl: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  return createCommonHeaders(
    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': refererUrl,
      ...extraHeaders
    }
  );
}
