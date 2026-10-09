"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { LayoutAutenticacao, CampoAuth, BotaoAuth, AlertaAuth } from "@/components/auth/layout-autenticacao";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState<{ mensagem: string; linkDev?: string } | null>(null);

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!email.trim()) {
      setErro("Informe o e-mail cadastrado.");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "esqueci", email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) throw new Error(data.erro || "Não foi possível processar a solicitação.");
      setEnviado({ mensagem: data.mensagem, linkDev: data.linkDev });
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutAutenticacao
      titulo="Esqueci minha senha"
      subtitulo="Informe seu e-mail corporativo para receber um link de redefinição válido por 30 minutos."
      rodape={
        <Link href="/login" id="voltar-login" className="inline-flex items-center gap-1.5 font-medium text-[#28185A] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#D9D3EA] px-4 py-4">
            <span className="w-10 h-10 rounded-full border border-[#D8C7A0] flex items-center justify-center text-[#8A7A52] shrink-0">
              <MailCheck className="w-5 h-5" />
            </span>
            <p className="text-[13px] text-[#344054] leading-snug">{enviado.mensagem}</p>
          </div>
          <p className="text-xs text-[#667085]">
            Contas com login Microsoft Entra ID devem redefinir a senha pelo portal corporativo.
          </p>
          {enviado.linkDev && (
            <AlertaAuth tipo="info">
              <span className="font-semibold">Ambiente de homologação:</span> o envio de e-mail ainda não está configurado.{" "}
              <Link href={enviado.linkDev} id="link-redefinicao-dev" className="font-semibold underline">
                Abrir link de redefinição
              </Link>
            </AlertaAuth>
          )}
        </div>
      ) : (
        <form onSubmit={solicitar} className="space-y-4" noValidate>
          {erro && <AlertaAuth tipo="erro">{erro}</AlertaAuth>}
          <CampoAuth
            id="esqueci-email"
            rotulo="E-mail corporativo"
            type="email"
            autoComplete="username"
            placeholder="nome@premierlogistics.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            disabled={carregando}
          />
          <BotaoAuth type="submit" id="botao-enviar-link" carregando={carregando}>
            Enviar link de redefinição
          </BotaoAuth>
        </form>
      )}
    </LayoutAutenticacao>
  );
}
