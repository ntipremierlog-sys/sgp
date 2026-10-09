import { describe, it, expect, beforeEach } from "vitest";
import {
  autenticarComSenha,
  definirSenha,
  alterarSenha,
  gerarTokenRedefinicao,
  redefinirSenhaComToken,
  validarTokenRedefinicao,
  gerarHashSenha,
  conferirSenha,
  SENHA_INICIAL_DEV,
  MAX_TENTATIVAS_LOGIN,
  _reiniciarArmazemCredenciaisParaTestes,
} from "@/lib/auth/credenciais";
import { validarPoliticaSenha } from "@/lib/auth/politica-senha";
import { codificarTokenSessao, renovarTokenSessao, decodificarTokenSessao } from "@/lib/auth/sessao";
import { USUARIOS_PADRAO } from "@/lib/auth/usuarios";

const ADMIN = USUARIOS_PADRAO[0].email;
const SENHA_FORTE = "Postos#Seguros2026";

describe("Autenticação por senha (contas locais)", () => {
  beforeEach(() => _reiniciarArmazemCredenciaisParaTestes());

  it("hash scrypt não guarda a senha em texto e confere corretamente", () => {
    const hash = gerarHashSenha(SENHA_FORTE);
    expect(hash).not.toContain(SENHA_FORTE);
    expect(conferirSenha(SENHA_FORTE, hash)).toBe(true);
    expect(conferirSenha("outra", hash)).toBe(false);
  });

  it("política exige tamanho, maiúscula, minúscula, número, especial e não conter o e-mail", () => {
    expect(validarPoliticaSenha("curta")).not.toHaveLength(0);
    expect(validarPoliticaSenha("SemNumero!!!")).toContain("Um número");
    expect(validarPoliticaSenha("Admin.sgp#2026x", ADMIN)).toContain("Não conter o nome do e-mail");
    expect(validarPoliticaSenha(SENHA_FORTE, ADMIN)).toHaveLength(0);
  });

  it("senha inicial do admin funciona e exige troca no primeiro acesso", () => {
    const r = autenticarComSenha(ADMIN, SENHA_INICIAL_DEV);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trocarSenha).toBe(true);
  });

  it("e-mail inexistente e senha errada retornam a mesma resposta genérica", () => {
    const a = autenticarComSenha("ninguem@premierlogistics.com.br", "x");
    const b = autenticarComSenha(ADMIN, "SenhaErrada#1");
    expect(a).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
    expect(b).toEqual({ ok: false, motivo: "CREDENCIAIS_INVALIDAS" });
  });

  it("bloqueia a conta após tentativas inválidas consecutivas", () => {
    let ultimo = autenticarComSenha(ADMIN, "Errada#0001");
    for (let i = 1; i < MAX_TENTATIVAS_LOGIN; i++) ultimo = autenticarComSenha(ADMIN, "Errada#0001");
    expect(ultimo.ok).toBe(false);
    if (!ultimo.ok) expect(ultimo.motivo).toBe("BLOQUEADO");
    // Mesmo com a senha correta, permanece bloqueada durante o período
    const r = autenticarComSenha(ADMIN, SENHA_INICIAL_DEV);
    expect(r.ok).toBe(false);
  });

  it("após definir a senha, a temporária deixa de valer e a troca não é mais exigida", () => {
    autenticarComSenha(ADMIN, SENHA_INICIAL_DEV);
    expect(definirSenha(ADMIN, SENHA_FORTE)).toEqual({ ok: true });
    expect(autenticarComSenha(ADMIN, SENHA_INICIAL_DEV).ok).toBe(false);
    const r = autenticarComSenha(ADMIN, SENHA_FORTE);
    expect(r.ok && !r.trocarSenha).toBe(true);
  });

  it("troca voluntária exige a senha atual correta e senha nova diferente", () => {
    definirSenha(ADMIN, SENHA_FORTE);
    expect(alterarSenha(ADMIN, "Errada#123456", "Nova#Senha2026x").ok).toBe(false);
    expect(alterarSenha(ADMIN, SENHA_FORTE, SENHA_FORTE).ok).toBe(false);
    expect(alterarSenha(ADMIN, SENHA_FORTE, "Nova#Senha2026x").ok).toBe(true);
  });

  it("token de redefinição é de uso único", () => {
    autenticarComSenha(ADMIN, SENHA_INICIAL_DEV);
    const token = gerarTokenRedefinicao(ADMIN);
    expect(token).toBeTruthy();
    expect(validarTokenRedefinicao(token!).ok).toBe(true);
    expect(redefinirSenhaComToken(token!, SENHA_FORTE).ok).toBe(true);
    expect(validarTokenRedefinicao(token!).ok).toBe(false);
    expect(autenticarComSenha(ADMIN, SENHA_FORTE).ok).toBe(true);
  });

  it("não gera token para e-mail desconhecido", () => {
    expect(gerarTokenRedefinicao("desconhecido@x.com")).toBeNull();
  });
});

describe("Sessão deslizante", () => {
  it("renovar o token atualiza o timestamp e mantém a assinatura válida", () => {
    const antigo = codificarTokenSessao(USUARIOS_PADRAO[0], { timestamp: Date.now() - 20 * 60 * 1000 });
    const renovado = renovarTokenSessao(antigo);
    expect(renovado).toBeTruthy();
    const dec = decodificarTokenSessao(renovado!);
    expect(dec?.userId).toBe(USUARIOS_PADRAO[0].id);
    expect(Date.now() - (dec?.timestamp ?? 0)).toBeLessThan(5000);
  });

  it("não renova token já expirado", () => {
    const expirado = codificarTokenSessao(USUARIOS_PADRAO[0], { timestamp: Date.now() - 31 * 60 * 1000 });
    expect(renovarTokenSessao(expirado)).toBeNull();
  });
});
