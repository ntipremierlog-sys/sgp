"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import {
  LayoutAutenticacao,
  CampoSenha,
  BotaoAuth,
  AlertaAuth,
  ChecklistSenha,
  senhaAtendePolitica,
} from "@/components/auth/layout-autenticacao";

type Modo = "carregando" | "PRIMEIRO_ACESSO" | "VOLUNTARIA" | "SEM_SESSAO";

function FormularioTrocarSenha() {
  const router = useRouter();
  const destino = useSearchParams().get("destino");
  const destinoSeguro = destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";

  const [modo, setModo] = useState<Modo>("carregando");
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    fetch("/api/auth/senha", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setModo((d.modo as Modo) || "SEM_SESSAO");
        if (d.email) setEmail(d.email);
      })
      .catch(() => setModo("SEM_SESSAO"));
  }, []);

  const primeiroAcesso = modo === "PRIMEIRO_ACESSO";
  const podeEnviar = senhaAtendePolitica(senha, email) && senha === confirmacao && (primeiroAcesso || senhaAtual.length > 0);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    setErros([]);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "trocar", senhaAtual: primeiroAcesso ? undefined : senhaAtual, novaSenha: senha }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        setErros(data.erros || [data.erro || "Não foi possível alterar a senha."]);
        setCarregando(false);
        return;
      }
      if (primeiroAcesso) {
        window.dispatchEvent(new CustomEvent("sgp-sessao-alterada"));
        router.replace(destinoSeguro);
        router.refresh();
        return;
      }
      setSucesso(true);
      setSenhaAtual("");
      setSenha("");
      setConfirmacao("");
      setCarregando(false);
    } catch {
      setErros(["Falha de comunicação com o servidor."]);
      setCarregando(false);
    }
  };

  return (
    <LayoutAutenticacao
      titulo={primeiroAcesso ? "Defina sua senha" : "Alterar senha"}
      subtitulo={
        primeiroAcesso ? (
          <>Primeiro acesso de <span className="font-medium text-[#1A2230]">{email}</span>. Por segurança, troque a senha temporária antes de continuar.</>
        ) : email ? (
          <>Conta <span className="font-medium text-[#1A2230]">{email}</span>.</>
        ) : undefined
      }
      rodape={
        primeiroAcesso ? undefined : (
          <Link href={modo === "VOLUNTARIA" ? "/" : "/login"} className="inline-flex items-center gap-1.5 font-medium text-[#28185A] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" />
            {modo === "VOLUNTARIA" ? "Voltar ao sistema" : "Voltar para o login"}
          </Link>
        )
      }
    >
      {modo === "carregando" && <div className="h-48 rounded-xl bg-white border border-[#EAECF0] animate-pulse" />}

      {modo === "SEM_SESSAO" && (
        <div className="space-y-4">
          <AlertaAuth tipo="info">Entre no sistema para alterar sua senha, ou use “Esqueci minha senha” na tela de login.</AlertaAuth>
          <Link href="/login" className="w-full h-11 inline-flex items-center justify-center rounded-xl bg-[#28185A] text-sm font-semibold text-white">
            Ir para o login
          </Link>
        </div>
      )}

      {(modo === "PRIMEIRO_ACESSO" || modo === "VOLUNTARIA") && (
        <form onSubmit={salvar} className="space-y-4" noValidate>
          {primeiroAcesso && (
            <div className="flex items-center gap-2.5 text-[12px] text-[#8A7A52]">
              <KeyRound className="w-4 h-4" />
              A senha temporária deixa de valer após a troca.
            </div>
          )}
          {sucesso && <AlertaAuth tipo="sucesso">Senha alterada com sucesso.</AlertaAuth>}
          {erros.length > 0 && (
            <AlertaAuth tipo="erro">
              <ul className="list-disc pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
            </AlertaAuth>
          )}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          {!primeiroAcesso && (
            <CampoSenha id="trocar-senha-atual" rotulo="Senha atual" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoFocus />
          )}
          <CampoSenha id="trocar-nova-senha" rotulo="Nova senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus={primeiroAcesso} />
          <CampoSenha id="trocar-confirmacao" rotulo="Confirmar nova senha" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          <ChecklistSenha senha={senha} email={email} confirmacao={confirmacao} />
          <BotaoAuth type="submit" id="botao-salvar-senha" carregando={carregando} disabled={!podeEnviar}>
            {primeiroAcesso ? "Salvar e entrar" : "Salvar nova senha"}
          </BotaoAuth>
        </form>
      )}
    </LayoutAutenticacao>
  );
}

export default function TrocarSenhaPage() {
  return (
    <Suspense fallback={null}>
      <FormularioTrocarSenha />
    </Suspense>
  );
}
