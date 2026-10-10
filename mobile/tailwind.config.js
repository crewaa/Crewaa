/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        peacock: {
          bg: "#071A1F",
          deep: "#04121A",
          surface: "#0D252B",
          raised: "#12303A",
          line: "#1C3B43",
          text: "#EAF4F3",
          muted: "#8FB0B0",
          teal: "#26BDB0",
          "on-teal": "#03201C",
          gold: "#D8B45A",
          "gold-hi": "#F1DA97",
          blue: "#4FB3D9",
          ok: "#86D36B",
          warn: "#F29A4A",
          danger: "#F2716B",
        },
        part: {
          collabs: "#26BDB0",
          grow: "#D8B45A",
          ai: "#8FA8FF",
          suite: "#EE8A6B",
          crew: "#B49CF0",
        },
      },
    },
  },
  plugins: [],
};
