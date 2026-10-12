// O FireCheck da gravação: a mesma API (api/index.js) e a build do app desta
// pasta, servidas juntas como o server.js do container — mas com a build em
// tutoriais/.dist, para a gravação não brigar com quem estiver rodando
// `vite build` no dist/ do app ao mesmo tempo.
//
// Não roda sozinho: quem sobe é `ambiente.mjs subir N`, com as variáveis do ambiente.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiHandler from "../../api/index.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(aqui, "..", ".dist");
const PORT = Number(process.env.PORT);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.all("/api/*", async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error("[api] erro não tratado:", err);
    if (!res.headersSent) res.status(500).json({ error: "Erro interno do servidor." });
  }
});
app.use(express.static(DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Rota não encontrada." });
  res.sendFile(path.join(DIST, "index.html"));
});
app.listen(PORT, "127.0.0.1", () => console.log(`FireCheck da gravação em http://127.0.0.1:${PORT}`));
