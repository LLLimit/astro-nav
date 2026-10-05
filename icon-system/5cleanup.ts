import { promises as fs } from 'fs';
import path from 'path';
import { 
  logInfo, 
  logSuccess, 
  logError, 
  logWarning,
  ICONS_DIR,
  SITE_ICONS_DIR,
  CATEGORY_ICONS_DIR,
  NAV_LINKS_PATH,
  normalizeFilename,
  readFileContent,
  ensureDir,
  fileExists,
  formatFileSize
} from './tools.js';
const IMAGE_EXTENSIONS = ['webp', 'svg', 'ico', 'png', 'jpg', 'jpeg', 'gif'];
const MAX_ICON_SIZE = 2048 * 2048;
const FORMAT_PRIORITY = ['webp', 'svg', 'png', 'jpg', 'jpeg', 'ico', 'gif'];
interface IconReference {
  path: string;           
  absolutePath: string;   
  baseName: string;       
  extension: string;      
  isReferenced: boolean;  
  referenceType: 'direct' | 'basename' | 'none'; 
  referenceCount: number; 
  size: number;           
  type: 'site' | 'category'; 
  priority: number;       
}
/**
 * 清理未使用的图标
 * @returns 清理统计结果
 */
export async function cleanupIcons() {
  logInfo('开始清理图标文件...');
  const navLinksContent = await readFileContent(NAV_LINKS_PATH);
  const iconReferenceMap = new Map<string, IconReference>();
  const baseNameGroups = new Map<string, IconReference[]>();
  const result = {
    sitesTotalFiles: 0,
    sitesDeletedLargeFiles: 0,
    sitesDeletedUnusedFiles: 0,
    sitesRemainingFiles: 0,
    sitesDeletedDuplicates: 0,
    categoriesTotalFiles: 0,
    categoriesDeletedLargeFiles: 0,
    categoriesDeletedUnusedFiles: 0,
    categoriesRemainingFiles: 0,
    categoriesDeletedDuplicates: 0,
    deletedTotalFiles: 0,
    remainingTotalFiles: 0
  };
  await scanIconFiles(iconReferenceMap, baseNameGroups, result);
  analyzeReferences(navLinksContent, iconReferenceMap, baseNameGroups);
  await processDuplicateIcons(baseNameGroups, result);
  await processUnusedIcons(iconReferenceMap, result);
  result.deletedTotalFiles = result.sitesDeletedLargeFiles + result.sitesDeletedUnusedFiles + result.sitesDeletedDuplicates +
                             result.categoriesDeletedLargeFiles + result.categoriesDeletedUnusedFiles + result.categoriesDeletedDuplicates;
  result.remainingTotalFiles = result.sitesRemainingFiles + result.categoriesRemainingFiles;
  console.log('\n========== 图标清理报告 ==========');
  console.log('\n网站图标 (downloaded_sites):');
  console.log(`  总文件数: ${result.sitesTotalFiles}`);
  console.log(`  删除过大文件: ${result.sitesDeletedLargeFiles}`);
  console.log(`  删除重复图标: ${result.sitesDeletedDuplicates}`);
  console.log(`  删除未引用文件: ${result.sitesDeletedUnusedFiles}`);
  console.log(`  保留文件: ${result.sitesRemainingFiles}`);
  console.log('\n分类图标 (downloaded_categories):');
  console.log(`  总文件数: ${result.categoriesTotalFiles}`);
  console.log(`  删除过大文件: ${result.categoriesDeletedLargeFiles}`);
  console.log(`  删除重复图标: ${result.categoriesDeletedDuplicates}`);
  console.log(`  删除未引用文件: ${result.categoriesDeletedUnusedFiles}`);
  console.log(`  保留文件: ${result.categoriesRemainingFiles}`);
  console.log('\n总结:');
  console.log(`  删除文件总数: ${result.deletedTotalFiles}`);
  console.log(`  保留文件总数: ${result.remainingTotalFiles}`);
  console.log('===================================\n');
  await cleanupTempDirectories();
  logSuccess('图标清理完成!');
  return result;
}
/**
 * 扫描图标文件并分类
 * @param iconReferenceMap 图标引用映射表
 * @param baseNameGroups 文件名分组映射表
 * @param result 统计结果
 */
