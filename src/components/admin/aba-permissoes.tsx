"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, Lock, RotateCcw, Save, Undo2, Info, ShieldCheck, Loader2 } from "lucide-react";
import {
  MATRIZ_PERMISSOES,
  NOMES_PERFIS,
  PERFIS_CONFIGURAVEIS,
  RECURSOS_DADOS_SENSIVEIS,
  RECURSOS_EXCLUSIVOS_ADMIN,
  celulaEditavel,
  definirPersonalizacoesPermissao,
  obterLiberacaoEfetiva,
  obterLiberacaoPadrao,
  recursoPossuiExportacao,
  type LiberacaoModulo,
  type PersonalizacoesPermissao,
} from "@/lib/auth/permissoes";
import { EVENTO_PERMISSOES_ATUALIZADAS } from "@/lib/auth/use-permissoes";
import type { PerfilUsuario, Recurso } from "@/lib/auth/tipos";

/** Ordem das linhas: mesma sequência do menu lateral. */
const ORDEM_MODULOS: Recurso[] = [
  "PAINEL",
  "MAPA_OCUPACAO",
  "COBERTURAS",
  "OCORRENCIAS",
  "PROFISSIONAIS",
  "POSTOS",
  "RELATORIOS",
  "APONTAMENTOS",
  "CONFORMIDADE",
  "IMPORTACOES",
  "CONCILIACAO_SIFAC",
  "AUDITORIA",
  ...RECURSOS_EXCLUSIVOS_ADMIN,
];

const GRUPOS_PERFIS: { titulo: string; perfis: PerfilUsuario[] }[] = [
  { titulo: "Premier", perfis: ["PREMIER_ADMIN", "PREMIER_GESTOR", "PREMIER_SUPERVISOR", "PREMIER_RH"] },
  { titulo: "Petrobras", perfis: ["PETROBRAS_FISCAL", "PETROBRAS_GESTOR"] },
  { titulo: "Externo", perfis: ["AUDITOR"] },
];

type Matriz = Record<string, LiberacaoModulo>;
const chave = (r: Recurso, p: PerfilUsuario) => `${r}|${p}`;

function montarMatriz(personalizacoes: PersonalizacoesPermissao): Matriz {
  const m: Matriz = {};
  for (const regra of MATRIZ_PERMISSOES) {
    for (const p of PERFIS_CONFIGURAVEIS) {
      m[chave(regra.recurso, p)] = obterLiberacaoEfetiva(regra.recurso, p, personalizacoes);
    }
  }
  return m;
}

function montarMatrizPadrao(): Matriz {
  const m: Matriz = {};
  for (const regra of MATRIZ_PERMISSOES) {
    for (const p of PERFIS_CONFIGURAVEIS) m[chave(regra.recurso, p)] = obterLiberacaoPadrao(regra.recurso, p);
  }
  return m;
}

/** Grava apenas o que difere da matriz padrão (mudanças futuras no padrão continuam valendo). */
function extrairPersonalizacoes(m: Matriz, padrao: Matriz): PersonalizacoesPermissao {
  const saida: PersonalizacoesPermissao = {};
  for (const regra of MATRIZ_PERMISSOES) {
    for (const p of PERFIS_CONFIGURAVEIS) {
      if (!celulaEditavel(regra.recurso, p)) continue;
      const k = chave(regra.recurso, p);
      if (m[k].ler !== padrao[k].ler || m[k].exportar !== padrao[k].exportar) {
        (saida[regra.recurso] ||= {})[p] = { ...m[k] };
      }
    }
  }
  return saida;
}

interface Props {
  onNotificar: (msg: string, erro?: boolean) => void;
}

