/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        // Paleta de marca tomada del logo: fondo crema, tinta casi negra
        crema: '#f5f2ea',
        tinta: '#1f1d1a',
        pagado: '#16a34a',
        pendiente: '#ca8a04',
        vencido: '#dc2626',
      },
    },
  },
  plugins: [],
}
