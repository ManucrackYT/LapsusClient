/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
    content: ["./themes/lapsus/*.ejs", "./themes/lapsus/**/*.ejs"],
    theme: {
        extend: {},
        colors: {
            transparent: 'transparent',
            current: 'currentColor',
            black: colors.black,
            white: colors.white,
            gray: colors.gray,
            red: colors.red,
            emerald: colors.emerald,
            indigo: colors.indigo,
            yellow: colors.yellow,
            rose: {
                400: '#be3e76',
                500: '#d2417c',
                600: '#d2417c',
                700: '#be3e76',
            },
            dark: {
                500: '#1e293b',
                600: '#1e293b',
                700: '#0f172a',
                800: '#020617',
            },
          },
    },
    plugins: [
        require("@tailwindcss/forms"),
    ],
}