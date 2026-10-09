/**
 * Política de senha das contas locais do SGP (módulo puro: usado no servidor e na tela).
 */
export const TAMANHO_MINIMO_SENHA = 10;

export interface RequisitoSenha {
  id: string;
  rotulo: string;
  atendido: boolean;
}

export function avaliarPoliticaSenha(senha: string, email?: string): RequisitoSenha[] {
  const usuarioEmail = email ? email.trim().toLowerCase().split("@")[0] : "";
  return [
    { id: "tamanho", rotulo: `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres`, atendido: senha.length >= TAMANHO_MINIMO_SENHA },
    { id: "maiuscula", rotulo: "Uma letra maiúscula", atendido: /[A-Z]/.test(senha) },
    { id: "minuscula", rotulo: "Uma letra minúscula", atendido: /[a-z]/.test(senha) },
    { id: "numero", rotulo: "Um número", atendido: /\d/.test(senha) },
    { id: "especial", rotulo: "Um caractere especial (!@#$...)", atendido: /[^A-Za-z0-9]/.test(senha) },
    {
      id: "email",
      rotulo: "Não conter o nome do e-mail",
      atendido: !usuarioEmail || usuarioEmail.length < 3 || !senha.toLowerCase().includes(usuarioEmail),
    },
  ];
}

export function validarPoliticaSenha(senha: string, email?: string): string[] {
  return avaliarPoliticaSenha(senha, email)
    .filter((r) => !r.atendido)
    .map((r) => r.rotulo);
}
