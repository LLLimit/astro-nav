# 网页液态玻璃实现

## 参考资料

- [Kyant0/AndroidLiquidGlass](https://github.com/Kyant0/AndroidLiquidGlass)：Compose Multiplatform 的背景拷贝、圆角透镜、色散和高光思路；原生 Kotlin/AGSL 代码不能直接作为 Astro 浏览器组件使用。
- [Lens 参数](https://github.com/Kyant0/AndroidLiquidGlass/blob/kmp/backdrop/src/commonMain/kotlin/com/kyant/backdrop/effects/Lens.kt)：折射高度、折射量、深度和色散。
- [SDF → 法线 → Snell 折射模型](https://github.com/rukkiecodes/liquid-glass)：可读的网页/原生光学模型说明。
- [MDN WebGL 最佳实践](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)：绘制缓冲区、资源释放和避免同步 GPU 查询。

## 当前实现

`src/scripts/liquid-glass.ts` 是独立实现的 WebGL 2 渲染器，使用一个共享画布，不引入 React 或外部运行时。

1. 后台壁纸或默认壁纸加载为 GPU 纹理。背景和透镜使用同一套屏幕坐标、Cover/Contain 和位置参数。
2. 每个可见组件的圆角矩形距离场构造弧形边缘和法线，用 GLSL `refract`（折射率 1.46）计算穿过玻璃厚度后的壁纸取样位置。边缘有较强折射，中心轻微放大，文字保持清晰。
3. 红绿蓝分别取样，形成轻微色散；Fresnel 边缘与镜面高光提供光泽和厚度。
4. 滚动时更新组件屏幕位置，壁纸经过组件时被实时折射。滚动速度附加短暂的折射惯性与有界壁纸视差。
5. 鼠标位置通过阻尼插值，形成局部法线扰动、衰减波纹和随位置变化的高光。CSS 保留细微抬升、边框及透明反光层。
6. 侧栏、搜索框、卡片、搜索按钮、主题按钮、返回顶部和弹出层共用渲染器。弹出层另外保留浏览器背景模糊，以处理其下方的实际页面文字。

## 范围与性能

这是**壁纸折射**，不是任意 DOM 的 GPU 截屏；浏览器并不允许直接把页面合成器的像素作为 WebGL 纹理。该实现没有每帧截图，也没有冻结的页面截图。页面滚动、壁纸变换与鼠标扰动的光学效果实时计算。

只在玻璃主题启用时动态加载，切回黑白主题立即取消动画、删除纹理和释放上下文。可见性观察器排除屏幕外组件；单张纹理最长边不超过 2048，画布不超过 240 万像素，DPR 最大 1.5。用户停止操作后渲染暂停，切到后台标签页也暂停。

WebGL 2 不可用或上下文丢失时使用 CSS 磨砂玻璃。系统减少动态效果设置关闭指针扰动和滚动惯性；减少透明度设置使用不透明表面。渲染消耗访客设备的 GPU，不增加服务器逐帧计算。

自定义 favicon 在后台网站设置上传，保存后首页和后台的 `<link rel="icon">` 使用同一设置。上传文件具有独立 UUID 路径，避免覆盖同名图片引起的缓存问题。自定义分类图标保留原始图片颜色，不使用将不透明像素变黑的滤镜。
