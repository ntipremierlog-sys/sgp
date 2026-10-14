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

/** Ordem das linhas: sequencia limpa alinhada ao menu, sem CONCILIACAO_SIFAC. */
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
  "AUDITORIA",
  ...RECURSOS_EXCLUSIVOS_ADMIN,
];

/** Grupos simplificados: Premier (Administrador, RH, Preposto, Gerente) e Petrobras (Fiscal, Gestor). */
const GRUPOS_PERFIS: { titulo: string; tipo: "premier" | "petrobras"; perfis: PerfilUsuario[] }[] = [
  {
    titulo: "Premier",
    tipo: "premier",
    perfis: ["PREMIER_ADMIN", "PREMIER_RH", "PREMIER_SUPERVISOR", "PREMIER_GESTOR"],
  },
  {
    titulo: "Petrobras",
    tipo: "petrobras",
    perfis: ["PETROBRAS_FISCAL", "PETROBRAS_GESTOR"],
  },
];

function rotuloPerfil(p: PerfilUsuario): string {
  switch (p) {
    case "PREMIER_ADMIN":
      return "Administrador";
    case "PREMIER_RH":
      return "RH";
    case "PREMIER_SUPERVISOR":
      return "Preposto";
    case "PREMIER_GESTOR":
      return "Gerente";
    case "PETROBRAS_FISCAL":
      return "Fiscal";
    case "PETROBRAS_GESTOR":
      return "Gestor";
    default:
      return NOMES_PERFIS[p] || p;
  }
}

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

