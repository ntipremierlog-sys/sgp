import { NextRequest, NextResponse } from "next/server";
import { carregarEstado, CoberturaOperacional } from "@/lib/dados/estado-operacional";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import { CATALOGO_ITEM_PPU, obterItemPPU } from "@/lib/dados/painel-calculo";
import { COBERTURAS_PADRAO_REV04 } from "@/lib/servicos/relatorios-oficiais";
import postosRev04Json from "@/lib/dados/postos-rev04.json";

export const dynamic = "force-dynamic";

export type CategoriaMotivoLgpd = "Férias" | "Licença" | "Afastamento" | "Falta" | "Outros";

export interface CoberturaItemServidor {
  id: string;
  imovel: string;
  postoCodigo: string;
  postoFuncao: string;
  itemPpu: string;
  itemPpuDescricao: string;
  titularNome: string;
  titularMatricula: string;
  substitutoNome: string;
  substitutoMatricula: string;
  dataInicio: string;
  dataFim: string;
  periodoFormatado: string;
  diarias: number;
  motivoCategoria: CategoriaMotivoLgpd;
  status: "CONFIRMADA" | "PLANEJADA" | "CANCELADA";
  tipoCobertura: string;
  alertaInterjornada?: boolean;
  previaConferencia?: string | null;
  statusConferenciaPosto?: string | null;
  comentarioConferencia?: string;
}

/**
 * Normaliza e sanitiza qualquer justificativa em estrita categoria LGPD.
 * Nunca expõe detalhes médicos, atestados ou CID.
 */
function classificarMotivoLgpd(motivo?: string): CategoriaMotivoLgpd {
  if (!motivo) return "Outros";
  const m = motivo.trim().toLowerCase();
  if (m.includes("férias") || m.includes("ferias")) return "Férias";
  if (m.includes("licença") || m.includes("licenca")) return "Licença";
  if (
    m.includes("afastamento") ||
    m.includes("médic") ||
    m.includes("medic") ||
    m.includes("saúde") ||
    m.includes("saude") ||
    m.includes("atestado") ||
    m.includes("cid")
  ) {
    return "Afastamento";
  }
  if (m.includes("falta") || m.includes("injustificada")) return "Falta";
  return "Outros";
}

