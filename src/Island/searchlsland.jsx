import React, { useEffect, useRef, useState } from 'react';
import { sites, categories } from '../data/navLinks.js';
export default function SearchIsland() {
  const [isVisible, setIsVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);
  const searchResultsRef = useRef(null);
  const openSearch = () => {
    setIsVisible(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
  };
  const closeSearch = () => {
    setTimeout(() => {
      setIsVisible(false);
      if (searchResultsRef.current) {
        searchResultsRef.current.classList.add('hidden');
      }
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
      setSearchResults([]);
    }, 10);
  };
  const handleSearchInput = (e) => {
    const searchTerm = e.target.value.trim().toLowerCase();
    if (!searchTerm) {
      setSearchResults([]);
      searchResultsRef.current?.classList.add('hidden');
      return;
    }
    const getCategoryNameById = (categoryId) => {
      const category = categories.find(cat => cat.id === categoryId);
      return category ? category.name : '';
    };
    const filteredResults = sites.filter(site => {
      const categoryObj = categories.find(cat => cat.id === site.category);
      const categoryName = categoryObj ? categoryObj.name.toLowerCase() : '';
      return (
        site.title.toLowerCase().includes(searchTerm) ||
        site.url.toLowerCase().includes(searchTerm) ||
        (site.shortDesc && site.shortDesc.toLowerCase().includes(searchTerm)) ||
        categoryName.includes(searchTerm)
      );
    }).map(site => {
      const categoryObj = categories.find(cat => cat.id === site.category);
      return {
        ...site,
        categoryName: categoryObj ? categoryObj.name : '',
        categoryIcon: categoryObj ? categoryObj.icon : null 
      };
    });
    setSearchResults(filteredResults);
    if (filteredResults.length > 0) {
      searchResultsRef.current?.classList.remove('hidden');
    } else {
      searchResultsRef.current?.classList.add('hidden');
    }
  };
  useEffect(() => {
    const searchToggle = document.getElementById('search-toggle');
    const searchHint = document.getElementById('search-hint');
    const handleSearchToggleClick = (e) => {
      e.preventDefault(); 
      e.stopPropagation(); 
      openSearch();
    };
    const handleSearchHintClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSearch();
    };
    searchToggle?.addEventListener('click', handleSearchToggleClick, {passive: false});
    searchToggle?.addEventListener('touchend', handleSearchToggleClick, {passive: false});
    searchHint?.addEventListener('click', handleSearchHintClick, {passive: false});
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') {
        closeSearch();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      searchToggle?.removeEventListener('click', handleSearchToggleClick);
      searchToggle?.removeEventListener('touchend', handleSearchToggleClick);
      searchHint?.removeEventListener('click', handleSearchHintClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  if (!isVisible) return null;
  return (
    <>
      {/* 搜索框容器 */}
      <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/4 w-full max-w-5xl px-4 z-50">
        <div className="relative">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input 
                type="text" 
                ref={searchInputRef}
                placeholder="搜索网站..." 
                className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 border-none"
                onChange={handleSearchInput}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* 搜索结果容器 */}
            <div ref={searchResultsRef} className="mt-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hidden">
              {searchResults.length > 0 ? (
                searchResults.map(result => (
                  <div 
                    key={result.id} 
                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer flex items-start"
                    onClick={() => { 
                      if (result.url) window.location.href = result.url; 
                      closeSearch(); 
                    }}
                  >
                    <div className="w-10 h-10 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                      <img 
                        src={result.icon || result.categoryIcon || '/images/default.svg'} 
                        alt={result.title} 
                        className="w-6 h-6 object-contain" 
                        loading="lazy" 
                        width="24"
                        height="24"
                        onError={(e) => { 
                          e.target.onerror = null; 
                          e.target.src='/icons/default.svg'; 
                        }}
                      />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{result.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{result.shortDesc || result.description}</p>
                      {result.categoryName && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">分类: {result.categoryName}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 dark:text-gray-400">
                  似乎我们没有收录这个网站,欢迎提交!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 搜索背景遮罩 - 改进触摸事件处理 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeSearch();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeSearch();
        }}
      />
    </>
  );
}