/** Grava apenas o que difere da matriz padrão (mudanças futuras continuam herdadas). */
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
      onNotificar("Liberações salvas com sucesso. Em vigor para todos os usuários.");
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
      <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Carregando matriz de permissões...
      </div>
    );
  }

  const renderLinha = (r: Recurso) => {
    const regra = MATRIZ_PERMISSOES.find((x) => x.recurso === r);
    if (!regra) return null;
    const exclusivoAdmin = RECURSOS_EXCLUSIVOS_ADMIN.includes(r);
    const temExport = recursoPossuiExportacao(r);
    return (
      <tr key={r} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
        <th scope="row" className="sticky left-0 z-10 bg-white text-left px-4 py-3 min-w-[260px] max-w-[320px] font-normal shadow-[1px_0_0_0_#f1f5f9]">
          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            {regra.nomeRecurso}
            
          </div>
          <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{regra.descricao}</div>
        </th>
        {PERFIS_CONFIGURAVEIS.map((p) => {
          const k = chave(r, p);
          const cel = rascunho[k] || { ler: false, exportar: false };
          const alterada = cel.ler !== salva[k]?.ler || cel.exportar !== salva[k]?.exportar;
          const personalizada = cel.ler !== padrao[k]?.ler || cel.exportar !== padrao[k]?.exportar;
          const nomeP = rotuloPerfil(p);

          return (
            <td
              key={p}
              className={`px-3 py-2 text-center align-middle border-l border-slate-100 transition-colors ${
                alterada ? "bg-amber-50/70" : ""
              }`}
              title={
                personalizada
                  ? "Regra personalizada (difere do padrão)"
                  : undefined
              }
            >
              <div className="inline-flex items-center justify-center gap-1.5 relative">
                {/* Botão Visualizar */}
                <BotaoLiberacao
                  id={`perm-${r}-${p}-ler`}
                  ativo={cel.ler}
                  onClick={() => alternar(r, p, "ler")}
                  rotulo={`Visualizar ${regra.nomeRecurso} — ${nomeP}`}
                  icone={<Eye className="w-3.5 h-3.5" />}
                />

                {/* Botão Exportar */}
                <BotaoLiberacao
                  id={`perm-${r}-${p}-exportar`}
                  ativo={cel.exportar}
                  onClick={() => alternar(r, p, "exportar")}
                  rotulo={`Exportar ${regra.nomeRecurso} — ${nomeP}`}
                  icone={<Download className="w-3.5 h-3.5" />}
                />

                {/* Marcador de personalização */}
                {personalizada && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-blue-600 ring-2 ring-white" title="Personalizado" />
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
      {/* Barra de ações superior simplificada */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Permissões e Liberação de Módulos
            </h2>
            {alteracoesPendentes > 0 && (
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                {alteracoesPendentes} não salva(s)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Defina o acesso de <strong>Visualização</strong> e <strong>Exportação</strong> para cada perfil da Premier e Petrobras.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-permissoes-restaurar-padrao"
            onClick={() => setRascunho({ ...padrao })}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
            title="Restaura os valores para o padrão do sistema"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </button>
          <button
            id="btn-permissoes-descartar"
            onClick={() => setRascunho({ ...salva })}
            disabled={alteracoesPendentes === 0}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" /> Descartar
          </button>
          <button
            id="btn-permissoes-salvar"
            onClick={salvar}
            disabled={alteracoesPendentes === 0 || salvando}
            className="h-8 inline-flex items-center gap-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {alteracoesPendentes > 0 ? `Salvar (${alteracoesPendentes})` : "Salvar"}
          </button>
        </div>
      </div>

      {/* Legenda compacta e limpa */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 px-1 py-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">
            <Eye className="w-3 h-3" />
          </span>
          Visualizar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">
            <Download className="w-3 h-3" />
          </span>
          Exportar dados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 inline-flex items-center justify-center text-[10px]">
            <Eye className="w-3 h-3" />
          </span>
          Sem acesso
        </span>
        
        {totalPersonalizadas > 0 && (
          <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            {totalPersonalizadas} regra(s) customizada(s)
          </span>
        )}
      </div>

      {/* Matriz minimalista e clean */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            {/* Linha 1: Divisão dos Grupos Premier e Petrobras */}
            <tr className="bg-slate-50/90 border-b border-slate-200">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 bg-slate-50 text-left px-4 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider shadow-[1px_0_0_0_#e2e8f0]"
              >
                Módulo do Sistema
              </th>
              {GRUPOS_PERFIS.map((g) => (
                <th
                  key={g.titulo}
                  colSpan={g.perfis.length}
                  className={`px-3 py-2 text-center text-[11px] font-bold tracking-wider border-l border-slate-200 ${
                    g.tipo === "premier"
                      ? "text-blue-900 bg-blue-50/50"
                      : "text-emerald-900 bg-emerald-50/50"
                  }`}
                >
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      g.tipo === "premier"
                        ? "bg-blue-100/70 text-blue-800"
                        : "bg-emerald-100/70 text-emerald-800"
                    }`}
                  >
                    {g.titulo}
                  </span>
                </th>
              ))}
            </tr>

            {/* Linha 2: Nomes dos Perfis */}
            <tr className="bg-slate-50/70 border-b border-slate-200">
              {GRUPOS_PERFIS.flatMap((g) => g.perfis).map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="px-3 py-2 text-center text-xs font-semibold text-slate-700 border-l border-slate-200 min-w-[100px]"
                >
                  {rotuloPerfil(p)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {ORDEM_MODULOS.map(renderLinha)}

            {/* Linha de separação para dados sensíveis */}
            <tr className="bg-slate-50/80 border-t-2 border-slate-200">
              <td
                colSpan={PERFIS_CONFIGURAVEIS.length + 1}
                className="sticky left-0 px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >
                Proteção e Dados Sensíveis nas Telas
              </td>
            </tr>
            {RECURSOS_DADOS_SENSIVEIS.map(renderLinha)}
          </tbody>
        </table>
      </div>

      {/* Dica informativa concisa */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Premier:</strong> Administrador, RH, Preposto e Gerente. O perfil <strong>Administrador</strong> tem acesso fixo e integral para manutenção do sistema.
          </p>
          <p>
            <strong>Petrobras:</strong> Fiscal e Gestor. A liberação de visualização controla a exibição no menu; ações avançadas como exclusão e criação obedecem à política de governança.
          </p>
        </div>
      </div>
    </div>
  );
}

function BotaoLiberacao({
  id,
  ativo,
  desabilitado = false,
  onClick,
  rotulo,
  icone,
}: {
  id: string;
  ativo: boolean;
  desabilitado?: boolean;
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
      className={`w-7 h-7 inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
        ativo
          ? "bg-blue-600 border-blue-600 text-white shadow-2xs hover:bg-blue-700"
          : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-100"
      } ${desabilitado ? "opacity-40 cursor-not-allowed" : "active:scale-95"}`}
    >
      {icone}
    </button>
  );
}