"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ShieldCheck, CheckCircle2, Circle, AlertTriangle, Info, Lock, Clock3, FileCheck2 } from "lucide-react";
import { avaliarPoliticaSenha } from "@/lib/auth/politica-senha";

/**
 * Estrutura visual das telas de autenticação: painel da marca (esquerda) + formulário (direita).
 */
export function LayoutAutenticacao({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="min-h-full w-full grid lg:grid-cols-[1.05fr_1fr] bg-[#F6F5F9]">
      {/* Painel da marca */}
      <aside className="auth-painel-marca relative hidden lg:flex flex-col justify-between overflow-hidden px-14 py-12 text-white">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marca/premier-logistics-claro.png"
            alt="Premier Logistics"
            width={260}
            height={140}
            className="w-[260px] h-auto select-none"
            draggable={false}
          />
        </div>

        <div className="relative max-w-md space-y-6 auth-entrada">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C7A0]/40 px-3 py-1 text-[11px] font-medium tracking-wide text-[#E9DDBF]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Contrato Petrobras ICJ 5900.0129796.25.2
          </div>
          <h2 className="text-[34px] leading-[1.1] font-semibold tracking-tight">
            Sistema de Gestão
            <br />
            <span className="text-[#D8C7A0]">de Postos</span>
          </h2>
          <p className="text-sm text-[#C9C3DD] leading-relaxed">
            Ocupação, coberturas, ponto e medição dos postos de serviço em um só lugar, com trilha de auditoria e
            segregação de dados conforme a LGPD.
          </p>
          <ul className="space-y-3 text-[13px] text-[#E4E0F0]">
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-[#D8C7A0]" />
              </span>
              Acesso por perfil, validado no servidor
            </li>
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center">
                <Clock3 className="w-4 h-4 text-[#D8C7A0]" />
              </span>
              Sessão encerrada após 30 min de inatividade
            </li>
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4 text-[#D8C7A0]" />
              </span>
              Todas as ações registradas em auditoria
            </li>
          </ul>
        </div>

        <div className="relative text-[11px] text-[#9F97BF]">
          © {new Date().getFullYear()} Premier Logistics · Uso restrito a pessoas autorizadas
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px] auth-entrada">
          {/* Marca no mobile */}
          <div className="lg:hidden mb-8 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/premier-logistics.png" alt="Premier Logistics" width={180} height={96} className="w-[180px] h-auto" />
          </div>

          <div className="mb-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A7A52] mb-2">SGP · Premier Logistics</div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#1A1534]">{titulo}</h1>
            {subtitulo && <p className="mt-1.5 text-sm text-[#5B6474] leading-relaxed">{subtitulo}</p>}
          </div>

          {children}

          {rodape && <div className="mt-8 text-center text-xs text-[#667085]">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}

/** Campo de texto padrão das telas de autenticação. */
export function CampoAuth({
  id,
  rotulo,
  acessorio,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; rotulo: string; acessorio?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-[#344054]">
          {rotulo}
        </label>
        {acessorio}
      </div>
      <input
        id={id}
        {...props}
        className="w-full h-11 px-3.5 text-sm rounded-xl border border-[#D0D5DD] bg-white text-[#1A2230] placeholder:text-[#98A2B3] outline-none transition-shadow focus:border-[#28185A] focus:ring-4 focus:ring-[#28185A]/10 disabled:opacity-60"
      />
    </div>
  );
}

/** Campo de senha com botão de mostrar/ocultar. */
export function CampoSenha({
  id,
  rotulo,
  acessorio,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; rotulo: string; acessorio?: React.ReactNode }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-[#344054]">
          {rotulo}
        </label>
        {acessorio}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          {...props}
          className="w-full h-11 pl-3.5 pr-11 text-sm rounded-xl border border-[#D0D5DD] bg-white text-[#1A2230] placeholder:text-[#98A2B3] outline-none transition-shadow focus:border-[#28185A] focus:ring-4 focus:ring-[#28185A]/10 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#667085] hover:text-[#28185A]"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          id={`${id}-alternar`}
        >
          {visivel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/** Botão principal das telas de autenticação. */
export function BotaoAuth({
  carregando,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={carregando || props.disabled}
      className="group relative w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#28185A] text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(40,24,90,0.6)] transition-all hover:bg-[#1F1248] hover:shadow-[0_10px_24px_-8px_rgba(40,24,90,0.7)] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {carregando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  );
}

/** Mensagem de retorno (erro / sucesso / informação). */
export function AlertaAuth({ tipo, children }: { tipo: "erro" | "sucesso" | "info"; children: React.ReactNode }) {
  const estilos = {
    erro: { cor: "text-[#B42318] border-[#F4C7C3]", Icone: AlertTriangle },
    sucesso: { cor: "text-[#0F7B4F] border-[#B7E4CC]", Icone: CheckCircle2 },
    info: { cor: "text-[#28185A] border-[#D9D3EA]", Icone: Info },
  }[tipo];
  const Icone = estilos.Icone;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug ${estilos.cor}`}>
      <Icone className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Checklist dinâmico da política de senha. */
export function ChecklistSenha({ senha, email, confirmacao }: { senha: string; email?: string; confirmacao?: string }) {
  const requisitos = avaliarPoliticaSenha(senha, email);
  const atendidos = requisitos.filter((r) => r.atendido).length;
  const forca = senha.length === 0 ? 0 : atendidos / requisitos.length;
  const corBarra = forca < 0.5 ? "bg-[#D92D20]" : forca < 1 ? "bg-[#F79009]" : "bg-[#12B76A]";
  const confere = confirmacao !== undefined && confirmacao.length > 0 && confirmacao === senha;

  return (
    <div className="space-y-2.5">
      <div className="h-1.5 w-full rounded-full bg-[#EAECF0] overflow-hidden">
        <div className={`h-full ${corBarra} transition-all duration-300`} style={{ width: `${Math.round(forca * 100)}%` }} />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
        {requisitos.map((r) => (
          <li key={r.id} className={`flex items-center gap-1.5 text-[12px] ${r.atendido ? "text-[#0F7B4F]" : "text-[#667085]"}`}>
            {r.atendido ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
            {r.rotulo}
          </li>
        ))}
        {confirmacao !== undefined && (
          <li className={`flex items-center gap-1.5 text-[12px] ${confere ? "text-[#0F7B4F]" : "text-[#667085]"}`}>
            {confere ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
            Confirmação igual à senha
          </li>
        )}
      </ul>
    </div>
  );
}

export function senhaAtendePolitica(senha: string, email?: string): boolean {
  return avaliarPoliticaSenha(senha, email).every((r) => r.atendido);
}
