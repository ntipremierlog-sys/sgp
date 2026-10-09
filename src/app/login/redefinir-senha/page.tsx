"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  LayoutAutenticacao,
  CampoSenha,
  BotaoAuth,
  AlertaAuth,
  ChecklistSenha,
  senhaAtendePolitica,
} from "@/components/auth/layout-autenticacao";

function FormularioRedefinir() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [estadoToken, setEstadoToken] = useState<"validando" | "valido" | "invalido">("validando");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setEstadoToken("invalido");
      return;
    }
    fetch(`/api/auth/senha?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.valido) {
          setEmail(d.email);
          setEstadoToken("valido");
        } else setEstadoToken("invalido");
      })
      .catch(() => setEstadoToken("invalido"));
  }, [token]);

  const podeEnviar = senhaAtendePolitica(senha, email) && senha === confirmacao;

  const redefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    setErros([]);
    try {
      const res = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "redefinir", token, novaSenha: senha }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        setErros(data.erros || [data.erro || "Não foi possível redefinir a senha."]);
        setCarregando(false);
        return;
      }
      router.replace("/login?senha=redefinida");
    } catch {
      setErros(["Falha de comunicação com o servidor."]);
      setCarregando(false);
    }
  };

  return (
    <LayoutAutenticacao
      titulo="Redefinir senha"
      subtitulo={email ? <>Defina uma nova senha para <span className="font-medium text-[#1A2230]">{email}</span>.</> : "Defina uma nova senha de acesso."}
      rodape={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-[#28185A] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o login
        </Link>
      }
    >
      {estadoToken === "validando" && <div className="h-40 rounded-xl bg-white border border-[#EAECF0] animate-pulse" />}

      {estadoToken === "invalido" && (
        <div className="space-y-4">
          <AlertaAuth tipo="erro">Este link de redefinição é inválido, já foi usado ou expirou.</AlertaAuth>
          <Link
            href="/login/esqueci-senha"
            className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-[#28185A] text-sm font-semibold text-[#28185A] hover:bg-[#28185A]/5"
          >
            Solicitar novo link
          </Link>
        </div>
      )}

      {estadoToken === "valido" && (
        <form onSubmit={redefinir} className="space-y-4" noValidate>
          {erros.length > 0 && (
            <AlertaAuth tipo="erro">
              <ul className="list-disc pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
            </AlertaAuth>
          )}
          {/* Campo oculto de usuário: ajuda gerenciadores de senha a associar a conta */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <CampoSenha id="redefinir-senha" rotulo="Nova senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
          <CampoSenha id="redefinir-confirmacao" rotulo="Confirmar nova senha" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          <ChecklistSenha senha={senha} email={email} confirmacao={confirmacao} />
          <BotaoAuth type="submit" id="botao-redefinir" carregando={carregando} disabled={!podeEnviar}>
            Salvar nova senha
          </BotaoAuth>
        </form>
      )}
    </LayoutAutenticacao>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <FormularioRedefinir />
    </Suspense>
  );
}
