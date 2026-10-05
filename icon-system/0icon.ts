import { analyzeNavLinks } from './1analyse.js';
import { downloadIcons } from './2download.js';
import { optimizeIcons } from './3optimize.js';
import { updateNavLinksIconPaths } from './4link.js';
import { cleanupIcons } from './5cleanup.js';
import { logSuccess, logInfo, logWarning, logError } from './tools.js';
/**
 * 主函数 - 按顺序执行完整的图标处理流程
 */
async function main() {
  try {
    console.time('总执行时间');
    logInfo('======= Astro 图标自动生成系统 =======');
    logInfo('开始执行完整图标处理流程...');
    logInfo('\n📊 第1阶段: 分析网站数据...');
    const { siteTasks, categoryTasks } = await analyzeNavLinks();
    logInfo('\n📥 第2阶段: 下载图标...');
    const downloadResults = await downloadIcons(siteTasks, categoryTasks);
    logInfo('\n🔧 第3阶段: 优化图标...');
    const optimizedPaths = await optimizeIcons(downloadResults);
    logInfo('\n🔗 第4阶段: 更新链接...');
    await updateNavLinksIconPaths(optimizedPaths);
    logInfo('\n🧹 第5阶段: 清理无用图标...');
    await cleanupIcons();
    console.timeEnd('总执行时间');
    logSuccess('图标处理流程全部完成！');
  } catch (error) {
    logError('执行过程中出现错误:', error);
    process.exit(1);
  }
}
main().catch(error => {
  logError('执行主函数时出现未捕获的错误:', error);
  process.exit(1);
});
