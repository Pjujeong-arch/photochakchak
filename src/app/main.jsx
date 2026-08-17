import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { startWeatherTheme } from "../services/index.js";
import App from "./App.jsx";

startWeatherTheme();

const root = document.getElementById("root");
if (!root) throw new Error("root missing");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
