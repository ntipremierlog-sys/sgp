"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Flame,
  AlertTriangle,
  ChevronsUpDown,
  ChevronsDownUp,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  obterDadosPainelContratual,
  IMOVEIS_REV04,
  obterCidadeUfImovel,
  StatusImovel,
  MetricasImovel,
  obterFeristasREV04,
} from "@/lib/dados/painel-calculo";
import { POSTOS_REV04, POSICOES_REV04 } from "@/lib/dados/estrutura-postos";
import { ArvoreImovel } from "@/components/painel/arvore-imovel";
import { AlertasGerenciais } from "@/components/painel/alertas-gerenciais";

interface ImovelItemEnriquecido extends MetricasImovel {
  id: string;
  cidade: string;
  uf: string;
  cidadeUf: string;
  status: StatusImovel;
  preposto?: string | null;
  gerencia?: string | null;
  // Metadados para busca única rápida
  itensPPU: string[];
  postosIds: string[];
  colaboradoresNomes: string[];
  chapas: string[];
}

// Função auxiliar de normalização de texto para busca (sem acentos / maiúsculas)
const normalizar = (texto: string) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** O termo foi encontrado DENTRO da árvore (posto, nome ou chapa de titular/ferista)? */
function buscaEncontradaNaArvore(im: ImovelItemEnriquecido, termo: string): boolean {
  if (!termo) return false;
  return (
    im.postosIds.some((v) => normalizar(v).includes(termo)) ||
    im.colaboradoresNomes.some((v) => normalizar(v).includes(termo)) ||
    im.chapas.some((v) => normalizar(v).includes(termo))
  );
}

type ColunaOrdenacao =
  | "imovel"
  | "postos_mobilizados"
  | "postos_ocupados"
  | "vagas_em_aberto"
  | "taxa_ocupacao"
  | "status";

type DirecaoOrdenacao = "asc" | "desc";

function PainelExecutivoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const competenciaParam = searchParams.get("competencia") || "2026-09";
  const [competencia, setCompetencia] = useState<string>(competenciaParam);
  const [busca, setBusca] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [somenteComVagas, setSomenteComVagas] = useState<boolean>(false);
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>("imovel");
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>("asc");
  const [dadosVersao, setDadosVersao] = useState<number>(0);

  // Controle de imóveis expandidos na árvore
  const [imoveisExpandidos, setImoveisExpandidos] = useState<Set<string>>(new Set());
  // Modo explícito "Expandir todos" (abre também todos os Itens PPU de cada árvore)
  const [modoExpandirTodos, setModoExpandirTodos] = useState<boolean>(false);

  useEffect(() => {
    if (competenciaParam) setCompetencia(competenciaParam);
  }, [competenciaParam]);

  useEffect(() => {
    const handler = () => setDadosVersao((v) => v + 1);
    window.addEventListener("sgp-dados-atualizados", handler);
    return () => window.removeEventListener("sgp-dados-atualizados", handler);
  }, []);

  const handleMudarCompetencia = (novaComp: string) => {
    setCompetencia(novaComp);
    router.replace(`/painel?competencia=${novaComp}`);
  };

  // Mês e Ano formatados para o título
  const mesAnoFormatado = useMemo(() => {
    const [ano, mes] = competencia.split("-");
    const meses: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
      "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };
    return `${meses[mes] || mes}/${ano || "2026"}`;
  }, [competencia]);

  // Dados consolidados do contrato obtidos via funções da Etapa 1
  const dadosContratuais = useMemo(() => {
    return obterDadosPainelContratual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosVersao, competencia]);

  // Contagem de postos com periculosidade na base REV04
  const postosComPericulosidade = useMemo(() => {
    return (POSTOS_REV04 as any[]).filter(
      (p) => String(p.periculosidade || "").trim().toUpperCase() === "SIM"
    ).length;
  }, []);

  // Mapeamento enriquecido dos imóveis com dados cadastrais e índice de busca
  const listaImoveisEnriquecida = useMemo<ImovelItemEnriquecido[]>(() => {
    // Mapa de postos por imóvel
    const postosPorImovel = new Map<string, any[]>();
    for (const posto of POSTOS_REV04 as any[]) {
      const imovelNome = posto.imovel || posto.unidade || "";
      if (!postosPorImovel.has(imovelNome)) postosPorImovel.set(imovelNome, []);
      postosPorImovel.get(imovelNome)!.push(posto);
    }

    // Mapa de posições por posto
    const posicoesPorPosto = new Map<string, any[]>();
    for (const pos of POSICOES_REV04 as any[]) {
      const pId = pos.posto_id || pos.postoIdSGP || "";
      if (!posicoesPorPosto.has(pId)) posicoesPorPosto.set(pId, []);
      posicoesPorPosto.get(pId)!.push(pos);
    }

    // Mapa de feristas de cobertura por posto (entram no índice de busca: nome e chapa)
    const feristasPorPosto = new Map<string, Array<{ nome: string; chapa: string }>>();
    for (const f of obterFeristasREV04()) {
      if (!feristasPorPosto.has(f.posto_id)) feristasPorPosto.set(f.posto_id, []);
      feristasPorPosto.get(f.posto_id)!.push({ nome: f.nome, chapa: f.chapa });
    }

    // Mapa cadastral de imóveis
    const mapaCadastral = new Map<string, any>();
    for (const im of IMOVEIS_REV04) {
      mapaCadastral.set(im.nome.toUpperCase(), im);
      if (im.id) mapaCadastral.set(im.id.toUpperCase(), im);
    }

    return dadosContratuais.lista_imoveis.map((metrica) => {
      const cad = mapaCadastral.get(metrica.imovel.toUpperCase()) || {};
      const cidade = cad.cidade || "";
      const uf = cad.uf || "";
      const cidadeUf = obterCidadeUfImovel(metrica.imovel);
      const status: StatusImovel = cad.status_imovel || "ATIVO";
      const id = cad.id || metrica.imovel;
      const preposto = cad.preposto || null;
      const gerencia = cad.gerencia || null;

      // Metadados agregados para busca rápida
      const postosDoImovel = postosPorImovel.get(metrica.imovel) || [];
      const itensPPU = new Set<string>();
      const postosIds = new Set<string>();
      const colaboradoresNomes = new Set<string>();
      const chapas = new Set<string>();

      for (const p of postosDoImovel) {
        if (p.item_ppu || p.itemPPU) itensPPU.add(String(p.item_ppu || p.itemPPU).trim());
        const pId = p.posto_id_sgp || p.postoIdSGP || p.id || "";
        if (pId) postosIds.add(String(pId).trim());

        const posicoes = posicoesPorPosto.get(pId) || [];
        for (const pos of posicoes) {
          const nome = pos.nome_titular || pos.titularReferencia;
          const chapa = pos.chapa_titular || pos.chapaTitular;
          if (nome && nome !== "-" && nome !== "SEM TITULAR") {
            colaboradoresNomes.add(String(nome).trim());
          }
          if (chapa && chapa !== "-" && chapa !== "SEM TITULAR") {
            chapas.add(String(chapa).trim());
          }
        }

        for (const fer of feristasPorPosto.get(pId) || []) {
          if (fer.nome) colaboradoresNomes.add(String(fer.nome).trim());
          if (fer.chapa) chapas.add(String(fer.chapa).trim());
        }
      }

      return {
        ...metrica,
        id,
        cidade,
        uf,
        cidadeUf,
        status,
        preposto,
        gerencia,
        itensPPU: Array.from(itensPPU),
        postosIds: Array.from(postosIds),
        colaboradoresNomes: Array.from(colaboradoresNomes),
        chapas: Array.from(chapas),
      };
    });
  }, [dadosContratuais]);

  // Contagens para os Chips de Status
  const contagensStatus = useMemo(() => {
    let ativos = 0;
    let emMobilizacao = 0;
    let inativos = 0;
    let desmobilizados = 0;
    let comVagas = 0;

    for (const im of listaImoveisEnriquecida) {
      if (im.status === "ATIVO") ativos++;
      else if (im.status === "EM_MOBILIZACAO") emMobilizacao++;
      else if (im.status === "INATIVO") inativos++;
      else if (im.status === "DESMOBILIZADO") desmobilizados++;

      if (im.vagas_em_aberto > 0) comVagas++;
    }

    return {
      total: listaImoveisEnriquecida.length,
      ativos,
      emMobilizacao,
      inativos,
      desmobilizados,
      comVagas,
    };
  }, [listaImoveisEnriquecida]);

  // Filtragem multi-campo da Busca Única e dos Chips
  const imoveisFiltrados = useMemo(() => {
    let resultado = listaImoveisEnriquecida;

    // Filtro por Status
    if (filtroStatus !== "TODOS") {
      resultado = resultado.filter((im) => im.status === filtroStatus);
    }

    // Filtro "Só com vagas"
    if (somenteComVagas) {
      resultado = resultado.filter((im) => im.vagas_em_aberto > 0);
    }

    // Busca única: imóvel, cidade, item PPU, ID do posto, nome ou chapa
    const termo = normalizar(busca.trim());
    if (termo) {
      resultado = resultado.filter((im) => {
        // Nome do imóvel ou ID
        if (normalizar(im.imovel).includes(termo)) return true;
        if (normalizar(im.id).includes(termo)) return true;

        // Cidade / UF
        if (normalizar(im.cidade).includes(termo)) return true;
        if (normalizar(im.uf).includes(termo)) return true;
        if (normalizar(im.cidadeUf).includes(termo)) return true;

        // Itens PPU
        if (im.itensPPU.some((item) => normalizar(item).includes(termo))) return true;

        // IDs dos postos
        if (im.postosIds.some((pId) => normalizar(pId).includes(termo))) return true;

        // Colaboradores (nome do titular)
        if (im.colaboradoresNomes.some((nome) => normalizar(nome).includes(termo))) return true;

        // Chapas
        if (im.chapas.some((chapa) => normalizar(chapa).includes(termo))) return true;

        // Preposto ou gerência
        if (im.preposto && normalizar(im.preposto).includes(termo)) return true;
        if (im.gerencia && normalizar(im.gerencia).includes(termo)) return true;

        return false;
      });
    }

    // Ordenação dinâmica ao clicar no cabeçalho
    return [...resultado].sort((a, b) => {
      let valorA: any;
      let valorB: any;

      switch (colunaOrdenacao) {
        case "imovel":
          valorA = a.imovel;
          valorB = b.imovel;
          return direcaoOrdenacao === "asc"
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA);

        case "postos_mobilizados":
          valorA = a.postos_mobilizados;
          valorB = b.postos_mobilizados;
          break;

        case "postos_ocupados":
          valorA = a.postos_ocupados;
          valorB = b.postos_ocupados;
          break;

        case "vagas_em_aberto":
          valorA = a.vagas_em_aberto;
          valorB = b.vagas_em_aberto;
          break;

        case "taxa_ocupacao":
          valorA = a.taxa_ocupacao;
          valorB = b.taxa_ocupacao;
          break;

        case "status":
          valorA = a.status;
          valorB = b.status;
          return direcaoOrdenacao === "asc"
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA);

        default:
          return 0;
      }

      if (valorA < valorB) return direcaoOrdenacao === "asc" ? -1 : 1;
      if (valorA > valorB) return direcaoOrdenacao === "asc" ? 1 : -1;
      return a.imovel.localeCompare(b.imovel);
    });
  }, [
    listaImoveisEnriquecida,
    filtroStatus,
    somenteComVagas,
    busca,
    colunaOrdenacao,
    direcaoOrdenacao,
  ]);

  // Se a busca encontrar um termo DENTRO da árvore (nome, chapa, posto), abre automaticamente
  // somente os imóveis correspondentes — a árvore já mostra o Item PPU encontrado.
  useEffect(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return;
    setModoExpandirTodos(false);
    const novosExpandidos = new Set<string>();
    for (const im of imoveisFiltrados) {
      if (buscaEncontradaNaArvore(im, termo)) novosExpandidos.add(im.imovel);
    }
    setImoveisExpandidos(novosExpandidos);
  }, [busca, imoveisFiltrados]);

  // Alternar ordenação de coluna
  const handleOrdenar = (coluna: ColunaOrdenacao) => {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setColunaOrdenacao(coluna);
      setDirecaoOrdenacao(coluna === "imovel" || coluna === "status" ? "asc" : "desc");
    }
  };

  // Alternar expansão de um imóvel na tabela
  const toggleImovelExpandido = useCallback((imovelNome: string) => {
    setImoveisExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(imovelNome)) {
        next.delete(imovelNome);
      } else {
        next.add(imovelNome);
      }
      return next;
    });
  }, []);

  // Botão "Expandir todos / Recolher todos"
  const todosEstaoExpandidos = useMemo(() => {
    if (imoveisFiltrados.length === 0) return false;
    return imoveisFiltrados.every((im) => imoveisExpandidos.has(im.imovel));
  }, [imoveisFiltrados, imoveisExpandidos]);

  const toggleExpandirTodos = () => {
    if (todosEstaoExpandidos) {
      setModoExpandirTodos(false);
      setImoveisExpandidos(new Set());
    } else {
      const todosNomes = new Set(imoveisFiltrados.map((im) => im.imovel));
      setModoExpandirTodos(true);
      setImoveisExpandidos(todosNomes);
    }
  };

  // Totais consolidados oficiais
  const totais = dadosContratuais.totais;
  const taxaFormatada = (totais.taxa_ocupacao * 100).toFixed(1).replace(".", ",");

  // Barra de ocupação dos totais (única cor de destaque do bloco de indicadores)
  const corBarraTotal =
    totais.taxa_ocupacao >= 1.0
      ? "bg-emerald-500"
      : totais.taxa_ocupacao >= 0.85
      ? "bg-amber-500"
      : "bg-rose-500";

  // Opções do filtro segmentado de status (só exibe status existentes)
  const opcoesStatus: Array<{ valor: string; rotulo: string; qtd: number }> = [
    { valor: "TODOS", rotulo: "Todos", qtd: contagensStatus.total },
    { valor: "ATIVO", rotulo: "Ativos", qtd: contagensStatus.ativos },
    { valor: "EM_MOBILIZACAO", rotulo: "Em mobilização", qtd: contagensStatus.emMobilizacao },
    { valor: "INATIVO", rotulo: "Inativos", qtd: contagensStatus.inativos },
    { valor: "DESMOBILIZADO", rotulo: "Desmobilizados", qtd: contagensStatus.desmobilizados },
  ].filter((o) => o.valor === "TODOS" || o.qtd > 0);

  // Cabeçalho ordenável reutilizável
  const CabecalhoOrdenavel = ({
    coluna,
    rotulo,
    alinhar = "left",
  }: {
    coluna: ColunaOrdenacao;
    rotulo: string;
    alinhar?: "left" | "right" | "center";
  }) => {
    const ativa = colunaOrdenacao === coluna;
    return (
      <th
        scope="col"
        className={`py-2.5 px-4 font-medium ${
          alinhar === "right" ? "text-right" : alinhar === "center" ? "text-center" : ""
        }`}
        aria-sort={ativa ? (direcaoOrdenacao === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => handleOrdenar(coluna)}
          className={`group inline-flex items-center gap-1 transition-colors hover:text-slate-900 ${
            ativa ? "text-slate-900" : ""
          }`}
        >
          <span>{rotulo}</span>
          {ativa ? (
            direcaoOrdenacao === "asc" ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="w-full max-w-[1440px] space-y-5 pb-16 font-sans text-slate-800 overflow-x-hidden">
      {/* ——— 1. TOPO: TÍTULO E SELETOR DE COMPETÊNCIA ——— */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Painel executivo</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Competência {mesAnoFormatado} · ocupação e gestão contratual por imóvel
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="select-competencia" className="sr-only">
            Selecionar competência
          </label>
          <select
            id="select-competencia"
            value={competencia}
            onChange={(e) => handleMudarCompetencia(e.target.value)}
            className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
          >
            <option value="2026-09">Set/2026 (vigente)</option>
            <option value="2026-08">Ago/2026 (encerrada)</option>
            <option value="2026-07">Jul/2026 (encerrada)</option>
          </select>
        </div>
      </header>

      {/* ——— 2. INDICADORES: faixa única, números neutros ——— */}
      <section
        aria-label="Indicadores contratuais principais"
        className="grid grid-cols-2 lg:grid-cols-5 rounded-xl border border-slate-200 bg-white shadow-xs divide-y lg:divide-y-0 lg:divide-x divide-slate-100"
      >
        {/* a) Imóveis ativos */}
        <div className="p-4">
          <div className="text-xs text-slate-500">Imóveis ativos</div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums text-slate-900">
              {contagensStatus.ativos}
            </span>
            <span className="text-sm text-slate-400">/ {contagensStatus.total}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 inline-flex items-center gap-1">
            <Flame className="w-3 h-3" />
            {postosComPericulosidade} postos com periculosidade
          </div>
        </div>

        {/* b) Postos mobilizados */}
        <div className="p-4">
          <div className="text-xs text-slate-500">Postos mobilizados</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
            {totais.postos_mobilizados}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Unidades contratadas na PPU</div>
        </div>

        {/* c) Postos ocupados */}
        <div className="p-4">
          <div className="text-xs text-slate-500">Postos ocupados</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
            {totais.postos_ocupados}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            de {totais.postos_mobilizados} mobilizados
          </div>
        </div>

        {/* d) Vagas em aberto (único número com cor, e só quando > 0) */}
        <div className="p-4">
          <div className="text-xs text-slate-500">Vagas em aberto</div>
          <div
            className={`mt-1.5 text-2xl font-semibold tabular-nums ${
              totais.vagas_em_aberto > 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {totais.vagas_em_aberto}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totais.vagas_em_aberto > 0 ? `em ${totais.postos_com_vaga} postos` : "Nenhuma pendência"}
          </div>
        </div>

        {/* e) Taxa de ocupação (% + barra) */}
        <div className="p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-500">Taxa de ocupação</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
            {taxaFormatada}%
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${corBarraTotal}`}
              style={{ width: `${Math.min(100, Math.max(0, totais.taxa_ocupacao * 100))}%` }}
            />
          </div>
        </div>
      </section>

      {/* ——— 3. ALERTAS CONTRATUAIS (chips neutros clicáveis) ——— */}
      <AlertasGerenciais />

      {/* ——— 4. TABELA COM TOOLBAR INTEGRADA ——— */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-100 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900">Imóveis</h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {imoveisFiltrados.length} de {contagensStatus.total}
            </span>

            {/* Segmentado de status */}
            <div
              role="group"
              aria-label="Filtrar por status"
              className="inline-flex items-center rounded-lg bg-slate-100 p-0.5"
            >
              {opcoesStatus.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setFiltroStatus(o.valor)}
                  aria-pressed={filtroStatus === o.valor}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    filtroStatus === o.valor
                      ? "bg-white text-slate-900 font-medium shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {o.rotulo}
                  <span className="ml-1 tabular-nums text-slate-400">{o.qtd}</span>
                </button>
              ))}
            </div>

            {/* Toggle "Com vagas" */}
            <button
              type="button"
              onClick={() => setSomenteComVagas((prev) => !prev)}
              aria-pressed={somenteComVagas}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-all inline-flex items-center gap-1.5 ${
                somenteComVagas
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${somenteComVagas ? "bg-white" : "bg-rose-500"}`} />
              Com vagas
              <span className={`tabular-nums ${somenteComVagas ? "text-slate-300" : "text-slate-400"}`}>
                {contagensStatus.comVagas}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Busca única */}
            <div className="relative flex-1 lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-busca-painel"
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Imóvel, cidade, item PPU, posto, nome ou chapa"
                className="w-full h-8 pl-9 pr-8 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Expandir todos / Recolher todos */}
            <button
              type="button"
              onClick={toggleExpandirTodos}
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 inline-flex items-center justify-center transition-colors"
              title={todosEstaoExpandidos ? "Recolher todos" : "Expandir todos"}
              aria-label={todosEstaoExpandidos ? "Recolher todos" : "Expandir todos"}
            >
              {todosEstaoExpandidos ? (
                <ChevronsDownUp className="w-4 h-4" />
              ) : (
                <ChevronsUpDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Bloco com rolagem horizontal interna e isolada */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="border-b border-slate-100 text-slate-500 text-xs">
              <tr>
                <CabecalhoOrdenavel coluna="imovel" rotulo="Imóvel" />
                <CabecalhoOrdenavel coluna="postos_mobilizados" rotulo="Mobilizados" alinhar="right" />
                <CabecalhoOrdenavel coluna="postos_ocupados" rotulo="Ocupados" alinhar="right" />
                <CabecalhoOrdenavel coluna="vagas_em_aberto" rotulo="Vagas" alinhar="right" />
                <CabecalhoOrdenavel coluna="taxa_ocupacao" rotulo="Ocupação" />
                <CabecalhoOrdenavel coluna="status" rotulo="Status" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {imoveisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">Nenhum imóvel encontrado</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Ajuste a busca ou os filtros de status.
                    </p>
                  </td>
                </tr>
              ) : (
                imoveisFiltrados.map((im) => {
                  const taxaOcupacaoVal = im.taxa_ocupacao;
                  const taxaPorcento = taxaOcupacaoVal * 100;
                  const taxaFormatadaLinha = `${taxaPorcento.toFixed(1).replace(".", ",")}%`;
                  const estaExpandido = imoveisExpandidos.has(im.imovel);

                  // Barra: neutra em 100%; âmbar 85–99%; vermelho < 85%
                  const corBarra =
                    taxaOcupacaoVal >= 1.0
                      ? "bg-slate-300"
                      : taxaOcupacaoVal >= 0.85
                      ? "bg-amber-500"
                      : "bg-rose-500";

                  // Status: ponto discreto + texto cinza
                  let statusLabel = "Ativo";
                  let statusDotClass = "bg-emerald-500";
                  if (im.status === "EM_MOBILIZACAO") {
                    statusLabel = "Em mobilização";
                    statusDotClass = "bg-amber-500";
                  } else if (im.status === "INATIVO") {
                    statusLabel = "Inativo";
                    statusDotClass = "bg-slate-300";
                  } else if (im.status === "DESMOBILIZADO") {
                    statusLabel = "Desmobilizado";
                    statusDotClass = "bg-rose-500";
                  }

                  return (
                    <React.Fragment key={im.id || im.imovel}>
                      <tr
                        tabIndex={0}
                        role="button"
                        aria-expanded={estaExpandido}
                        aria-label={`Expandir detalhes do imóvel ${im.imovel}`}
                        onClick={() => toggleImovelExpandido(im.imovel)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleImovelExpandido(im.imovel);
                          }
                        }}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 ${
                          estaExpandido ? "bg-slate-50" : ""
                        }`}
                      >
                        {/* 1. Imóvel */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <ChevronRight
                              className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                                estaExpandido ? "rotate-90 text-slate-700" : ""
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-slate-900 block truncate">
                                {im.imovel}
                              </span>
                              <span className="text-[11px] text-slate-400 block">{im.cidadeUf}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Postos mobilizados */}
                        <td className="py-3 px-4 text-right tabular-nums text-slate-700 text-sm">
                          {im.postos_mobilizados}
                        </td>

                        {/* 3. Postos ocupados */}
                        <td className="py-3 px-4 text-right tabular-nums text-slate-700 text-sm">
                          {im.postos_ocupados}
                        </td>

                        {/* 4. Vagas em aberto: "—" quando zero; vermelho quando > 0 */}
                        <td className="py-3 px-4 text-right tabular-nums text-sm">
                          {im.vagas_em_aberto === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className="text-rose-600 font-semibold">{im.vagas_em_aberto}</span>
                          )}
                        </td>

                        {/* 5. Ocupação (barra + %) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 max-w-[110px] bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${corBarra}`}
                                style={{ width: `${Math.min(100, Math.max(0, taxaPorcento))}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-slate-600 w-12 text-right">
                              {taxaFormatadaLinha}
                            </span>
                          </div>
                        </td>

                        {/* 6. Status */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
                            {statusLabel}
                          </span>
                        </td>
                      </tr>

                      {/* LINHA EXPANDIDA COM A ÁRVORE ESTRUTURAL COMPLETA */}
                      {estaExpandido && (
                        <tr key={`${im.id || im.imovel}-arvore`}>
                          <td colSpan={6} className="p-0 border-b border-slate-100">
                            <ArvoreImovel
                              imovelNomeOuId={im.imovel}
                              termoBusca={busca}
                              forcarExpandirTodos={modoExpandirTodos ? true : undefined}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function PainelExecutivoPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 w-full max-w-[1440px] pb-16 animate-pulse">
          <div className="h-14 bg-white border border-[#E5E7EB] rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
            <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
            <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
            <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
            <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
          </div>
          <div className="h-64 bg-white border border-[#E5E7EB] rounded-xl" />
        </div>
      }
    >
      <PainelExecutivoContent />
    </Suspense>
  );
}
