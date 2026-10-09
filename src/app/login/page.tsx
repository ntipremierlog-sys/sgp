"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LayoutAutenticacao, CampoAuth, CampoSenha, BotaoAuth, AlertaAuth } from "@/components/auth/layout-autenticacao";

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const expirado = params.get("expirado") === "inatividade";
  const senhaRedefinida = params.get("senha") === "redefinida";
  const destino = params.get("destino");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const destinoSeguro = destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) throw new Error(data.erro || "Falha na autenticação");

      if (data.trocarSenha) {
        router.push(`/login/trocar-senha?destino=${encodeURIComponent(destinoSeguro)}`);
        return;
      }
      window.dispatchEvent(new CustomEvent("sgp-sessao-alterada"));
      router.replace(destinoSeguro);
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
      setSenha("");
      setCarregando(false);
    }
  };

  return (
    <LayoutAutenticacao
      titulo="Acessar o sistema"
      subtitulo="Entre com seu e-mail corporativo e senha."
      rodape={
        <>
          Problemas de acesso? Fale com o Administrador Premier do contrato.
          <br />
          <span className="text-[#98A2B3]">O perfil de acesso é definido pela sua conta, nunca escolhido na tela.</span>
        </>
      }
    >
      <form onSubmit={entrar} className="space-y-4" noValidate>
        {expirado && <AlertaAuth tipo="info">Sua sessão foi encerrada após 30 minutos de inatividade. Entre novamente.</AlertaAuth>}
        {senhaRedefinida && <AlertaAuth tipo="sucesso">Senha redefinida com sucesso. Entre com a nova senha.</AlertaAuth>}
        {erro && <AlertaAuth tipo="erro">{erro}</AlertaAuth>}

        <CampoAuth
          id="login-email"
          rotulo="E-mail corporativo"
          type="email"
          autoComplete="username"
          placeholder="nome@premierlogistics.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          disabled={carregando}
        />

        <CampoSenha
          id="login-senha"
          rotulo="Senha"
          autoComplete="current-password"
          placeholder="••••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={carregando}
          acessorio={
            <Link href="/login/esqueci-senha" id="link-esqueci-senha" className="text-xs font-medium text-[#28185A] hover:underline">
              Esqueci minha senha
            </Link>
          }
        />

        <div className="pt-1">
          <BotaoAuth type="submit" id="botao-entrar" carregando={carregando}>
            Entrar
            {!carregando && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
          </BotaoAuth>
        </div>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[#E4E7EC]" />
          <span className="mx-3 text-[10px] font-semibold uppercase tracking-wider text-[#98A2B3]">ou</span>
          <div className="flex-grow border-t border-[#E4E7EC]" />
        </div>

        <button
          type="button"
          id="botao-entra-id"
          disabled
          title="Integração com Microsoft Entra ID em configuração"
          className="w-full h-11 inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#D0D5DD] bg-white text-sm font-medium text-[#344054] opacity-70 cursor-not-allowed"
        >
          <span className="grid grid-cols-2 gap-[2px] w-4 h-4" aria-hidden>
            <span className="bg-[#F25022]" />
            <span className="bg-[#7FBA00]" />
            <span className="bg-[#00A4EF]" />
            <span className="bg-[#FFB900]" />
          </span>
          Microsoft Entra ID
          <span className="text-[10px] font-semibold text-[#8A7A52] uppercase tracking-wide">em breve</span>
        </button>
      </form>
    </LayoutAutenticacao>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <FormularioLogin />
    </Suspense>
  );
}