function calcularDiarias(dInicio: string, dFim: string): number {
  if (!dInicio || !dFim) return 1;
  const d1 = new Date(dInicio + "T00:00:00");
  const d2 = new Date(dFim + "T00:00:00");
  const diff = d2.getTime() - d1.getTime();
  if (isNaN(diff) || diff < 0) return 1;
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatarPeriodoDdMm(dInicio: string, dFim: string): string {
  if (!dInicio) return "—";
  const pIni = dInicio.split("-");
  const ddIni = pIni[2] || "01";
  const mmIni = pIni[1] || "01";
  if (!dFim || dInicio === dFim) {
    return `${ddIni}/${mmIni}`;
  }
  const pFim = dFim.split("-");
  const ddFim = pFim[2] || "01";
  const mmFim = pFim[1] || "01";
  return `${ddIni}/${mmIni} – ${ddFim}/${mmFim}`;
}

function normalizarItemPpu(codigo?: string): string {
  if (!codigo) return "1.1";
  const c = String(codigo).trim();
  const partes = c.split(".");
  if (partes.length === 2) {
    const p1 = parseInt(partes[0], 10);
    const p2 = parseInt(partes[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) {
      return `${p1}.${p2}`;
    }
  }
  return c;
}

export async function GET(request: NextRequest) {
  // 1. Verificação de Sessão do Servidor
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  if (!canServidor(usuario, "LER", "COBERTURAS")) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso a Coberturas não liberado para o seu perfil." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const competencia = searchParams.get("competencia") || "2026-09";
    const imovelFiltro = searchParams.get("imovel") || "TODOS";
    const itemPpuFiltro = searchParams.get("itemPpu") || "TODOS";
    const motivoFiltro = searchParams.get("motivo") || "TODOS";
    const statusFiltro = searchParams.get("status") || "TODOS";
    const previaFiltro = searchParams.get("previa") || "TODOS";
    const busca = (searchParams.get("busca") || "").trim().toLowerCase();

    const semPaginacao = searchParams.get("semPaginacao") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = semPaginacao ? 999999 : 25; // Requisito estrito: 25 registros por página no servidor (exceto exportação de arquivo)

    // 2. Carrega catálogo de postos para resolução de Imóvel e PPU padrão
    const mapaPostosRev04 = new Map<string, { imovel: string; funcao: string; itemPpu: string }>();
    (postosRev04Json as any[]).forEach((p) => {
      const cod = String(p.posto_id_sgp || p.idPosto || p.codigoPosto || "").trim();
      const imovel = String(p.imovel_id || p.base || p.localAtuacao || p.municipio || "Base").trim();
      const funcao = String(p.descricao || p.funcao || "Operacional").trim();
      const itemPpu = normalizarItemPpu(p.item_ppu || p.itemPPU || "1.1");
      if (cod) {
        mapaPostosRev04.set(cod, { imovel, funcao, itemPpu });
      }
    });

    // 3. Carrega base de coberturas no servidor
    const estado = carregarEstado();
    const cobMemoria = Array.isArray(estado.coberturas) ? estado.coberturas : [];

    // Mescla coberturas da memória com as contratuais padrão da REV04 (sem duplicar IDs)
    const mapaCoberturas = new Map<string, CoberturaOperacional>();
    COBERTURAS_PADRAO_REV04.forEach((c) => mapaCoberturas.set(c.id, c));
    cobMemoria.forEach((c) => mapaCoberturas.set(c.id, c));
    const todasCoberturas = Array.from(mapaCoberturas.values());

    // 4. Mapeamento e Enriquecimento das coberturas com Imóvel, PPU e LGPD
    const [anoComp, mesComp] = competencia.split("-").map(Number);
    const ultimoDiaComp = new Date(anoComp, mesComp, 0).getDate();
    const inicioMes = `${competencia}-01`;
    const fimMes = `${competencia}-${String(ultimoDiaComp).padStart(2, "0")}`;

    const listaMapeada: CoberturaItemServidor[] = todasCoberturas
      .filter((c) => {
        // Pertence ao mês da competência (dataInicio <= fimMes e dataFim >= inicioMes)
        return c.dataInicio <= fimMes && c.dataFim >= inicioMes;
      })
      .map((c) => {
        const postoRef = mapaPostosRev04.get(c.postoCodigo) || mapaPostosRev04.get(c.idPosto || "");
        const imovel = postoRef?.imovel || "Base Petrobras";
        const postoFuncao = c.funcaoPosto || postoRef?.funcao || "Suporte Operacional";
        const itemPpuCod = normalizarItemPpu(c.itemPpu || postoRef?.itemPpu || "1.1");
        const itemPpuObj = obterItemPPU(itemPpuCod);
        const itemPpuDescricao = itemPpuObj?.descricao || `Item ${itemPpuCod}`;
        const motivoCategoria = classificarMotivoLgpd(c.justificativa);
        const periodoFormatado = formatarPeriodoDdMm(c.dataInicio, c.dataFim);
        const diarias = calcularDiarias(c.dataInicio, c.dataFim);

        return {
          id: c.id,
          imovel,
          postoCodigo: c.postoCodigo,
          postoFuncao,
          itemPpu: itemPpuCod,
          itemPpuDescricao,
          titularNome: c.titularNome?.trim() || "Posto vago",
          titularMatricula: c.titularMatricula?.trim() || "—",
          substitutoNome: c.substitutoNome?.trim() || "Ferista designado",
          substitutoMatricula: c.substitutoMatricula?.trim() || "—",
          dataInicio: c.dataInicio,
          dataFim: c.dataFim,
          periodoFormatado,
          diarias,
          motivoCategoria,
          status: (c.status || "CONFIRMADA") as "CONFIRMADA" | "PLANEJADA" | "CANCELADA",
          tipoCobertura: c.tipoCobertura || "SUBSTITUICAO_INTERNA",
          alertaInterjornada: c.alertaInterjornada,
          previaConferencia: c.previaConferencia || null,
          statusConferenciaPosto: c.statusConferenciaPosto || null,
          comentarioConferencia: c.comentarioConferencia || "",
        };
      });

    // 5. Aplicação dos Filtros do Servidor
    const filtradas = listaMapeada.filter((item) => {
      // Filtro Imóvel
      if (imovelFiltro !== "TODOS" && item.imovel.toLowerCase() !== imovelFiltro.toLowerCase()) {
        return false;
      }
      // Filtro Item PPU
      if (itemPpuFiltro !== "TODOS" && normalizarItemPpu(item.itemPpu) !== normalizarItemPpu(itemPpuFiltro)) {
        return false;
      }
      // Filtro Motivo (categoria)
      if (motivoFiltro !== "TODOS" && item.motivoCategoria.toLowerCase() !== motivoFiltro.toLowerCase()) {
        return false;
      }
      // Filtro Status
      if (statusFiltro !== "TODOS" && item.status !== statusFiltro) {
        return false;
      }
      // Filtro Prévia Petrobras (Prévia 1, 2 ou 3)
      if (previaFiltro !== "TODOS" && item.previaConferencia !== previaFiltro) {
        return false;
      }
      // Filtro Busca Textual
      if (busca) {
        const atendeBusca =
          item.postoCodigo.toLowerCase().includes(busca) ||
          item.titularNome.toLowerCase().includes(busca) ||
          item.substitutoNome.toLowerCase().includes(busca) ||
          item.imovel.toLowerCase().includes(busca) ||
          item.itemPpu.toLowerCase().includes(busca) ||
          item.motivoCategoria.toLowerCase().includes(busca);
        if (!atendeBusca) return false;
      }
      return true;
    });

    // Ordenação consistente (por dataInicio decrescente, depois código do posto)
    filtradas.sort((a, b) => {
      const cmpData = b.dataInicio.localeCompare(a.dataInicio);
      if (cmpData !== 0) return cmpData;
      return a.postoCodigo.localeCompare(b.postoCodigo);
    });

    // 6. Paginação no Servidor (25 itens por página)
    const totalRegistros = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / pageSize));
    const paginaAtual = Math.min(page, totalPaginas);
    const inicioIndice = (paginaAtual - 1) * pageSize;
    const registrosPaginados = filtradas.slice(inicioIndice, inicioIndice + pageSize);

    // Listas únicas para alimentar os selects de filtros
    const imoveisDisponiveis = Array.from(new Set(listaMapeada.map((c) => c.imovel))).sort();
    const itensPpuDisponiveis = Array.from(new Set(listaMapeada.map((c) => c.itemPpu))).sort((a, b) => {
      const [a1, a2] = a.split(".").map(Number);
      const [b1, b2] = b.split(".").map(Number);
      if (a1 !== b1) return a1 - b1;
      return a2 - b2;
    });

    return NextResponse.json({
      sucesso: true,
      competencia,
      pagina: paginaAtual,
      pageSize,
      totalPaginas,
      totalRegistros,
      coberturas: registrosPaginados,
      filtrosDisponiveis: {
        imoveis: imoveisDisponiveis,
        itensPpu: itensPpuDisponiveis,
        motivos: ["Férias", "Licença", "Afastamento", "Falta", "Outros"],
        status: ["CONFIRMADA", "PLANEJADA", "CANCELADA"],
      },
    });
  } catch (erro: any) {
    console.error("Erro na API de Coberturas:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao processar coberturas." },
      { status: 500 }
    );
  }
}
