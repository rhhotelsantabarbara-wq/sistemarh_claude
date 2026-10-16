import { lazy, type ComponentType } from "react";

// Carrega a tela sob demanda. Se o arquivo não existir mais (o site foi atualizado
// enquanto a aba estava aberta), recarrega a página uma vez para buscar a versão nova.
export function lazyComRetry<T extends ComponentType<any>>(carregar: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const chave = "recarregou-apos-atualizacao";
    try {
      const modulo = await carregar();
      try { sessionStorage.removeItem(chave); } catch { /* sem sessionStorage */ }
      return modulo;
    } catch (erro) {
      let jaRecarregou = false;
      try { jaRecarregou = sessionStorage.getItem(chave) === "1"; } catch { /* sem sessionStorage */ }
      if (!jaRecarregou) {
        try { sessionStorage.setItem(chave, "1"); } catch { /* sem sessionStorage */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw erro;
    }
  });
}
