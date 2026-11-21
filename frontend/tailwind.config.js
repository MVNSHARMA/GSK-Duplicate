/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e60000',
          dark: '#cc0000',
          light: '#ff3333',
        },
        dark: '#111111',
        lightBg: '#f8f9fa'
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        heading: ['"Bebas Neue"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
