import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { 
  ICONS_DIR,
  logInfo, 
  logSuccess, 
  logWarning, 
  logError,
  ensureDir,
  normalizeFilename
} from './tools.js';
import type { DownloadResult } from './2download.js';
const ICON_SIZE = 64; 
const WEBP_QUALITY = 80; 
export interface OptimizedPathMap {
  [taskId: string]: string; 
}
/**
 * 优化图标
 * @param {DownloadResult[]} downloadResults - 下载结果
 * @returns {Promise<OptimizedPathMap>} - 优化后的图标路径映射
 */
export async function optimizeIcons(downloadResults: DownloadResult[]): Promise<OptimizedPathMap> {
  const optimizedPaths: OptimizedPathMap = {};
  const successfulDownloads = downloadResults.filter(result => result.success && result.path);
  logInfo(`开始优化 ${successfulDownloads.length} 个图标...`);
  for (const result of successfulDownloads) {
    try {
      if (!result.path) continue;
      const iconPath = result.path;
      const iconFileName = path.basename(iconPath);
      const iconExtension = path.extname(iconPath).toLowerCase();
      let optimizedExtension = '.webp';
      if (iconExtension === '.svg') {
        optimizedExtension = '.svg'; 
      }
      const optimizedFileName = normalizeFilename(result.taskId) + optimizedExtension;
      let outputDirectory = ICONS_DIR;
      if (result.type === 'category') {
        outputDirectory = path.join(ICONS_DIR, 'category');
      }
      await ensureDir(outputDirectory);
      const optimizedPath = path.join(outputDirectory, optimizedFileName);
      if (iconExtension === '.svg') {
        await optimizeSvg(iconPath, optimizedPath);
      } else {
        await convertToWebp(iconPath, optimizedPath);
      }
      const relativePath = `/icons${result.type === 'category' ? '/category' : ''}/${optimizedFileName}`;
      optimizedPaths[result.taskId] = relativePath;
      logSuccess(`优化图标成功: ${result.taskId} -> ${relativePath}`);
    } catch (error: any) {
      logError(`优化图标失败: ${result.taskId} - ${error.message}`);
    }
  }
  logSuccess(`图标优化完成! 共优化 ${Object.keys(optimizedPaths).length} 个图标`);
  return optimizedPaths;
}
/**
 * 优化SVG图标
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 */
async function optimizeSvg(inputPath: string, outputPath: string): Promise<void> {
  const svgContent = await fs.readFile(inputPath, 'utf-8');
  const result = optimize(svgContent, {
    plugins: [
      'preset-default',
      'removeDimensions',
      {
        name: 'addAttributesToSVGElement',
        params: {
          attributes: [
            { width: ICON_SIZE.toString() },
            { height: ICON_SIZE.toString() },
            { 'viewBox': `0 0 ${ICON_SIZE} ${ICON_SIZE}` }
          ]
        }
      }
    ]
  });
  await fs.writeFile(outputPath, result.data);
}
/**
 * 将图标转换为WebP格式
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 */
async function convertToWebp(inputPath: string, outputPath: string): Promise<void> {
  try {
    let sharpInstance = sharp(inputPath);
    const metadata = await sharpInstance.metadata();
    if (metadata.format && (metadata.format as string) === 'ico') {
      sharpInstance = sharp(inputPath, { page: 0 });
    }
    sharpInstance = sharpInstance
      .resize(ICON_SIZE, ICON_SIZE, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });
    await sharpInstance
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
  } catch (error: any) {
    if (error.message.includes('Input buffer contains unsupported image format')) {
      logWarning(`无法处理图标格式，尝试直接复制: ${inputPath}`);
      await fs.copyFile(inputPath, outputPath.replace('.webp', path.extname(inputPath)));
    } else {
      throw error;
    }
  }
}
