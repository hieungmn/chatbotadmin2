import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
    plugins: [
        react()
    ],

    define: {
        "process.env": {},
        "process.browser": true
    },

    build: {
        lib: mode === 'admin' ? undefined : {
            entry: resolve(
                __dirname,
                "src/widget-entry.tsx"
            ),
            name: "ChatbotWidget",
            fileName: () => "chatbot-widget.js",
            formats: [
                "iife"
            ]
        },

        outDir: mode === 'admin' ? 'dist-admin' : 'dist',
        emptyOutDir: true,
        sourcemap: false,
        minify: "esbuild"
    }
}));
