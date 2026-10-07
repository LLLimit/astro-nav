export const WALLPAPER_LIMIT = 30;
export const WALLPAPER_UPLOAD_PATH = /^\/media\/backgrounds\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/;
export const DEFAULT_WALLPAPER = "/images/glass-city.jpg";
export const FALLBACK_WALLPAPER_COLOR = "#1d1d1f";

export type UploadedWallpaper = { name: string; path: string };
export type WallpaperChoice = { id: string; name: string; value: string; type: "image" | "color" };
type WallpaperSettings = {
  backgroundType: string;
  backgroundValue: string;
  wallpapers: UploadedWallpaper[];
  showBuiltinWallpapers: boolean;
};

export function siteWallpaper(settings: WallpaperSettings) {
  if (settings.backgroundType === "image" && WALLPAPER_UPLOAD_PATH.test(settings.backgroundValue))
    return { type: "image" as const, value: settings.backgroundValue };
  if (settings.backgroundType === "color" && /^#[a-f0-9]{6}$/i.test(settings.backgroundValue))
    return { type: "color" as const, value: settings.backgroundValue };
  if (settings.showBuiltinWallpapers) return { type: "image" as const, value: DEFAULT_WALLPAPER };
  if (settings.wallpapers.length) return { type: "image" as const, value: settings.wallpapers[0].path };
  return { type: "color" as const, value: FALLBACK_WALLPAPER_COLOR };
}

export function wallpaperChoices(settings: WallpaperSettings): WallpaperChoice[] {
  const defaultWallpaper = siteWallpaper(settings);
  const hasDefault = settings.showBuiltinWallpapers || settings.wallpapers.length > 0 || settings.backgroundType === "color" || (settings.backgroundType === "image" && WALLPAPER_UPLOAD_PATH.test(settings.backgroundValue));
  const choices: WallpaperChoice[] = hasDefault ? [{ id: "default", name: "网站默认", ...defaultWallpaper }] : [];
  const builtins = [
    { id: "city", name: "城市晴空", value: DEFAULT_WALLPAPER },
    { id: "silk", name: "经典流光", value: "/images/glass-wallpaper.svg" },
  ];
  if (settings.showBuiltinWallpapers)
    for (const builtin of builtins)
      if (builtin.value !== defaultWallpaper.value) choices.push({ ...builtin, type: "image" });
  for (const wallpaper of settings.wallpapers)
    choices.push({ id: wallpaper.path, name: wallpaper.name, value: wallpaper.path, type: "image" });
  return choices;
}
