import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        index: "index.html",
        person: "person.html",
        survey: "PatientSurvey.html",
        appointment: "appointment.html",
        doctor: "Doctor.html",
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