async function scanIconFiles(
  iconReferenceMap: Map<string, IconReference>,
  baseNameGroups: Map<string, IconReference[]>,
  result: any
) {
  logInfo('开始扫描图标目录...');
  await scanDirectory(ICONS_DIR, iconReferenceMap, baseNameGroups, 'site');
  const categoryDir = path.join(ICONS_DIR, 'category');
  if (await fileExists(categoryDir)) {
    await scanDirectory(categoryDir, iconReferenceMap, baseNameGroups, 'category');
  }
  result.sitesTotalFiles = [...iconReferenceMap.values()].filter(ref => ref.type === 'site').length;
  result.categoriesTotalFiles = [...iconReferenceMap.values()].filter(ref => ref.type === 'category').length;
  const duplicateGroups = [...baseNameGroups.entries()].filter(([_, refs]) => refs.length > 1);
  if (duplicateGroups.length > 0) {
    logInfo(`发现 ${duplicateGroups.length} 组重复图标：`);
    for (const [key, refs] of duplicateGroups) {
      const [type, baseName] = key.split('_');
      const formats = refs.map(ref => ref.extension).join(', ');
      logInfo(`  - ${baseName} (类型: ${type}, 格式: ${formats})`);
    }
  } else {
    logInfo('未发现重复图标');
  }
}
/**
 * 扫描单个目录的图标文件
 * @param directory 目录路径
 * @param iconReferenceMap 图标引用映射表
 * @param baseNameGroups 文件名分组映射表
 * @param type 图标类型
 */
async function scanDirectory(
  directory: string,
  iconReferenceMap: Map<string, IconReference>,
  baseNameGroups: Map<string, IconReference[]>,
  type: 'site' | 'category'
) {
  try {
    if (!(await fileExists(directory))) {
      await ensureDir(directory);
      return;
    }
    const files = await fs.readdir(directory);
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;
      const fileExt = path.extname(file).slice(1).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(fileExt)) {
        const baseName = path.parse(file).name;
        const relativePath = `/icons/${type === 'category' ? 'category/' : ''}${file}`;
        const priority = FORMAT_PRIORITY.indexOf(fileExt);
        const iconRef: IconReference = {
          path: relativePath,
          absolutePath: filePath,
          baseName: baseName,
          extension: fileExt,
          isReferenced: false,
          referenceType: 'none',
          referenceCount: 0,
          size: stat.size,
          type: type,
          priority: priority !== -1 ? priority : FORMAT_PRIORITY.length
        };
        iconReferenceMap.set(filePath, iconRef);
        const groupKey = `${type}_${baseName}`;
        if (!baseNameGroups.has(groupKey)) {
          baseNameGroups.set(groupKey, []);
        }
        baseNameGroups.get(groupKey)?.push(iconRef);
      }
    }
  } catch (error: any) {
    logError(`扫描目录时发生错误 (${directory}): ${error.message}`);
  }
}
/**
 * 分析 navLinks.js 中的图标引用
 * @param navLinksContent navLinks.js 文件内容
 * @param iconReferenceMap 图标引用映射表
 * @param baseNameGroups 文件名分组映射表
 */
function analyzeReferences(
  navLinksContent: string,
  iconReferenceMap: Map<string, IconReference>,
  baseNameGroups: Map<string, IconReference[]>
) {
  for (const [filePath, reference] of iconReferenceMap.entries()) {
    if (navLinksContent.includes(reference.path)) {
      reference.isReferenced = true;
      reference.referenceType = 'direct';
      reference.referenceCount++;
      logInfo(`找到直接引用: ${reference.path}`);
    }
  }
  for (const [groupKey, references] of baseNameGroups.entries()) {
    if (references.every(ref => ref.isReferenced && ref.referenceType === 'direct')) {
      continue;
    }
    const [type, baseName] = groupKey.split('_');
    const dirPrefix = type === 'category' ? 'category/' : '';
    const baseNamePattern = new RegExp(`/icons/${dirPrefix}${baseName}(?![\\w.-])`, 'i');
    const extensionPattern = new RegExp(`/icons/${dirPrefix}${baseName}\\.(${IMAGE_EXTENSIONS.join('|')})`, 'i');
    const generalPattern = new RegExp(`${baseName}(?![\\w.-])`, 'i');
    const isBasenameReferenced = baseNamePattern.test(navLinksContent);
    const isExtensionReferenced = extensionPattern.test(navLinksContent);
    const isGenerallyReferenced = generalPattern.test(navLinksContent);
    if (isBasenameReferenced || isExtensionReferenced || isGenerallyReferenced) {
      for (const reference of references) {
        if (!reference.isReferenced) {
          reference.isReferenced = true;
          reference.referenceType = 'basename';
          reference.referenceCount++;
          if (isBasenameReferenced) {
            logInfo(`找到基于文件名的引用: ${reference.path} (匹配模式: 纯文件名)`);
          } else if (isExtensionReferenced) {
            logInfo(`找到基于文件名的引用: ${reference.path} (匹配模式: 带扩展名)`);
          } else {
            logInfo(`找到基于文件名的引用: ${reference.path} (匹配模式: 通用引用)`);
          }
        }
      }
    }
  }
}
/**
 * 处理重复图标文件（同一名称不同扩展名）
 * @param baseNameGroups 按基本名称分组的图标
 * @param result 统计结果
 */
