/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: { forest: '#0d4a2b', leaf: '#176b40', mist: '#ecf6ef', canvas: '#f3f6f4', ink: '#14241b' },
      boxShadow: { card: '0 8px 24px -4px rgba(13, 74, 43, 0.08)' }
    }
  },
  plugins: []
};
