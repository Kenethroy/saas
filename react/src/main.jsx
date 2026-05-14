import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRouter } from "@/app/router";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@/styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>
);
