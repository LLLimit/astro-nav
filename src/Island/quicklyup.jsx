import React, { useState, useEffect, useRef, useCallback } from 'react';
const SCROLL_THRESHOLD = 400;      
const AUTO_HIDE_DURATION = 5000;   
const SCROLL_STOP_DELAY = 500;     
/**
 * 快速返回顶部按钮组件
 * 功能：
 * 1. 页面向下滚动一定距离并停止滚动后出现，带有平滑动画。
 * 2. 点击按钮平滑返回页面顶部。
 * 3. 按钮出现后，若1.5秒内无滚动或点击操作，则自动隐藏。
 * 4. 再次滚动时，按钮会暂时隐藏，停止滚动后重新判断是否显示。
 */
const QuicklyUpButton = () => {
  const [isVisible, setIsVisible] = useState(false); 
  const autoHideTimeoutRef = useRef(null); 
  const scrollStopTimeoutRef = useRef(null); 
  const hideButton = useCallback(() => {
    setIsVisible(false);
    clearTimeout(autoHideTimeoutRef.current);
  }, []); 
  const showButton = useCallback(() => {
    setIsVisible(true);
    clearTimeout(autoHideTimeoutRef.current); 
    autoHideTimeoutRef.current = setTimeout(() => {
      hideButton(); 
    }, AUTO_HIDE_DURATION);
  }, [hideButton]); 
  const handleScroll = useCallback(() => {
    clearTimeout(scrollStopTimeoutRef.current); 
    clearTimeout(autoHideTimeoutRef.current);   
    if (isVisible) {
      hideButton();
    }
    scrollStopTimeoutRef.current = setTimeout(() => {
      if (window.scrollY > SCROLL_THRESHOLD) {
        showButton(); 
      } else {
        hideButton(); 
      }
    }, SCROLL_STOP_DELAY);
  }, [isVisible, showButton, hideButton]); 
  const handleClick = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    showButton(); 
  }, [showButton]); 
  useEffect(() => {
    const initialCheckTimerId = setTimeout(() => {
      if (window.scrollY > SCROLL_THRESHOLD) {
        showButton(); 
      }
    }, SCROLL_STOP_DELAY); 
    return () => {
      clearTimeout(initialCheckTimerId); 
      clearTimeout(autoHideTimeoutRef.current); 
    };
  }, [showButton]); 
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollStopTimeoutRef.current);
    };
  }, [handleScroll]); 
  const buttonClasses = `
    fixed bottom-8 right-8 z-50 p-3 
    bg-white dark:bg-gray-800 
    text-black dark:text-white 
    rounded-full shadow-xl 
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
    transition-all duration-300 ease-in-out
    ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
  `;
  return (
    <button
      onClick={handleClick}
      className={buttonClasses}
      aria-label="快速返回顶部"
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2} 
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 16L12 10L18 16" />
      </svg>
    </button>
  );
};
export default QuicklyUpButton;