async function processDuplicateIcons(
  baseNameGroups: Map<string, IconReference[]>,
  result: any
) {
  const multipleFormatGroups = [...baseNameGroups.entries()].filter(([_, refs]) => refs.length > 1);
  if (multipleFormatGroups.length === 0) {
    logInfo('未发现需要处理的重复图标');
    return;
  }
  logInfo(`开始处理 ${multipleFormatGroups.length} 组重复图标...`);
  let processedCount = 0;
  let skippedCount = 0;
  for (const [groupKey, references] of multipleFormatGroups) {
    const [type, baseName] = groupKey.split('_');
    const referencedIcons = references.filter(ref => ref.isReferenced);
    if (referencedIcons.length <= 0) {
      skippedCount++;
      continue;
    }
    referencedIcons.sort((a, b) => a.priority - b.priority);
    const keepIcon = referencedIcons[0];
    const deleteIcons = referencedIcons.slice(1);
    if (deleteIcons.length > 0) {
      const formats = deleteIcons.map(i => i.extension).join(', ');
      logInfo(`处理图标 '${baseName}': 保留 ${keepIcon.extension} 格式，删除 ${formats} 格式`);
      for (const icon of deleteIcons) {
        try {
          await fs.unlink(icon.absolutePath);
          logInfo(`  - 删除: ${path.basename(icon.absolutePath)}`);
          if (icon.type === 'site') {
            result.sitesDeletedDuplicates++;
          } else {
            result.categoriesDeletedDuplicates++;
          }
          processedCount++;
        } catch (error: any) {
          logError(`  - 删除错误: ${path.basename(icon.absolutePath)} - ${error.message}`);
        }
      }
    }
  }
  logInfo(`重复图标处理完成: 处理了 ${processedCount} 个文件，跳过了 ${skippedCount} 组`);
}
/**
 * 清理临时下载目录中的文件
 */
async function cleanupTempDirectories() {
  logInfo('开始清理临时下载目录...');
  const tempDirs = [
    path.join(ICONS_DIR, 'downloaded_sites'),
    path.join(ICONS_DIR, 'downloaded_categories')
  ];
  let totalDeleted = 0;
  for (const dir of tempDirs) {
    if (await fileExists(dir)) {
      try {
        const files = await fs.readdir(dir);
        if (files.length === 0) {
          logInfo(`目录 ${dir} 为空，无需清理`);
          continue;
        }
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
              logWarning(`跳过子目录: ${filePath}`);
              continue;
            }
            await fs.unlink(filePath);
            totalDeleted++;
          } catch (err) {
            logError(`删除文件 ${filePath} 失败: ${err}`);
          }
        }
        const dirName = path.basename(dir);
        logSuccess(`已清理临时目录 ${dirName}: 删除了 ${files.length} 个文件`);
      } catch (err) {
        logError(`读取目录 ${dir} 失败: ${err}`);
      }
    } else {
      logInfo(`临时目录不存在: ${dir}`);
    }
  }
  if (totalDeleted > 0) {
    logSuccess(`总共清理了 ${totalDeleted} 个临时文件`);
  } else {
    logInfo('没有临时文件需要清理');
  }
}
/**
 * 处理未引用的图标文件
 * @param iconReferenceMap 图标引用映射表
 * @param result 统计结果
 */
async function processUnusedIcons(
  iconReferenceMap: Map<string, IconReference>,
  result: any
) {
  for (const reference of iconReferenceMap.values()) {
    if (!await fileExists(reference.absolutePath)) continue;
    if (reference.size > MAX_ICON_SIZE) {
      try {
        await fs.unlink(reference.absolutePath);
        logWarning(`删除过大图标文件 (${formatFileSize(reference.size)}): ${reference.absolutePath}`);
        if (reference.type === 'site') {
          result.sitesDeletedLargeFiles++;
        } else {
          result.categoriesDeletedLargeFiles++;
        }
      } catch (error: any) {
        logError(`删除过大文件时发生错误: ${error.message}`);
      }
      continue;
    }
    if (!reference.isReferenced) {
      try {
        await fs.unlink(reference.absolutePath);
        logInfo(`删除未引用的图标文件: ${reference.absolutePath}`);
        if (reference.type === 'site') {
          result.sitesDeletedUnusedFiles++;
        } else {
          result.categoriesDeletedUnusedFiles++;
        }
      } catch (error: any) {
        logError(`删除未引用文件时发生错误: ${error.message}`);
      }
    } else {
      if (reference.type === 'site') {
        result.sitesRemainingFiles++;
      } else {
        result.categoriesRemainingFiles++;
      }
    }
  }
}
