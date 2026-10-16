import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Se o site foi atualizado enquanto a aba estava aberta, partes antigas do código deixam de existir.
// Nesse caso recarrega a página uma vez para buscar a versão nova (em vez de falhar sem aviso).
window.addEventListener("vite:preloadError", (evento) => {
  const chave = "recarregou-apos-atualizacao";
  let jaRecarregou = false;
  try { jaRecarregou = sessionStorage.getItem(chave) === "1"; } catch { /* sem sessionStorage */ }
  if (jaRecarregou) return;
  evento.preventDefault();
  try { sessionStorage.setItem(chave, "1"); } catch { /* sem sessionStorage */ }
  window.location.reload();
});


createRoot(document.getElementById("root")!).render(<App />);
