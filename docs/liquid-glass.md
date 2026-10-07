# 液态玻璃 2.0：网页实现

## 参考资料

- [Apple：Clear Glass](https://developer.apple.com/documentation/swiftui/glass/clear)：清透材质需要同时照顾内容可读性；本项目保留固定白色文字、轻薄中性遮罩与文字阴影。
- [Kyant0/AndroidLiquidGlass](https://github.com/Kyant0/AndroidLiquidGlass)：Compose Multiplatform 的背景拷贝、圆角透镜、色散和高光思路；原生 Kotlin/AGSL 代码不能直接作为 Astro 浏览器组件使用。
- [Lens 参数](https://github.com/Kyant0/AndroidLiquidGlass/blob/kmp/backdrop/src/commonMain/kotlin/com/kyant/backdrop/effects/Lens.kt)：折射高度、折射量、深度和色散。
- [AndroidLiquidGlass 光学着色器](https://github.com/Kyant0/AndroidLiquidGlass/blob/kmp/backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt)：圆弧折射曲线与扩大圆角法线半径的参考。本项目自行实现带正则项的圆弧曲线、中心放大和基于壁纸颜色的反射。
- [SDF → 法线 → Snell 折射模型](https://github.com/rukkiecodes/liquid-glass)：可读的网页/原生光学模型说明。
- [MDN WebGL 最佳实践](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)：绘制缓冲区、资源释放和避免同步 GPU 查询。

## 当前实现

`src/scripts/liquid-glass.ts` 是独立实现的 WebGL 2 渲染器，使用一个共享画布，不引入 React 或外部运行时。

1. 后台壁纸或默认壁纸加载为 GPU 纹理。背景和透镜使用同一套屏幕坐标、Cover/Contain 和位置参数。
2. 每个可见组件使用圆角矩形距离场、圆弧剖面及平滑的圆角法线建立凸透镜取样曲线。主体围绕自身中心轻微放大，进入边缘后连续过渡为沿外法线取样，形成更明显的背景弯曲与厚度。圆弧曲线加入正则项，避免边界处导数无限大；法线使用更大的圆角半径，减少拐角突然歪斜。一级分类大面板的放大量较小，卡片与按钮更明显。
3. 红绿蓝分别取样，边缘色散为位移的 1.2%。反射另外取样附近壁纸，保留背景颜色；Fresnel、弧形肩部及方向性高光提供厚度，只有局部光斑增亮。CSS 不再给光学组件绘制整圈白色描边或白色内阴影。卡片与按钮保持清透，弹出层保留适量模糊。
4. 滚动时更新组件屏幕位置，壁纸经过组件时被实时折射。滚动速度附加小幅曲率惯性与有界壁纸视差，背景和透镜保持共用坐标。
5. 鼠标位置通过阻尼插值，影响光源方向、局部边缘反光和微弱的曲率波纹；不再横向拖动整块背景。CSS 保留 2px 抬升、细微缩放及透明反光层。
6. 一级分类分区、二级分类标签、侧栏、搜索框、卡片、搜索按钮、主题按钮、返回顶部和弹出层共用渲染器。两个离屏纹理按「分区 → 卡片／侧栏／搜索框 → 按钮 → 弹出层」逐层交换。内层组件折射已绘制的外层玻璃，而不是重新取原始壁纸，避免嵌套面板之间出现纹理跳变；同层组件共享一次背景拷贝。标签横向滚动时同步裁剪透镜，切换分类后不再绘制隐藏卡片。弹出层另外保留浏览器背景模糊，以处理其下方的实际页面文字。
7. 液态玻璃主题固定白色文字，不做壁纸明暗检测或文字颜色切换。后台配置的壁纸亮度、模糊和遮罩继续生效，遮罩为 0 时不再被错误替换成默认值。

## 范围与性能

这是**壁纸折射**，不是任意 DOM 的 GPU 截屏；浏览器并不允许直接把页面合成器的像素作为 WebGL 纹理。该实现没有每帧截图，也没有冻结的页面截图。页面滚动、壁纸变换与鼠标扰动的光学效果实时计算。

只在玻璃主题启用时动态加载，切回黑白主题立即取消动画、删除纹理和释放上下文。可见性观察器排除屏幕外组件；壁纸纹理最长边不超过 2048，画布不超过 240 万像素，DPR 最大 2。两张离屏 RGBA 纹理连同 mipmap 在最大画布尺寸时合计约 26 MB。用户停止操作后渲染暂停，切到后台标签页也暂停。

WebGL 2 不可用或上下文丢失时使用 CSS 磨砂玻璃。系统减少动态效果设置关闭指针扰动和滚动惯性；减少透明度设置使用不透明表面。渲染消耗访客设备的 GPU，不增加服务器逐帧计算。

自定义 favicon 在后台网站设置上传，保存后首页和后台的 `<link rel="icon">` 使用同一设置。上传文件具有独立 UUID 路径，避免覆盖同名图片引起的缓存问题。自定义分类图标保留原始图片颜色，不使用将不透明像素变黑的滤镜。

## 默认壁纸

`public/images/glass-city.jpg`：Photo by [David Schultz on Unsplash](https://unsplash.com/photos/buildings-and-trees-line-a-city-street-under-a-blue-sky-Md0f4pDG7y8)，按 [Unsplash License](https://unsplash.com/license) 使用。照片的窗框、树枝和电线用于呈现玻璃的背景折射。后台设置的自定义壁纸优先于此默认图片。
