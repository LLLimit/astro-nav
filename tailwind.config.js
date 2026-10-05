/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'], 
  darkMode: 'class', 
  theme: {
    extend: { 
      screens: {
        'xs': '375px', 
        'sm': '640px', 
        'md': '768px', 
        'lg': '1024px', 
        'xl': '1280px', 
        '2xl': '1536px', 
        'h-sm': {'raw': '(max-height: 600px)'},
        'h-md': {'raw': '(min-height: 601px) and (max-height: 900px)'},
        'h-lg': {'raw': '(min-height: 901px)'},
        'landscape': {'raw': '(orientation: landscape)'},
        'portrait': {'raw': '(orientation: portrait)'},
      },
      keyframes: { 
        wave: { 
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
      animation: { 
        wave: 'wave 1.2s infinite', 
      },
      colors: { 
        primary: { 
          500: '#0ea5e9', 
          600: '#0284c7',
        },
      },
    },
  },
  plugins: [ 
  ],
};