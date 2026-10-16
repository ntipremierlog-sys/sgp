"use client";

/**
 * SGP - Conferência Petrobras por prévia.
 *
 * A fiscal confere por prévia (período de conferência dentro da competência):
 *  - Nível 1: postos com dias exigíveis, dias atendidos (Presente + Coberto) e % de cobertura,
 *    apurados no servidor com o motor calcularStatusVagaDia (GET /api/conferencia).
 *  - Nível 2: linhas posição-dia que não são PRESENTE nem FOLGA, com justificativa da Premier
 *    e parecer da fiscal (COBERTO, DESCOBERTO ou PARCIAL), inclusive em lote.
 * Justificativas e pareceres são somente inclusão; a tela mostra o registro mais recente.
 * LGPD: a API envia apenas nome e chapa do colaborador e o tipo público da ocorrência.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  Download,
  Filter,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  Layers,
  X,
  Loader2,
  MessageSquarePlus,
  Gavel,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useSelecaoPrevia, SeletorPrevia } from "@/components/previas/seletor-previa";
import { rotuloPreviaComDatas, formatarDataBr, type Previa } from "@/lib/servicos/previas";
import {
  ROTULO_SITUACAO_APURADA,
  ROTULO_PARECER,
  ROTULO_SITUACAO_CONFERENCIA,
} from "@/lib/servicos/conferencia-perfis";

interface ParecerLinha {
  status: string;
  comentario: string | null;
  horasDescobertas: number | null;
  registradoPor: string | null;
  registradoEm: string;
}
interface JustificativaLinha {
  texto: string;
  registradoPor: string | null;
  registradoEm: string;
}
interface LinhaConferencia {
  chave: string;
  postoId: string;
  posicaoId: string;
  posicaoCodigo: string;
  data: string;
  titularNome: string | null;
  titularChapa: string | null;
  situacao: string;
  ocorrenciaTipo: string | null;
  cobertoPorNome: string | null;
  justificativa: JustificativaLinha | null;
  parecer: ParecerLinha | null;
  imovel?: string;
  postoCodigo?: string;
  postoDescricao?: string;
}
interface PostoConferencia {
  postoId: string;
  imovel: string;
  codigoPosto: string;
  descricao: string;
  tipoPosto: string;
  diasExigiveis: number;
  diasAtendidos: number;
  percentualCobertura: number | null;
  totalLinhas: number;
  linhasSemParecer: number;
  temFalha: boolean;
  situacaoConferencia: "NAO_INICIADA" | "EM_ANDAMENTO" | "CONCLUIDA";
}
interface Indicadores {
  postosNaPrevia: number;
  postos100: number;
  postosComFalha: number;
  linhasAguardandoParecer: number;
}
interface Permissoes {
  podeDarParecer: boolean;
  podeJustificar: boolean;
}

const COR_SITUACAO_APURADA: Record<string, string> = {
  COBERTO: "bg-sky-50 text-sky-700 ring-sky-200",
  DESCOBERTO: "bg-rose-50 text-rose-700 ring-rose-200",
  SEM_OCUPANTE: "bg-orange-50 text-orange-700 ring-orange-200",
  SEM_DADO: "bg-slate-100 text-slate-600 ring-slate-200",
  PENDENTE: "bg-amber-50 text-amber-700 ring-amber-200",
  CICLO_NAO_CONFIGURADO: "bg-violet-50 text-violet-700 ring-violet-200",
};
const COR_PARECER: Record<string, string> = {
  COBERTO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DESCOBERTO: "bg-rose-50 text-rose-700 ring-rose-200",
  PARCIAL: "bg-amber-50 text-amber-700 ring-amber-200",
};
const COR_SITUACAO_CONF: Record<string, string> = {
  NAO_INICIADA: "bg-slate-100 text-slate-600 ring-slate-200",
  EM_ANDAMENTO: "bg-amber-50 text-amber-700 ring-amber-200",
  CONCLUIDA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const fmtDataHora = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const diaSemana = (iso: string) =>
  ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(iso + "T12:00:00Z").getUTCDay()];
const rotuloCompetencia = (c: string) => {
  const [a, m] = c.split("-");
  return `${m}/${a}`;
};

function Chip({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${cor}`}>
      {texto}
    </span>
  );
}

function BarraCobertura({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const cor = pct >= 100 ? "from-emerald-400 to-emerald-600" : pct >= 80 ? "from-amber-300 to-amber-500" : "from-rose-400 to-rose-600";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${cor} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <span className="w-11 text-right text-xs font-bold tabular-nums text-slate-700">{pct.toFixed(pct % 1 === 0 ? 0 : 1)}%</span>
    </div>
  );
}

function CartaoIndicador({
  titulo,
  valor,
  icone,
  gradiente,
  detalhe,
}: {
  titulo: string;
  valor: number | string;
  icone: React.ReactNode;
  gradiente: string;
  detalhe?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradiente} opacity-15 transition-transform duration-500 group-hover:scale-125`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{valor}</p>
          {detalhe && <p className="mt-0.5 text-[11px] text-slate-500">{detalhe}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradiente} text-white shadow-sm`}>{icone}</div>
      </div>
    </div>
  );
}

function PaginaConferencia() {
  const params = useSearchParams();
  const selecao = useSelecaoPrevia();
  const [imovel, setImovel] = useState("TODOS");
  const [imoveis, setImoveis] = useState<string[]>([]);
  const [somenteFalha, setSomenteFalha] = useState(true);
  const [busca, setBusca] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [postos, setPostos] = useState<PostoConferencia[]>([]);
  const [permissoes, setPermissoes] = useState<Permissoes>({ podeDarParecer: false, podeJustificar: false });
  const [exportando, setExportando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  // Nível 2
  const [postoAberto, setPostoAberto] = useState<string | null>(null);
  const [postoDetalhe, setPostoDetalhe] = useState<PostoConferencia | null>(null);
  const [linhas, setLinhas] = useState<LinhaConferencia[]>([]);
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [erroLinhas, setErroLinhas] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [statusParecer, setStatusParecer] = useState<"COBERTO" | "DESCOBERTO" | "PARCIAL">("COBERTO");
  const [comentario, setComentario] = useState("");
  const [horas, setHoras] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [justificandoChave, setJustificandoChave] = useState<string | null>(null);
  const [textoJustificativa, setTextoJustificativa] = useState("");

  // Parâmetros da URL (link do Mapa de Ocupação): competência, prévia e posto.
  const [urlAplicada, setUrlAplicada] = useState(false);
  useEffect(() => {
    if (urlAplicada || selecao.carregandoPrevias) return;
    setUrlAplicada(true);
    const c = params.get("competencia");
    const n = Number(params.get("previa") || 0);
    if (c && /^\d{4}-\d{2}$/.test(c)) selecao.selecionarCompetencia(c);
    if ([1, 2, 3].includes(n)) selecao.selecionarNumero(n);
    const p = params.get("posto");
    if (p) setPostoAberto(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecao.carregandoPrevias]);

  const competencia = selecao.competencia;
  const numero = selecao.numero;
  const prontoUrl = !selecao.carregandoPrevias && urlAplicada;

  const carregarNivel1 = useCallback(async () => {
    if (!competencia || !numero) return;
    setCarregando(true);
    setErro("");
    try {
      const qs = new URLSearchParams({ competencia, previa: String(numero) });
      if (imovel !== "TODOS") qs.set("imovel", imovel);
      const res = await fetch(`/api/conferencia?${qs}`, { cache: "no-store" });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao apurar a conferência.");
      setPrevia(dados.previa);
      setIndicadores(dados.indicadores);
      setPostos(dados.postos || []);
      setPermissoes(dados.permissoes);
      setImoveis((atual) => Array.from(new Set([...atual, ...(dados.imoveis || [])])).sort());
    } catch (e: any) {
      setErro(e?.message || "Falha ao apurar a conferência.");
      setPostos([]);
      setIndicadores(null);
    } finally {
      setCarregando(false);
    }
  }, [competencia, numero, imovel]);

  useEffect(() => {
    if (prontoUrl) carregarNivel1();
  }, [prontoUrl, carregarNivel1]);

  const carregarNivel2 = useCallback(
    async (postoId: string) => {
      if (!competencia || !numero) return;
      setCarregandoLinhas(true);
      setErroLinhas("");
      try {
        const qs = new URLSearchParams({ competencia, previa: String(numero), posto: postoId });
        const res = await fetch(`/api/conferencia?${qs}`, { cache: "no-store" });
        const dados = await res.json();
        if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao carregar o posto.");
        setPostoDetalhe(dados.posto);
        setLinhas(dados.linhas || []);
        setPermissoes(dados.permissoes);
      } catch (e: any) {
        setErroLinhas(e?.message || "Falha ao carregar o posto.");
        setLinhas([]);
      } finally {
        setCarregandoLinhas(false);
      }
    },
    [competencia, numero]
  );

  useEffect(() => {
    if (prontoUrl && postoAberto) {
      setSelecionadas(new Set());
      setErroAcao("");
      setJustificandoChave(null);
      carregarNivel2(postoAberto);
    }
  }, [prontoUrl, postoAberto, carregarNivel2]);

  const postosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return postos.filter((p) => {
      if (somenteFalha && !(p.temFalha || p.linhasSemParecer > 0)) return false;
      if (termo && !`${p.codigoPosto} ${p.descricao} ${p.tipoPosto}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [postos, somenteFalha, busca]);

  const fecharPosto = () => {
    setPostoAberto(null);
    setPostoDetalhe(null);
    setLinhas([]);
  };

  const alternarLinha = (chave: string) =>
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  const todasSelecionadas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.chave));
  const alternarTodas = () => setSelecionadas(todasSelecionadas ? new Set() : new Set(linhas.map((l) => l.chave)));
  const selecionarSemParecer = () => setSelecionadas(new Set(linhas.filter((l) => !l.parecer).map((l) => l.chave)));

  const aplicarParecer = async () => {
    setErroAcao("");
    if (selecionadas.size === 0) return setErroAcao("Selecione ao menos uma linha.");
    if (statusParecer !== "COBERTO" && comentario.trim().length < 3) {
      return setErroAcao("Comentário obrigatório para os pareceres DESCOBERTO e PARCIAL.");
    }
    setSalvando(true);
    try {
      const alvo = linhas.filter((l) => selecionadas.has(l.chave)).map((l) => ({ posicaoId: l.posicaoId, data: l.data }));
      const res = await fetch("/api/conferencia/parecer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencia,
          previaNumero: numero,
          linhas: alvo,
          status: statusParecer,
          comentario,
          horasDescobertas: statusParecer === "PARCIAL" ? horas : null,
        }),
      });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao registrar o parecer.");
      setMensagem(`Parecer ${ROTULO_PARECER[statusParecer]} registrado em ${dados.total} linha(s).`);
      setSelecionadas(new Set());
      setComentario("");
      setHoras("");
      if (postoAberto) await carregarNivel2(postoAberto);
      carregarNivel1();
    } catch (e: any) {
      setErroAcao(e?.message || "Falha ao registrar o parecer.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarJustificativa = async (linha: LinhaConferencia) => {
    setErroAcao("");
    if (textoJustificativa.trim().length < 3) return setErroAcao("Informe o texto da justificativa.");
    setSalvando(true);
    try {
      const res = await fetch("/api/conferencia/justificativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, previaNumero: numero, posicaoId: linha.posicaoId, data: linha.data, texto: textoJustificativa }),
      });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao registrar a justificativa.");
      setMensagem("Justificativa da Premier registrada.");
      setJustificandoChave(null);
      setTextoJustificativa("");
      if (postoAberto) await carregarNivel2(postoAberto);
    } catch (e: any) {
      setErroAcao(e?.message || "Falha ao registrar a justificativa.");
    } finally {
      setSalvando(false);
    }
  };

  useEffect(() => {
    if (!mensagem) return;
    const t = setTimeout(() => setMensagem(""), 4000);
    return () => clearTimeout(t);
  }, [mensagem]);

  const exportarExcel = async () => {
    if (!competencia || !numero) return;
    setExportando(true);
    setErro("");
    try {
      const qs = new URLSearchParams({ competencia, previa: String(numero), exportar: "1" });
      if (imovel !== "TODOS") qs.set("imovel", imovel);
      const res = await fetch(`/api/conferencia?${qs}`, { cache: "no-store" });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao exportar.");
      const lista: LinhaConferencia[] = dados.linhas || [];
      const XLSX = await import("xlsx");
      const rotPrevia = `${dados.previa.numero}ª prévia (${formatarDataBr(dados.previa.dataInicio)} a ${formatarDataBr(dados.previa.dataFim)})`;
      const linhasPlanilha = lista.map((l) => ({
        "Competência": rotuloCompetencia(dados.previa.competencia),
        "Prévia": rotPrevia,
        "Imóvel": l.imovel || "",
        "Posto": `${l.postoCodigo || l.postoId}${l.postoDescricao ? " - " + l.postoDescricao : ""}`,
        "Data": formatarDataBr(l.data),
        "Posição": l.posicaoCodigo,
        "Situação apurada": ROTULO_SITUACAO_APURADA[l.situacao] || l.situacao,
        "Tipo da ocorrência": l.ocorrenciaTipo || "",
        "Coberto por": l.cobertoPorNome || "",
        "Justificativa Premier": l.justificativa?.texto || "",
        "Parecer": l.parecer ? ROTULO_PARECER[l.parecer.status] || l.parecer.status : "Aguardando parecer",
        "Comentário": l.parecer?.comentario || "",
        "Horas descobertas": l.parecer?.horasDescobertas ?? "",
        "Registrado por": l.parecer?.registradoPor || "",
        "Registrado em": fmtDataHora(l.parecer?.registradoEm),
      }));
      const ws = XLSX.utils.json_to_sheet(linhasPlanilha);
      ws["!cols"] = [10, 30, 10, 50, 12, 10, 18, 22, 28, 50, 18, 50, 10, 28, 18].map((wch) => ({ wch }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Conferência");
      const sufixoImovel = imovel !== "TODOS" ? `_${imovel}` : "";
      XLSX.writeFile(wb, `conferencia_${dados.previa.competencia}_previa${dados.previa.numero}${sufixoImovel}.xlsx`);
      setMensagem(`Exportadas ${linhasPlanilha.length} linha(s).`);
    } catch (e: any) {
      setErro(e?.message || "Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  };

  const rotuloPrevia = previa ? `${rotuloPreviaComDatas(previa)} · competência ${rotuloCompetencia(previa.competencia)}` : "";

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      {/* Cabeçalho */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight md:text-2xl">
              <ClipboardCheck className="h-6 w-6 text-emerald-300" />
              Conferência Petrobras por prévia
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-indigo-100/80">
              Cobertura de cada posto no período da prévia. Nas falhas, analise a ocorrência e a justificativa da Premier e registre o parecer.
            </p>
            {rotuloPrevia && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/15">{rotuloPrevia}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/95 p-2 text-slate-700 shadow-inner">
            <SeletorPrevia selecao={selecao} />
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Building2 className="h-3.5 w-3.5" /> Imóvel
              <select
                id="filtro-imovel-conferencia"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={imovel}
                onChange={(e) => setImovel(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                {imoveis.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <button
              id="btn-exportar-conferencia"
              onClick={exportarExcel}
              disabled={exportando || !selecao.pronto}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exportar conferência (Excel)
            </button>
          </div>
        </div>
      </header>

      {mensagem && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" /> {mensagem}
        </div>
      )}
      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {erro}
        </div>
      )}

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores da prévia">
        <CartaoIndicador titulo="Postos na prévia" valor={indicadores?.postosNaPrevia ?? "—"} icone={<Layers className="h-5 w-5" />} gradiente="from-indigo-500 to-violet-600" />
        <CartaoIndicador
          titulo="Postos 100% atendidos"
          valor={indicadores?.postos100 ?? "—"}
          icone={<CheckCircle2 className="h-5 w-5" />}
          gradiente="from-emerald-500 to-teal-600"
          detalhe={indicadores && indicadores.postosNaPrevia ? `${Math.round((indicadores.postos100 / indicadores.postosNaPrevia) * 100)}% dos postos` : undefined}
        />
        <CartaoIndicador titulo="Postos com falha" valor={indicadores?.postosComFalha ?? "—"} icone={<AlertTriangle className="h-5 w-5" />} gradiente="from-rose-500 to-orange-500" />
        <CartaoIndicador titulo="Linhas aguardando parecer" valor={indicadores?.linhasAguardandoParecer ?? "—"} icone={<Hourglass className="h-5 w-5" />} gradiente="from-amber-400 to-amber-600" />
      </section>

      {/* Nível 1 */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter className="h-4 w-4 text-indigo-600" /> Postos da prévia
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {postosVisiveis.length} de {postos.length}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="busca-posto-conferencia"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar posto…"
              className="h-8 w-48 rounded-lg border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="relative inline-flex">
                <input id="filtro-somente-falha" type="checkbox" className="peer sr-only" checked={somenteFalha} onChange={(e) => setSomenteFalha(e.target.checked)} />
                <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-indigo-600" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
              Somente postos com falha ou pendência
            </label>
            <button onClick={carregarNivel1} title="Atualizar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
              <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Imóvel</th>
                <th className="px-3 py-2.5">Posto</th>
                <th className="px-3 py-2.5">Tipo de posto</th>
                <th className="px-3 py-2.5 text-right">Dias exigíveis</th>
                <th className="px-3 py-2.5 text-right">Dias atendidos</th>
                <th className="px-3 py-2.5">% cobertura</th>
                <th className="px-3 py-2.5 text-right">Linhas sem parecer</th>
                <th className="px-3 py-2.5">Situação da conferência</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando && postos.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-500" />
                    Apurando a prévia…
                  </td>
                </tr>
              )}
              {!carregando && postosVisiveis.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {postos.length === 0 ? "Nenhum posto na prévia." : "Nenhum posto com falha ou pendência nesta prévia."}
                  </td>
                </tr>
              )}
              {postosVisiveis.map((p) => (
                <tr
                  key={p.postoId}
                  id={`linha-posto-${p.postoId}`}
                  onClick={() => setPostoAberto(p.postoId)}
                  className={`cursor-pointer transition-colors hover:bg-indigo-50/60 ${postoAberto === p.postoId ? "bg-indigo-50" : ""} ${carregando ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-2.5 font-bold text-slate-700">{p.imovel}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[11px] font-bold text-indigo-700">{p.codigoPosto}</div>
                    <div className="max-w-[320px] truncate text-slate-600" title={p.descricao}>
                      {p.descricao}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{p.tipoPosto}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{p.diasExigiveis}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{p.diasAtendidos}</td>
                  <td className="px-3 py-2.5">
                    <BarraCobertura pct={p.percentualCobertura} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`tabular-nums font-extrabold ${p.linhasSemParecer > 0 ? "text-amber-600" : "text-slate-400"}`}>{p.linhasSemParecer}</span>
                    <span className="text-slate-400"> / {p.totalLinhas}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Chip texto={ROTULO_SITUACAO_CONFERENCIA[p.situacaoConferencia]} cor={COR_SITUACAO_CONF[p.situacaoConferencia]} />
                  </td>
                  <td className="px-2 py-2.5 text-slate-400">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Nível 2 - painel do posto */}
      {postoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={fecharPosto}>
          <aside
            role="dialog"
            aria-label="Linhas do posto"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-6xl flex-col bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-300"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Nível 2 · linhas a conferir</p>
                <h2 className="mt-0.5 text-base font-extrabold text-slate-900">
                  <span className="font-mono text-indigo-700">{postoDetalhe?.codigoPosto || postoAberto}</span>
                  {postoDetalhe?.descricao ? <span className="font-semibold text-slate-600"> — {postoDetalhe.descricao}</span> : null}
                </h2>
                {postoDetalhe && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <Chip texto={postoDetalhe.imovel} cor="bg-slate-100 text-slate-700 ring-slate-200" />
                    <Chip texto={postoDetalhe.tipoPosto} cor="bg-slate-100 text-slate-700 ring-slate-200" />
                    <span>
                      Atendidos <b>{postoDetalhe.diasAtendidos}</b> de <b>{postoDetalhe.diasExigiveis}</b> exigíveis
                    </span>
                    <BarraCobertura pct={postoDetalhe.percentualCobertura} />
                    <Chip texto={ROTULO_SITUACAO_CONFERENCIA[postoDetalhe.situacaoConferencia]} cor={COR_SITUACAO_CONF[postoDetalhe.situacaoConferencia]} />
                  </div>
                )}
              </div>
              <button id="btn-fechar-posto" onClick={fecharPosto} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Barra de parecer em lote */}
            {permissoes.podeDarParecer && linhas.length > 0 && (
              <div className="border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <Gavel className="h-3 w-3" /> Parecer da fiscal
                    </p>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                      {(["COBERTO", "DESCOBERTO", "PARCIAL"] as const).map((s) => (
                        <button
                          key={s}
                          id={`btn-parecer-${s.toLowerCase()}`}
                          onClick={() => setStatusParecer(s)}
                          className={`rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                            statusParecer === s
                              ? s === "COBERTO"
                                ? "bg-emerald-600 text-white shadow"
                                : s === "DESCOBERTO"
                                ? "bg-rose-600 text-white shadow"
                                : "bg-amber-500 text-white shadow"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {ROTULO_PARECER[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="min-w-[240px] flex-1">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Comentário {statusParecer !== "COBERTO" && <span className="text-rose-600">*</span>}
                    </span>
                    <input
                      id="campo-comentario-parecer"
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder={statusParecer === "COBERTO" ? "Opcional" : "Obrigatório para Descoberto e Parcial"}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </label>
                  {statusParecer === "PARCIAL" && (
                    <label className="w-32">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Horas descobertas</span>
                      <input
                        id="campo-horas-descobertas"
                        value={horas}
                        onChange={(e) => setHoras(e.target.value)}
                        inputMode="decimal"
                        placeholder="Opcional"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </label>
                  )}
                  <button
                    id="btn-aplicar-parecer"
                    onClick={aplicarParecer}
                    disabled={salvando || selecionadas.size === 0}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Aplicar a {selecionadas.size} linha(s)
                  </button>
                  <button onClick={selecionarSemParecer} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    Selecionar sem parecer
                  </button>
                </div>
              </div>
            )}
            {erroAcao && (
              <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle className="h-4 w-4" /> {erroAcao}
              </div>
            )}

            <div className="flex-1 overflow-auto p-5">
              {carregandoLinhas && (
                <div className="py-16 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-500" />
                  Carregando linhas do posto…
                </div>
              )}
              {erroLinhas && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{erroLinhas}</div>}
              {!carregandoLinhas && !erroLinhas && linhas.length === 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 py-12 text-center text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6" />
                  Nenhuma linha a conferir: todos os dias do posto estão Presentes ou em Folga.
                </div>
              )}
              {!carregandoLinhas && linhas.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        {permissoes.podeDarParecer && (
                          <th className="w-8 px-3 py-2.5">
                            <input type="checkbox" aria-label="Selecionar todas" checked={todasSelecionadas} onChange={alternarTodas} className="accent-indigo-600" />
                          </th>
                        )}
                        <th className="px-3 py-2.5">Data</th>
                        <th className="px-3 py-2.5">Posição</th>
                        <th className="px-3 py-2.5">Titular</th>
                        <th className="px-3 py-2.5">Situação apurada</th>
                        <th className="px-3 py-2.5">Ocorrência</th>
                        <th className="px-3 py-2.5">Coberto por</th>
                        <th className="px-3 py-2.5">Justificativa Premier</th>
                        <th className="px-3 py-2.5">Parecer da fiscal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {linhas.map((l) => (
                        <React.Fragment key={l.chave}>
                          <tr className={`align-top transition-colors ${selecionadas.has(l.chave) ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                            {permissoes.podeDarParecer && (
                              <td className="px-3 py-2.5">
                                <input type="checkbox" aria-label={`Selecionar ${l.data}`} checked={selecionadas.has(l.chave)} onChange={() => alternarLinha(l.chave)} className="accent-indigo-600" />
                              </td>
                            )}
                            <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800">
                              {formatarDataBr(l.data)} <span className="text-[10px] font-normal text-slate-400">{diaSemana(l.data)}</span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700">{l.posicaoCodigo}</td>
                            <td className="px-3 py-2.5 text-slate-700">
                              {l.titularNome ? (
                                <>
                                  <div className="font-semibold">{l.titularNome}</div>
                                  {l.titularChapa && <div className="text-[10px] text-slate-400">Chapa {l.titularChapa}</div>}
                                </>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <Chip texto={ROTULO_SITUACAO_APURADA[l.situacao] || l.situacao} cor={COR_SITUACAO_APURADA[l.situacao] || COR_SITUACAO_APURADA.SEM_DADO} />
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{l.ocorrenciaTipo || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2.5 text-slate-700">{l.cobertoPorNome || <span className="text-slate-400">—</span>}</td>
                            <td className="max-w-[240px] px-3 py-2.5 text-slate-700">
                              {l.justificativa ? (
                                <div>
                                  <p className="whitespace-pre-wrap">{l.justificativa.texto}</p>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{fmtDataHora(l.justificativa.registradoEm)}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              {permissoes.podeJustificar && justificandoChave !== l.chave && (
                                <button
                                  onClick={() => {
                                    setJustificandoChave(l.chave);
                                    setTextoJustificativa("");
                                    setErroAcao("");
                                  }}
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                >
                                  <MessageSquarePlus className="h-3 w-3" /> {l.justificativa ? "Nova justificativa" : "Justificar"}
                                </button>
                              )}
                            </td>
                            <td className="max-w-[240px] px-3 py-2.5">
                              {l.parecer ? (
                                <div className="space-y-0.5">
                                  <Chip texto={ROTULO_PARECER[l.parecer.status] || l.parecer.status} cor={COR_PARECER[l.parecer.status] || COR_SITUACAO_CONF.NAO_INICIADA} />
                                  {l.parecer.horasDescobertas !== null && <p className="text-[10px] font-semibold text-amber-700">{String(l.parecer.horasDescobertas).replace(".", ",")} h descobertas</p>}
                                  {l.parecer.comentario && <p className="whitespace-pre-wrap text-slate-600">{l.parecer.comentario}</p>}
                                  <p className="text-[10px] text-slate-400">
                                    {l.parecer.registradoPor} · {fmtDataHora(l.parecer.registradoEm)}
                                  </p>
                                </div>
                              ) : (
                                <Chip texto="Aguardando parecer" cor="bg-slate-50 text-slate-500 ring-slate-200" />
                              )}
                            </td>
                          </tr>
                          {justificandoChave === l.chave && (
                            <tr className="bg-indigo-50/40">
                              <td colSpan={permissoes.podeDarParecer ? 9 : 8} className="px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                  <textarea
                                    id="campo-justificativa-premier"
                                    autoFocus
                                    rows={2}
                                    value={textoJustificativa}
                                    onChange={(e) => setTextoJustificativa(e.target.value)}
                                    placeholder="Ex.: compensação de banco de horas autorizada; remanejamento para outro posto…"
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      id="btn-salvar-justificativa"
                                      onClick={() => salvarJustificativa(l)}
                                      disabled={salvando}
                                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                    >
                                      {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Registrar
                                    </button>
                                    <button onClick={() => setJustificandoChave(null)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {formatarDataBr(l.data)} · posição {l.posicaoCodigo}. A justificativa é somente inclusão (não pode ser editada nem apagada).
                                </p>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando conferência…</div>}>
      <PaginaConferencia />
    </Suspense>
  );
}
