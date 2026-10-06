/** Wallpaper-backed liquid optics. See docs/liquid-glass.md for the rendering model. */
const vertexSource = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D uWallpaper;
uniform vec2 uViewport;
uniform vec4 uImageRect;
uniform vec4 uRect;
uniform vec4 uPointer;
uniform vec4 uMaterial;
uniform vec4 uBackdrop;
uniform vec3 uColor;
uniform vec2 uMotion;
uniform float uRadius;
uniform float uDpr;
uniform int uMode;
out vec4 outColor;

// Rounded rectangle SDF; its gradient supplies the outward bezel normal.
float distanceToLens(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
vec2 lensGradient(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  vec2 outside = max(q, 0.0);
  if (dot(outside, outside) > 0.0001) return sign(p) * normalize(outside);
  return q.x > q.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y));
}
vec3 backdrop(vec2 p, float lod) {
  vec2 uv = (p - uImageRect.xy) / uImageRect.zw;
  vec3 color = uColor;
  if (uBackdrop.w < 0.5) {
    if (uBackdrop.z < 0.5 || (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0)) {
      color = textureLod(uWallpaper, clamp(uv, 0.001, 0.999), lod).rgb;
    }
  }
  color *= uBackdrop.x;
  float shade = 0.12 + 0.10 * smoothstep(0.4, 1.0, p.y / uViewport.y);
  return mix(color, vec3(0.025, 0.032, 0.055), clamp(uBackdrop.y + shade, 0.0, 0.9));
}
void main() {
  vec2 p = vec2(gl_FragCoord.x / uDpr, uViewport.y - gl_FragCoord.y / uDpr);
  if (uMode == 0) {
    outColor = vec4(backdrop(p, uMaterial.w), 1.0);
    return;
  }
  vec2 halfSize = uRect.zw * 0.5;
  vec2 local = p - uRect.xy - halfSize;
  float sd = distanceToLens(local, halfSize, uRadius);
  if (sd > 1.0) discard;
  float coverage = 1.0 - smoothstep(-0.65, 0.65, sd);
  float bezel = min(uMaterial.x, min(halfSize.x, halfSize.y) * 0.8);
  float t = clamp(-sd / bezel, 0.0, 1.0);
  float arc = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.025));
  float slope = (1.0 - t) / arc * uMaterial.y / bezel;
  vec2 gradient = lensGradient(local, halfSize, uRadius);
  vec2 toPointer = p - uPointer.xy;
  float pointerDistance = length(toPointer);
  float influence = exp(-dot(toPointer, toPointer) / 22000.0) * uPointer.z;
  vec2 pointerDirection = toPointer / max(pointerDistance, 1.0);
  float wave = sin(pointerDistance * 0.042 - uMotion.y * 8.0) * influence;
  vec2 tilt = pointerDirection * (wave * 0.19 + influence * 0.08);
  tilt.y += uMotion.x * 0.007 * (1.0 - t);
  vec3 normal = normalize(vec3(gradient * slope + tilt, 1.0));
  // Snell's law, air -> glass (IOR 1.46), then travel through the slab.
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / 1.46);
  float thickness = uMaterial.y * (1.0 + abs(uMotion.x) * 0.025 + influence * 0.32);
  vec2 offset = ray.xy / max(-ray.z, 0.15) * thickness;
  offset -= local * 0.035 * (1.0 + influence);
  offset += pointerDirection * wave * 3.2;
  vec2 refracted = p + offset;
  float dispersion = 0.045 + influence * 0.018;
  float lod = uMaterial.w;
  vec3 color;
  color.r = backdrop(refracted + offset * dispersion, lod).r;
  color.g = backdrop(refracted, lod).g;
  color.b = backdrop(refracted - offset * dispersion, lod).b;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, 1.14);
  // Transparent smoke keeps white labels legible over light wallpapers.
  color = mix(color, vec3(0.06, 0.075, 0.10), uMaterial.z);
  vec3 light = normalize(vec3(-0.45, -0.65, 0.85));
  light.xy += (uPointer.xy / uViewport - 0.5) * uPointer.z * 0.8;
  vec3 halfVector = normalize(light + vec3(0.0, 0.0, 1.0));
  float specular = pow(max(dot(normal, halfVector), 0.0), 28.0);
  float rim = exp(-max(-sd, 0.0) / 1.35);
  float fresnel = pow(1.0 - normal.z, 3.0);
  float rimLight = pow(abs(dot(gradient, normalize(light.xy))), 5.0);
  color += vec3(0.92, 0.96, 1.0) * (rim * (0.12 + rimLight * 0.60) + fresnel * 0.13);
  color += vec3(1.0) * specular * (1.0 - t) * 0.24;
  color += vec3(1.0) * influence * 0.035;
  outColor = vec4(color, coverage);
}
`;

// Nested controls are drawn after their parent. Popovers keep CSS backdrop blur
// as well, so text/content behind an overlay is diffused rather than duplicated.
const surfaceSelector = ".category-section,.subcategory-tab,.sidebar,.search-shell,.site-card,.theme-toggle,.search-submit,.back-to-top,.search-results,.site-preview";
type Surface = { element: HTMLElement; radius: number; bezel: number; depth: number; tint: number };
export type GlassRenderer = { destroy: () => void };

export async function createLiquidGlass(isCurrent = () => document.documentElement.dataset.theme === "glass"): Promise<GlassRenderer | null> {
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "liquid-scene";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: "low-power", preserveDrawingBuffer: false,
  });
  if (!gl) { root.dataset.glassRenderer = "css"; return null; }
  const abort = new AbortController();
  let destroyed = false;
  let frame = 0;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  let intersection: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let mutation: MutationObserver | undefined;
  const surfaces = new Map<HTMLElement, Surface>();
  const visible = new Set<HTMLElement>();
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    abort.abort();
    cancelAnimationFrame(frame);
    intersection?.disconnect();
    resizeObserver?.disconnect();
    mutation?.disconnect();
    gl!.deleteTexture(texture);
    gl!.deleteBuffer(buffer);
    gl!.deleteProgram(program);
    shaders.forEach((shader) => gl!.deleteShader(shader));
    gl!.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    if (!document.querySelector(".liquid-scene")) {
      if (root.dataset.theme === "glass") root.dataset.glassRenderer = "css";
      else delete root.dataset.glassRenderer;
    }
  }
  try {
    if (!program || !buffer || !texture) throw new Error("GL allocation failed");
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader allocation failed");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(shaders.map((shader) => gl.getShaderInfoLog(shader)).join("\n") || "Shader link failed");
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const names = ["uWallpaper", "uViewport", "uImageRect", "uRect", "uPointer", "uMaterial", "uBackdrop", "uColor", "uMotion", "uRadius", "uDpr", "uMode"] as const;
    const uniform = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<typeof names[number], WebGLUniformLocation | null>;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let imageWidth = 1, imageHeight = 1;
    const source = document.body.dataset.glassWallpaper || "/images/glass-wallpaper.svg";
    const isColor = /^#[a-f\d]{6}$/i.test(source);
    const color = isColor ? [1, 3, 5].map((index) => parseInt(source.slice(index, index + 2), 16) / 255) : [0.09, 0.11, 0.16];
    if (isColor) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    } else {
      const image = new Image();
      image.src = source;
      await image.decode();
      if (destroyed || !isCurrent()) { destroy(); return null; }
      // A bounded texture allocation also handles very large uploaded wallpapers.
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight), gl.getParameter(gl.MAX_TEXTURE_SIZE) / Math.max(image.naturalWidth, image.naturalHeight));
      const prepared = document.createElement("canvas");
      prepared.width = imageWidth = Math.max(1, Math.round(image.naturalWidth * scale));
      prepared.height = imageHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = prepared.getContext("2d");
      if (!context) throw new Error("Wallpaper texture unavailable");
      context.drawImage(image, 0, 0, imageWidth, imageHeight);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, prepared);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(uniform.uWallpaper, 0);
    gl.uniform3f(uniform.uColor, color[0], color[1], color[2]);
    const bodyStyle = getComputedStyle(document.body);
    const setting = (name: string, fallback: number) => Number.parseFloat(bodyStyle.getPropertyValue(name)) || fallback;
    const brightness = setting("--background-brightness", 1);
    const overlay = setting("--background-overlay", 0);
    const backgroundBlur = setting("--background-blur", 0);
    const contain = bodyStyle.getPropertyValue("--background-size").trim() === "contain";
    const position = bodyStyle.getPropertyValue("--background-position").trim();
    gl.uniform4f(uniform.uBackdrop, brightness, overlay, contain ? 1 : 0, isColor ? 1 : 0);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, dpr = 1, imageDrawnWidth = 1;
    let pointerX = -1000, pointerY = -1000, targetX = -1000, targetY = -1000;
    let pointerPower = 0, targetPower = 0, scrollImpulse = 0, scrollVelocity = 0;
    let lastScroll = window.scrollY, lastTime = 0, waveStart = performance.now();
    let activeUntil = 0, baseX = 0, baseY = 0, drawnWidth = 1, drawnHeight = 1;

    function wake(duration = 650) {
      if (destroyed || document.hidden || root.dataset.theme !== "glass") return;
      activeUntil = Math.max(activeUntil, performance.now() + (reducedMotion.matches ? 0 : duration));
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function resize() {
      // innerWidth includes the scrollbar; the fixed canvas does not.
      width = document.documentElement.clientWidth;
      height = window.innerHeight;
      // Keep the drawing buffer below 2.4 MP, even on a high-DPI 4K screen.
      dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2_400_000 / (width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.uniform2f(uniform.uViewport, width, height);
      gl!.uniform1f(uniform.uDpr, dpr);
      const scale = contain ? Math.min(width / imageWidth, height / imageHeight) : Math.max(width / imageWidth, height / imageHeight);
      drawnWidth = imageDrawnWidth = imageWidth * scale;
      drawnHeight = imageHeight * scale;
      baseX = position === "left" ? 0 : position === "right" ? width - drawnWidth : (width - drawnWidth) * 0.5;
      baseY = position === "top" ? 0 : position === "bottom" ? height - drawnHeight : (height - drawnHeight) * 0.5;
      wake();
    }
    function discover() {
      for (const element of document.querySelectorAll<HTMLElement>(surfaceSelector)) {
        if (surfaces.has(element)) continue;
        const style = getComputedStyle(element);
        const tab = element.matches(".subcategory-tab");
        const panel = element.matches(".category-section");
        const compact = tab || element.matches(".theme-toggle,.search-submit,.back-to-top");
        const radius = style.borderTopLeftRadius;
        surfaces.set(element, {
          element, radius: radius.includes("%") ? -1 : parseFloat(radius) || 14,
          bezel: tab ? 8 : compact ? 12 : 19, depth: tab ? 20 : compact || panel ? 25 : 34,
          tint: element.matches(".search-results,.site-preview") ? 0.34 : element.matches(".search-submit") ? 0.26 : panel ? 0.18 : 0.14,
        });
        element.classList.add("liquid-surface");
        intersection!.observe(element);
        resizeObserver!.observe(element);
      }
      for (const [element] of surfaces) {
        if (!element.isConnected) {
          surfaces.delete(element); visible.delete(element);
          intersection!.unobserve(element); resizeObserver!.unobserve(element);
        }
      }
      wake();
    }
    function draw(now: number) {
      frame = 0;
      if (destroyed || document.hidden || root.dataset.theme !== "glass") return;
      const delta = Math.min(32, Math.max(1, now - (lastTime || now - 16.67)));
      lastTime = now;
      const smooth = 1 - Math.exp(-delta / 70);
      pointerX += (targetX - pointerX) * smooth;
      pointerY += (targetY - pointerY) * smooth;
      pointerPower += (targetPower - pointerPower) * smooth;
      targetPower *= Math.exp(-delta / 210);
      scrollVelocity += (scrollImpulse - scrollVelocity) * smooth;
      scrollImpulse *= Math.exp(-delta / 100);
      const motion = reducedMotion.matches ? 0 : 1;
      const parallaxX = motion * Math.max(-5, Math.min(5, (pointerX / width - 0.5) * 7)) * pointerPower;
      const parallaxY = motion * (-Math.tanh(window.scrollY / 1400) * 22 + scrollVelocity * 0.08);
      gl!.uniform4f(uniform.uImageRect, baseX + parallaxX, baseY + parallaxY, drawnWidth, drawnHeight);
      gl!.uniform4f(uniform.uPointer, pointerX, pointerY, pointerPower * motion, 0);
      gl!.uniform2f(uniform.uMotion, scrollVelocity * motion, (now - waveStart) / 1000);
      const baseLod = Math.max(0, Math.log2(1 + backgroundBlur * imageWidth / imageDrawnWidth));
      const lensLod = Math.max(baseLod, Math.log2(1 + 1.15 * imageWidth / imageDrawnWidth));
      gl!.disable(gl!.SCISSOR_TEST);
      gl!.disable(gl!.BLEND);
      gl!.uniform1i(uniform.uMode, 0);
      gl!.uniform4f(uniform.uMaterial, 0, 0, 0, baseLod);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      gl!.enable(gl!.SCISSOR_TEST);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.uniform1i(uniform.uMode, 1);
      // Read all geometry first, before drawing. IntersectionObserver excludes
      // offscreen cards, including large content-visibility grids.
      const lenses = [...visible].flatMap((element) => {
        const surface = surfaces.get(element);
        if (!surface || element.hidden || element.closest("[hidden]") || element.matches(".back-to-top:not(.visible)")) return [];
        if (element.matches(".subcategory-tab") && !element.matches(".active,:hover,:focus-visible")) return [];
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && rect.bottom > 0 && rect.top < height ? [{ surface, rect }] : [];
      });
      // Parent panels first, floating controls and popovers last.
      const layer = (element: HTMLElement) => element.matches(".category-section") ? 0
        : element.matches(".search-results,.site-preview") ? 3
        : element.matches(".subcategory-tab,.theme-toggle,.search-submit,.back-to-top") ? 2 : 1;
      lenses.sort((a, b) => layer(a.surface.element) - layer(b.surface.element));
      for (const { surface, rect } of lenses) {
        // Horizontal tab scrolling clips the optical layer as well as its DOM label.
        const clip = surface.element.closest(".subcategory-tabs")?.getBoundingClientRect();
        const left = Math.max(0, Math.floor(Math.max(rect.left, clip?.left ?? rect.left) * dpr));
        const bottom = Math.max(0, Math.floor((height - Math.min(rect.bottom, clip?.bottom ?? rect.bottom)) * dpr));
        const right = Math.min(canvas.width, Math.ceil(Math.min(rect.right, clip?.right ?? rect.right) * dpr));
        const top = Math.min(canvas.height, Math.ceil((height - Math.max(rect.top, clip?.top ?? rect.top)) * dpr));
        if (right <= left || top <= bottom) continue;
        gl!.scissor(left, bottom, right - left, top - bottom);
        gl!.uniform4f(uniform.uRect, rect.left, rect.top, rect.width, rect.height);
        gl!.uniform1f(uniform.uRadius, Math.min(surface.radius < 0 ? Math.min(rect.width, rect.height) / 2 : surface.radius, rect.width / 2, rect.height / 2));
        gl!.uniform4f(uniform.uMaterial, surface.bezel, surface.depth, surface.tint, lensLod);
        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      }
      if (now < activeUntil || (!reducedMotion.matches && (pointerPower > 0.001 || Math.abs(scrollVelocity) > 0.01))) {
        frame = requestAnimationFrame(draw);
      }
    }
    intersection = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
        else visible.delete(entry.target as HTMLElement);
      }
      wake();
    }, { rootMargin: "60px" });
    resizeObserver = new ResizeObserver(() => wake());
    mutation = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) discover();
      else wake();
    });
    mutation.observe(document.querySelector(".page-main")!, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });
    const preview = document.querySelector(".site-preview");
    if (preview) mutation.observe(preview, { attributes: true, attributeFilter: ["hidden", "style"] });
    const backToTop = document.querySelector(".back-to-top");
    if (backToTop) mutation.observe(backToTop, { attributes: true, attributeFilter: ["class"] });
    const eventOptions = { passive: true, signal: abort.signal };
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      if (targetX < 0) { pointerX = event.clientX; pointerY = event.clientY; }
      targetX = event.clientX; targetY = event.clientY;
      targetPower = 1;
      waveStart = performance.now();
      const element = (event.target as HTMLElement).closest<HTMLElement>(surfaceSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        element.style.setProperty("--glass-x", `${event.clientX - rect.left}px`);
        element.style.setProperty("--glass-y", `${event.clientY - rect.top}px`);
      }
      wake();
    }, eventOptions);
    window.addEventListener("pointerout", (event) => { if (!event.relatedTarget) { targetPower = 0; wake(); } }, eventOptions);
    window.addEventListener("pointerdown", (event) => {
      targetX = event.clientX; targetY = event.clientY;
      targetPower = 1.4;
      waveStart = performance.now();
      wake(800);
    }, eventOptions);
    window.addEventListener("scroll", () => {
      scrollImpulse = Math.max(-28, Math.min(28, (window.scrollY - lastScroll) * 0.35));
      lastScroll = window.scrollY;
      wake();
    }, eventOptions);
    // Scroll inside a category's tab bar does not fire a window scroll event.
    document.addEventListener("scroll", () => wake(), { ...eventOptions, capture: true });
    document.addEventListener("focusin", () => wake(), { signal: abort.signal });
    document.addEventListener("focusout", () => wake(), { signal: abort.signal });
    window.addEventListener("resize", resize, eventOptions);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else wake();
    }, { signal: abort.signal });
    // Grid collapse and CSS hover transforms change lens geometry each frame.
    document.addEventListener("transitionrun", () => wake(600), { signal: abort.signal });
    reducedMotion.addEventListener("change", () => wake(), { signal: abort.signal });
    canvas.addEventListener("webglcontextlost", () => destroy(), { signal: abort.signal });
    if (!isCurrent()) { destroy(); return null; }
    document.body.append(canvas);
    root.dataset.glassRenderer = "webgl";
    discover();
    resize();
    return { destroy };
  } catch (error) {
    console.warn("Liquid glass uses CSS fallback:", error instanceof Error ? error.message : "rendering unavailable");
    destroy();
    return null;
  }
}