export function AbaPermissoes({ onNotificar }: Props) {
  const padrao = useMemo(montarMatrizPadrao, []);
  const [salva, setSalva] = useState<Matriz | null>(null);
  const [rascunho, setRascunho] = useState<Matriz | null>(null);
  const [meta, setMeta] = useState<{ atualizadoEm: string | null; atualizadoPor: string | null }>({
    atualizadoEm: null,
    atualizadoPor: null,
  });
  const [salvando, setSalvando] = useState(false);
  const [erroCarga, setErroCarga] = useState("");

  const carregar = useCallback(async () => {
    setErroCarga("");
    try {
      const res = await fetch("/api/admin/permissoes", { cache: "no-store" });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao carregar liberações.");
      const m = montarMatriz(dados.personalizacoes || {});
      setSalva(m);
      setRascunho(m);
      setMeta({ atualizadoEm: dados.atualizadoEm, atualizadoPor: dados.atualizadoPor });
    } catch (err) {
      setErroCarga(err instanceof Error ? err.message : "Falha ao carregar liberações.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alteracoesPendentes = useMemo(() => {
    if (!salva || !rascunho) return 0;
    return Object.keys(rascunho).filter(
      (k) => rascunho[k].ler !== salva[k].ler || rascunho[k].exportar !== salva[k].exportar
    ).length;
  }, [salva, rascunho]);

  const totalPersonalizadas = useMemo(
    () => (rascunho ? Object.values(extrairPersonalizacoes(rascunho, padrao)).reduce((n, v) => n + Object.keys(v || {}).length, 0) : 0),
    [rascunho, padrao]
  );

  const alternar = (r: Recurso, p: PerfilUsuario, campo: keyof LiberacaoModulo) => {
    if (!celulaEditavel(r, p)) return;
    setRascunho((atual) => {
      if (!atual) return atual;
      const k = chave(r, p);
      const cel = { ...atual[k] };
      if (campo === "ler") {
        cel.ler = !cel.ler;
        if (!cel.ler) cel.exportar = false; // sem visualizar não há exportação
      } else {
        cel.exportar = !cel.exportar;
        if (cel.exportar) cel.ler = true; // exportar implica visualizar
      }
      return { ...atual, [k]: cel };
    });
  };

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    try {
      const personalizacoes = extrairPersonalizacoes(rascunho, padrao);
      const res = await fetch("/api/admin/permissoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizacoes }),
      });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao salvar.");
      const m = montarMatriz(dados.personalizacoes || {});
      setSalva(m);
      setRascunho(m);
      setMeta({ atualizadoEm: dados.atualizadoEm, atualizadoPor: dados.atualizadoPor });
      definirPersonalizacoesPermissao(dados.personalizacoes || {});
      window.dispatchEvent(new Event(EVENTO_PERMISSOES_ATUALIZADAS));
      onNotificar("Liberações salvas. Passam a valer na próxima ação de cada usuário.");
    } catch (err) {
      onNotificar(err instanceof Error ? err.message : "Falha ao salvar liberações.", true);
    } finally {
      setSalvando(false);
    }
  };

  if (erroCarga) {
    return (
      <div className="bg-white p-6 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
        <span>{erroCarga}</span>
        <button onClick={carregar} className="px-3 py-1.5 rounded-lg border border-rose-300 hover:bg-rose-50 font-semibold cursor-pointer">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!rascunho || !salva) {
    return (
      <div className="bg-white p-10 rounded-xl border border-[#E3E6EB] flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando liberações…
      </div>
    );
  }

  const renderLinha = (r: Recurso) => {
    const regra = MATRIZ_PERMISSOES.find((x) => x.recurso === r);
    if (!regra) return null;
    const exclusivoAdmin = RECURSOS_EXCLUSIVOS_ADMIN.includes(r);
    const temExport = recursoPossuiExportacao(r);
    return (
      <tr key={r} className="border-t border-[#EEF0F3] hover:bg-slate-50/60">
        <th scope="row" className="sticky left-0 z-10 bg-white text-left px-4 py-2.5 min-w-[240px] max-w-[300px] font-normal">
          <div className="text-xs font-semibold text-[#1A2230] flex items-center gap-1.5">
            {regra.nomeRecurso}
            {exclusivoAdmin && <Lock className="w-3 h-3 text-slate-400" aria-label="Exclusivo do Administrador" />}
          </div>
          <div className="text-[11px] text-[#5B6474] leading-snug">{regra.descricao}</div>
        </th>
        {PERFIS_CONFIGURAVEIS.map((p) => {
          const k = chave(r, p);
          const cel = rascunho[k];
          const editavel = celulaEditavel(r, p);
          const alterada = cel.ler !== salva[k].ler || cel.exportar !== salva[k].exportar;
          const personalizada = cel.ler !== padrao[k].ler || cel.exportar !== padrao[k].exportar;
          const nomePerfil = NOMES_PERFIS[p];
          return (
            <td
              key={p}
              className={`px-2 py-2 text-center align-middle border-l border-[#EEF0F3] transition-colors ${
                alterada ? "bg-amber-50" : ""
              }`}
              title={
                !editavel
                  ? p === "PREMIER_ADMIN"
                    ? "O Administrador tem acesso integral (não editável)"
                    : "Módulo exclusivo do Administrador"
                  : personalizada
                    ? "Personalizado (difere do padrão do sistema)"
                    : undefined
              }
            >
              <div className="inline-flex items-center gap-1 relative">
                <BotaoLiberacao
                  id={`perm-${r}-${p}-ler`}
                  ativo={cel.ler}
                  desabilitado={!editavel}
                  onClick={() => alternar(r, p, "ler")}
                  rotulo={`Visualizar ${regra.nomeRecurso} — ${nomePerfil}`}
                  icone={<Eye className="w-3.5 h-3.5" />}
                />
                {temExport ? (
                  <BotaoLiberacao
                    id={`perm-${r}-${p}-exportar`}
                    ativo={cel.exportar}
                    desabilitado={!editavel}
                    onClick={() => alternar(r, p, "exportar")}
                    rotulo={`Exportar ${regra.nomeRecurso} — ${nomePerfil}`}
                    icone={<Download className="w-3.5 h-3.5" />}
                  />
                ) : (
                  <span className="w-7 h-7 inline-flex items-center justify-center text-slate-300 text-xs" aria-hidden>
                    —
                  </span>
                )}
                {personalizada && editavel && (
                  <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-[#1F4FD1]" aria-hidden />
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E6EB] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1F4FD1]" />
            Liberação de módulos por perfil
          </h2>
          <p className="text-[11px] text-[#5B6474]">
            Defina quais perfis podem <strong>visualizar</strong> cada módulo e <strong>exportar</strong> seus dados.
            Sem liberação, o módulo some do menu, a tela exibe “Acesso negado” e as APIs recusam o acesso.
          </p>
          <p className="text-[11px] text-[#98A2B3]">
            {meta.atualizadoEm
              ? `Última alteração: ${new Date(meta.atualizadoEm).toLocaleString("pt-BR")} por ${meta.atualizadoPor || "—"}`
              : "Usando a matriz padrão do sistema"}
            {totalPersonalizadas > 0 && ` · ${totalPersonalizadas} célula(s) personalizada(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-permissoes-restaurar-padrao"
            onClick={() => setRascunho({ ...padrao })}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-slate-50 text-[#344054] text-xs font-semibold cursor-pointer"
            title="Volta todas as células para a matriz padrão (ainda precisa salvar)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </button>
          <button
            id="btn-permissoes-descartar"
            onClick={() => setRascunho({ ...salva })}
            disabled={alteracoesPendentes === 0}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-slate-50 text-[#344054] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" /> Descartar
          </button>
          <button
            id="btn-permissoes-salvar"
            onClick={salvar}
            disabled={alteracoesPendentes === 0 || salvando}
            className="h-8 inline-flex items-center gap-1.5 px-4 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {alteracoesPendentes > 0 ? `Salvar ${alteracoesPendentes} alteração(ões)` : "Salvar"}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#5B6474] px-1">
        <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-[#1F4FD1]" /> Visualizar</span>
        <span className="inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5 text-[#1F4FD1]" /> Exportar (Excel/PDF/CSV)</span>
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-slate-400" /> Não editável</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#1F4FD1]" /> Difere do padrão</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" /> Alteração não salva</span>
      </div>

      {/* Matriz */}
      <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-2xs overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#F8F9FB]">
              <th rowSpan={2} className="sticky left-0 z-20 bg-[#F8F9FB] text-left px-4 py-2 text-[11px] font-bold text-[#5B6474] uppercase tracking-wider">
                Módulo
              </th>
              {GRUPOS_PERFIS.map((g) => (
                <th
                  key={g.titulo}
                  colSpan={g.perfis.length}
                  className="px-2 pt-2 pb-1 text-[10px] font-bold text-[#98A2B3] uppercase tracking-wider border-l border-[#EEF0F3]"
                >
                  {g.titulo}
                </th>
              ))}
            </tr>
            <tr className="bg-[#F8F9FB]">
              {GRUPOS_PERFIS.flatMap((g) => g.perfis).map((p) => (
                <th key={p} scope="col" className="px-2 pb-2 text-[11px] font-semibold text-[#344054] border-l border-[#EEF0F3] min-w-[92px]">
                  {NOMES_PERFIS[p].replace(" Premier", "").replace(" Petrobras", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDEM_MODULOS.map(renderLinha)}
            <tr className="bg-[#F8F9FB] border-t border-[#E3E6EB]">
              <td colSpan={PERFIS_CONFIGURAVEIS.length + 1} className="sticky left-0 px-4 py-2 text-[11px] font-bold text-[#5B6474] uppercase tracking-wider">
                Dados sensíveis dentro das telas
              </td>
            </tr>
            {RECURSOS_DADOS_SENSIVEIS.map(renderLinha)}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Gestor Premier</strong> vale também para contas com perfil “Gestor de Contrato”. O perfil{" "}
            <strong>Administrador</strong> mantém acesso integral para evitar perda de acesso ao sistema.
          </p>
          <p>
            <strong>Glosa financeira</strong>: sem liberação, os valores em R$ aparecem como “Restrito” nas exportações e no Painel.{" "}
            <strong>Dados médicos</strong>: sem liberação, motivos de afastamento chegam genéricos pelo Painel. Dentro das demais telas,
            o mascaramento específico do perfil Fiscal Petrobras continua aplicado.
          </p>
          <p>Liberar a visualização não concede criar/editar/excluir — essas ações seguem a regra padrão de cada perfil.</p>
        </div>
      </div>
    </div>
  );
}

function BotaoLiberacao({
  id,
  ativo,
  desabilitado,
  onClick,
  rotulo,
  icone,
}: {
  id: string;
  ativo: boolean;
  desabilitado: boolean;
  onClick: () => void;
  rotulo: string;
  icone: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={onClick}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-md border transition-all ${
        ativo
          ? "bg-[#1F4FD1] border-[#1F4FD1] text-white shadow-2xs"
          : "bg-white border-[#D0D5DD] text-[#C0C6D0] hover:border-[#1F4FD1] hover:text-[#1F4FD1]"
      } ${desabilitado ? "opacity-50 cursor-not-allowed hover:border-current" : "cursor-pointer active:scale-95"}`}
    >
      {icone}
    </button>
  );
}
