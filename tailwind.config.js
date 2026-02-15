/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        fluid: "repeat(auto-fit,minmax(200px,1fr))",
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          400: '#00a8ff',
          500: '#00a8ff',
          600: '#0066ff',
        }
      },
      animation: {
        'float-particle': 'float-particle 20s infinite linear',
        'fadeIn': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        'float-particle': {
          'from': { transform: 'translateY(100vh) translateX(0)', opacity: '0' },
          '10%, 90%': { opacity: '1' },
          'to': { transform: 'translateY(-100px) translateX(100px)', opacity: '0' }
        },
        'fadeIn': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};