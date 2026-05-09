/**
 * Application entry point.
 *
 * Mounts the TypeSiege game component into the #root div.
 * No router is needed — this is a single-page game.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { TypeSiege } from "./components/TypeSiege";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TypeSiege />
  </React.StrictMode>,
);
