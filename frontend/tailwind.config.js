/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          dark: '#081525',
          pitch: '#172337',
          grass: '#2862BD',
          turf: '#AEBBCF',
          gold: '#fbbf24',
          goldDark: '#d97706',
          card: '#101827',
          border: '#334155',
        }
      },
      backgroundImage: {
        'stadium-gradient': 'radial-gradient(ellipse at top, #172337 0%, #132C57 50%, #081525 100%)',
        'pitch-pattern': 'linear-gradient(180deg, #172337 0%, #2862BD 50%, #172337 100%)',
      }
    },
  },
  plugins: [],
}
