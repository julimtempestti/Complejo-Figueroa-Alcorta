/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'Cambria', 'serif'],
      },
      // Tipografías más grandes en toda la app, para mejorar la legibilidad
      // (pensado para personas mayores o con baja visión).
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }], // 13px (antes 12)
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], //  15px (antes 14)
        base: ['1.0625rem', { lineHeight: '1.65rem' }], // 17px (antes 16)
        lg: ['1.1875rem', { lineHeight: '1.8rem' }], //  19px (antes 18)
        xl: ['1.3125rem', { lineHeight: '1.85rem' }], // 21px (antes 20)
        '2xl': ['1.625rem', { lineHeight: '2.1rem' }], // 26px (antes 24)
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
