/**
 * @author Zywe
 * @version 2.0.0
 */
import { useEffect } from 'react';
/**
 * @type {string}
 */
const THEME_STORAGE_KEY = 'zywe-theme-preference';
/**
 * @type {number}
 */
const THEME_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
/**
 * @type {Object}
 */
const ThemeMode = {
  SYSTEM: 'system',
  DARK: 'dark',
  LIGHT: 'light'
};
export default function ThemeIsland() {
  useEffect(() => {
    /**
     * @returns {boolean}
     */
    const getSystemThemePreference = () => {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    /**
     * @returns {Object|null}
     */
    const getCachedThemePreference = () => {
      try {
        const themeData = localStorage.getItem(THEME_STORAGE_KEY);
        if (!themeData) return null;
        const { mode, timestamp } = JSON.parse(themeData);
        if (Date.now() - timestamp > THEME_CACHE_DURATION) {
          localStorage.removeItem(THEME_STORAGE_KEY);
          return null;
        }
        return { mode };
      } catch (error) {
        console.error('读取主题缓存失败:', error);
        return null;
      }
    };
    /**
     * @param {string} mode
     */
    const saveThemePreference = (mode) => {
      try {
        const themeData = JSON.stringify({
          mode,
          timestamp: Date.now()
        });
        localStorage.setItem(THEME_STORAGE_KEY, themeData);
      } catch (error) {
        console.error('保存主题偏好失败:', error);
      }
    };
    /**
     * @param {string} mode
     */
    const applyTheme = (mode) => {
      if (mode === ThemeMode.SYSTEM) {
        const isDarkMode = getSystemThemePreference();
        if (isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else if (mode === ThemeMode.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    const initializeTheme = () => {
      const cachedPreference = getCachedThemePreference();
      let themeMode = ThemeMode.SYSTEM;
      if (cachedPreference) {
        themeMode = cachedPreference.mode;
      }
      applyTheme(themeMode);
    };
    initializeTheme();
    window.toggleTheme = function() {
      const isDarkMode = document.documentElement.classList.contains('dark');
      if (isDarkMode) {
        document.documentElement.classList.remove('dark');
        saveThemePreference(ThemeMode.LIGHT);
      } else {
        document.documentElement.classList.add('dark');
        saveThemePreference(ThemeMode.DARK);
      }
    };
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      const cachedPreference = getCachedThemePreference();
      if (!cachedPreference || cachedPreference.mode === ThemeMode.SYSTEM) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleThemeChange);
    } else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(handleThemeChange);
    }
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleThemeChange);
      } else if (mediaQueryList.removeListener) {
        mediaQueryList.removeListener(handleThemeChange);
      }
    };
  }, []);
  return <div className="hidden"></div>;
}
