"use client";

/**
 * /alertas?tipo=<slug> — lista filtrada de cada alerta contratual do Painel.
 * Destino dos chips de "Alertas contratuais". Somente leitura; ações levam ao
 * cadastro de origem (ausências, mapa de cobertura, painel).
 */

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, X, ExternalLink, Inbox } from "lucide-react";
import {
  AlertaContratual,
  ItemAlerta,
  TipoAlertaContratual,
  TIPOS_ALERTA_ORDENADOS,
  ehTipoAlertaValido,
  formatarDataBR,
} from "@/lib/servicos/alertas-contratuais";
import {
  useAlertasContratuais,
  ICONE_ALERTA,
  ESTILO_COR,
  rotuloSemNumero,
} from "@/components/painel/alertas-gerenciais";

const normalizar = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const SITUACAO: Record<ItemAlerta["situacao"], { rotulo: string; classe: string }> = {
  VENCIDO: { rotulo: "Vencido", classe: "bg-rose-50 text-rose-700 border-rose-200" },
  A_VENCER: { rotulo: "A vencer", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDENTE: { rotulo: "Pendente", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  INFORMATIVO: { rotulo: "Informativo", classe: "bg-violet-50 text-violet-700 border-violet-200" },
};

/** Ação de origem para cada tipo de alerta. */
function linkAcao(tipo: TipoAlertaContratual, item: ItemAlerta): { href: string; rotulo: string } | null {
  switch (tipo) {
    case "ferias-sem-consulta":
      return { href: `/ocorrencias?editar=${encodeURIComponent(item.id)}`, rotulo: "Registrar consulta" };
    case "substituicao-vencendo":
      return { href: `/ocorrencias?editar=${encodeURIComponent(item.id)}`, rotulo: "Informar substituto" };
    case "escala-sem-fase":
      return { href: "/mapa-ocupacao", rotulo: "Programar escala" };
    case "admissoes-a-alocar":
      return { href: "/importacoes", rotulo: "Ver importação" };
    case "mobilizacao":
    case "preposto-acima-limite":
      return { href: "/painel", rotulo: "Ver no Painel" };
    default:
      return null;
  }
}

function textoPrazo(item: ItemAlerta): string {
  if (item.diasParaPrazo === null || item.diasParaPrazo === undefined || !item.prazo) return "—";
  const unidade = item.unidadePrazo === "uteis" ? "dias úteis" : "dias";
  const n = Math.abs(item.diasParaPrazo);
  if (item.diasParaPrazo < 0) return `vencido há ${n} ${unidade}`;
  if (item.diasParaPrazo === 0) return "vence hoje";
  return `em ${n} ${unidade}`;
}

function ConteudoAlertas() {
  const router = useRouter();
  const params = useSearchParams();
  const { alertas } = useAlertasContratuais();
  const [busca, setBusca] = useState("");

  const parametro = params.get("tipo");
  const porTipo = useMemo(
    () => Object.fromEntries(alertas.map((a) => [a.tipo, a])) as Record<TipoAlertaContratual, AlertaContratual>,
    [alertas]
  );

  // Sem parâmetro válido: abre o primeiro alerta com itens
  const tipoAtivo: TipoAlertaContratual = ehTipoAlertaValido(parametro)
    ? parametro
    : TIPOS_ALERTA_ORDENADOS.find((t) => (porTipo[t]?.quantidade ?? 0) > 0) || TIPOS_ALERTA_ORDENADOS[0];

  const alerta = porTipo[tipoAtivo];
  const termo = normalizar(busca.trim());
  const itens = useMemo(() => {
    if (!alerta) return [];
    if (!termo) return alerta.itens;
    return alerta.itens.filter((i) =>
      [i.titulo, i.unidade, i.detalhe].some((v) => normalizar(v).includes(termo))
    );
  }, [alerta, termo]);

  const mostrarPrazo = alerta?.itens.some((i) => i.prazo);
  const estilo = alerta ? ESTILO_COR[alerta.cor] : ESTILO_COR.AMBAR;
  const Icone = ICONE_ALERTA[tipoAtivo];

  return (
    <div className="w-full max-w-[1440px] space-y-5 pb-16 font-sans text-[#1A2230]">
      <header className="flex flex-col gap-2 border-b border-[#E5E7EB] pb-4">
        <Link
          href="/painel"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4FD1] hover:underline w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Painel Executivo
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Alertas contratuais</h1>
        <p className="text-xs text-[#6B7280]">
          Pendências calculadas pelas regras do contrato. Clique em um alerta para filtrar a lista.
        </p>
      </header>

      {/* Abas dos 7 alertas */}
      <nav aria-label="Tipos de alerta" className="flex flex-wrap gap-2">
        {TIPOS_ALERTA_ORDENADOS.map((t) => {
          const a = porTipo[t];
          const ativo = t === tipoAtivo;
          const qtd = a?.quantidade ?? 0;
          const est = a ? ESTILO_COR[a.cor] : ESTILO_COR.AMBAR;
          const I = ICONE_ALERTA[t];
          return (
            <button
              key={t}
              id={`aba-alerta-${t}`}
              type="button"
              onClick={() => {
                setBusca("");
                router.replace(`/alertas?tipo=${t}`, { scroll: false });
              }}
              aria-pressed={ativo}
              className={`inline-flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1 text-xs font-semibold transition-all ${
                ativo
                  ? "bg-[#0F1E36] text-white border-[#0F1E36] shadow-sm"
                  : qtd > 0
                  ? `${est.chip} text-[#1A2230]`
                  : "bg-white border-[#E5E7EB] text-[#9CA3AF] hover:border-slate-300"
              }`}
            >
              <span
                className={`min-w-[1.5rem] h-5 px-1.5 rounded-full inline-flex items-center justify-center font-mono tabular-nums text-[11px] font-bold ${
                  ativo ? "bg-white/20 text-white" : qtd > 0 ? est.numero : "bg-slate-100 text-slate-400"
                }`}
              >
                {qtd}
              </span>
              <I className="w-3.5 h-3.5" />
              {a ? rotuloSemNumero(a) : t}
            </button>
          );
        })}
      </nav>

      {alerta && (
        <section
          aria-labelledby="titulo-lista-alerta"
          className="rounded-xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden"
        >
          {/* Cabeçalho do alerta ativo */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-[#E5E7EB]">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`mt-0.5 rounded-lg p-2 ${estilo.chip.split(" ").slice(0, 2).join(" ")} border`}>
                <Icone className={`w-4 h-4 ${estilo.icone}`} />
              </span>
              <div className="min-w-0">
                <h2 id="titulo-lista-alerta" className="text-sm font-bold text-[#111827]">
                  {alerta.rotulo}
                  <span className="ml-2 text-[10px] font-mono font-semibold text-[#6B7280] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                    {alerta.referencia}
                  </span>
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">{alerta.descricao}</p>
              </div>
            </div>

            <div className="relative w-full md:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="busca-alerta"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por nome, chapa ou imóvel"
                className="w-full h-9 pl-8 pr-8 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar filtro"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {itens.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-2 text-xs text-[#6B7280]">
              <Inbox className="w-6 h-6 text-slate-300" />
              {alerta.quantidade === 0 ? "Nenhuma pendência neste alerta." : "Nenhum item corresponde ao filtro."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-[#6B7280]">
                  <tr>
                    <th scope="col" className="text-left font-bold py-2.5 px-4">Item</th>
                    <th scope="col" className="text-left font-bold py-2.5 px-4">Imóvel / posto</th>
                    <th scope="col" className="text-left font-bold py-2.5 px-4">Detalhe</th>
                    {mostrarPrazo && <th scope="col" className="text-left font-bold py-2.5 px-4">Prazo</th>}
                    <th scope="col" className="text-center font-bold py-2.5 px-4">Situação</th>
                    <th scope="col" className="py-2.5 px-4"><span className="sr-only">Ação</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {itens.map((item) => {
                    const sit = SITUACAO[item.situacao];
                    const acao = linkAcao(tipoAtivo, item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-[#111827]">{item.titulo}</td>
                        <td className="py-2.5 px-4 text-[#374151] max-w-[260px]">{item.unidade || "—"}</td>
                        <td className="py-2.5 px-4 text-[#4B5563] max-w-[420px]">{item.detalhe || "—"}</td>
                        {mostrarPrazo && (
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-mono tabular-nums text-[#111827]">{formatarDataBR(item.prazo)}</span>
                            <span
                              className={`block text-[10px] ${
                                (item.diasParaPrazo ?? 0) < 0 ? "text-rose-600 font-semibold" : "text-[#6B7280]"
                              }`}
                            >
                              {textoPrazo(item)}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${sit.classe}`}>
                            {sit.rotulo}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {acao && (
                            <Link
                              href={acao.href}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F4FD1] hover:underline"
                            >
                              {acao.rotulo}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-[#E5E7EB] text-[11px] text-[#6B7280] bg-slate-50/60">
            Mostrando <strong className="font-mono text-[#111827]">{itens.length}</strong> de{" "}
            <strong className="font-mono text-[#111827]">{alerta.quantidade}</strong>
            {alerta.vencidos > 0 && (
              <span className="ml-2 text-rose-600 font-semibold">· {alerta.vencidos} com prazo vencido</span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function AlertasPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-slate-500">Carregando alertas…</div>}>
      <ConteudoAlertas />
    </Suspense>
  );
}
