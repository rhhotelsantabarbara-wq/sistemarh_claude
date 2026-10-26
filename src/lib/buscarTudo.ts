/**
 * O Supabase devolve no máximo 1.000 linhas por consulta. Para tabelas grandes
 * (ex.: registros de ponto de todos os funcionários no mês), busca em páginas.
 * Uso: buscarTudo((de, ate) => supabase.from("x").select("*").gte(...).range(de, ate))
 */
export async function buscarTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>,
  tamanho = 1000,
): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < tamanho) break;
  }
  return todos;
}
