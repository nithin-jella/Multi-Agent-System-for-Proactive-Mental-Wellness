module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ugm: {
          blue: {
            DEFAULT: '#001D58',
            dark: '#00134A',
            light: '#1C3C80'
          },
          gold: {
            DEFAULT: '#FFCA40',
            dark: '#FFAB00',
            light: '#FFE08C'
          },
          aurora: {
            pink: '#FF75D1',   // Soft neon pink
            purple: '#C175FF', // Soft neon purple
            blue: '#75BFFF',   // Soft neon blue
            cyan: '#75FFEE',   // Soft neon cyan
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        // Simplified animations for better build performance
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'border-spin': 'borderSpin 3s linear infinite',
        'lightning-border': 'lightningBorder 2s linear infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        // Simplified keyframes for better performance
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        borderSpin: {
          'to': { '--angle': '360deg' }
        },
        lightningBorder: {
          '0%, 100%': { '--angle': '0deg' },
          '50%': { '--angle': '180deg' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
    },
  },
  plugins: [],
}