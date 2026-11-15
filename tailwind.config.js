/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { forest: '#0f3b21', leaf: '#1e6b3b', mist: '#eef6f0', canvas: '#f8faf9' }, boxShadow: { soft: '0 10px 30px rgba(15,59,33,.07)' } } },
  plugins: []
};
