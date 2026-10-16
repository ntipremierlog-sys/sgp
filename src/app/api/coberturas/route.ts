import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import {
  obterCoberturas,
  criarCobertura,
  atualizarCobertura,
  excluirCobertura,
  obterPareceresVigentes,
  obterPreviasDaCompetencia,
  obterPreviaServidor,
  chaveParecer,
  PeriodoCongeladoError,
} from "@/lib/repositorio";
import { recortarNaPrevia, hojeBrasil, type Previa } from "@/lib/servicos/previas";
import { obterItemPPU } from "@/lib/dados/painel-calculo";

export const dynamic = "force-dynamic";

export type CategoriaMotivoLgpd = "Férias" | "Licença" | "Afastamento" | "Falta" | "Outros";

function classificarMotivoLgpd(justificativa?: string | null): CategoriaMotivoLgpd {
  if (!justificativa) return "Outros";
  const j = justificativa.toLowerCase();
  if (j.includes("férias") || j.includes("ferias")) return "Férias";
  if (j.includes("licença") || j.includes("licenca") || j.includes("maternidade") || j.includes("paternidade")) return "Licença";
  if (j.includes("afastamento") || j.includes("inss") || j.includes("médic") || j.includes("medic") || j.includes("atestado")) return "Afastamento";
  if (j.includes("falta")) return "Falta";
  return "Outros";
}

function formatarPeriodoDdMm(dtInicio: string, dtFim: string): string {
  try {
    const [, mIni, dIni] = dtInicio.split("-");
    const [, mFim, dFim] = dtFim.split("-");
    return `${dIni}/${mIni} a ${dFim}/${mFim}`;
  } catch {
    return `${dtInicio} a ${dtFim}`;
  }
}

function calcularDiarias(dtInicio: string, dtFim: string): number {
  try {
    const ini = new Date(dtInicio + "T00:00:00.000Z").getTime();
    const fim = new Date(dtFim + "T00:00:00.000Z").getTime();
    const diff = Math.round((fim - ini) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  } catch {
    return 1;
  }
}

export async function GET(request: NextRequest) {
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
    // Prévia (período de conferência) selecionada: competência + número (1, 2 ou 3).
    // Sem "previa" na URL: comportamento anterior (usado pelo Relatório de Coberturas).
    const previaParam = searchParams.get("previa");
    const competenciaPrevia = searchParams.get("competencia");
    let previaSelecionada: Previa | null = null;
    if (previaParam) {
      const numeroPrevia = Number(previaParam);
      if (competenciaPrevia && [1, 2, 3].includes(numeroPrevia)) {
        previaSelecionada =
          (await obterPreviasDaCompetencia(competenciaPrevia)).find((p) => p.numero === numeroPrevia) || null;
      }
      if (!previaSelecionada) previaSelecionada = await obterPreviaServidor(hojeBrasil());
    }
    const busca = (searchParams.get("busca") || "").trim().toLowerCase();

    const semPaginacao = searchParams.get("semPaginacao") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = semPaginacao ? 999999 : 25;

    // Buscar coberturas ativas e pareceres do banco Neon
    const [coberturasDb, pareceresDb] = await Promise.all([
      obterCoberturas({
        imovelNome: imovelFiltro !== "TODOS" ? imovelFiltro : undefined,
        ...(previaSelecionada
          ? { periodoInicio: previaSelecionada.dataInicio, periodoFim: previaSelecionada.dataFim }
          : {}),
      }),
      previaSelecionada
        ? obterPareceresVigentes({
            competencia: previaSelecionada.competencia,
            previaNumero: previaSelecionada.numero,
            tipoRegistro: "COBERTURA",
          })
        : obterPareceresVigentes({ competencia, tipoRegistro: "COBERTURA" }),
    ]);

    // Parecer é por registro E por prévia: dentro de uma prévia só vale o parecer dado nela.
    const mapaPareceres = new Map<string, typeof pareceresDb[0]>();
    for (const p of pareceresDb) {
      mapaPareceres.set(chaveParecer(p.registroId, p.competencia, p.previaNumero), p);
      if (!previaSelecionada) mapaPareceres.set(p.registroId, p);
    }

    let inicioJanela: string;
    let fimJanela: string;
    if (previaSelecionada) {
      inicioJanela = previaSelecionada.dataInicio;
      fimJanela = previaSelecionada.dataFim;
    } else {
      const [anoComp, mesComp] = competencia.split("-").map(Number);
      const ultimoDiaComp = new Date(anoComp, mesComp, 0).getDate();
      inicioJanela = `${competencia}-01`;
      fimJanela = `${competencia}-${String(ultimoDiaComp).padStart(2, "0")}`;
    }

    const listaMapeada = coberturasDb
      .filter((c) => {
        const dtIni = c.dataInicio.toISOString().slice(0, 10);
        const dtFim = c.dataFim.toISOString().slice(0, 10);
        return dtIni <= fimJanela && dtFim >= inicioJanela;
      })
      .map((c) => {
        const dtIni = c.dataInicio.toISOString().slice(0, 10);
        const dtFim = c.dataFim.toISOString().slice(0, 10);
        const imovel = c.posto.imovel?.nome || c.posto.unidade.nome || "Base Petrobras";
        const postoFuncao = c.posto.funcao || "Suporte Operacional";
        const itemPpuCod = c.itemPpuCodigo || c.posto.itemPpuCodigo || "1.1";
        const itemPpuObj = obterItemPPU(itemPpuCod);
        const itemPpuDescricao = itemPpuObj?.descricao || `Item ${itemPpuCod}`;
        const motivoCategoria = classificarMotivoLgpd(c.justificativa);
        // Dentro de uma prévia, mostra só os dias do registro que caem nela.
        const recorte = previaSelecionada ? recortarNaPrevia(dtIni, dtFim, previaSelecionada) : null;
        const periodoFormatado = recorte
          ? formatarPeriodoDdMm(recorte.inicio, recorte.fim)
          : formatarPeriodoDdMm(dtIni, dtFim);
        const diarias = recorte ? recorte.dias : calcularDiarias(dtIni, dtFim);
        const parecer = previaSelecionada
          ? mapaPareceres.get(chaveParecer(c.id, previaSelecionada.competencia, previaSelecionada.numero))
          : mapaPareceres.get(c.id);

        return {
          id: c.id,
          imovel,
          postoCodigo: c.posto.postoIdSgp || c.posto.codigoPosto,
          postoFuncao,
          itemPpu: itemPpuCod,
          itemPpuDescricao,
          titularNome: c.ocorrencia?.profissional?.nome || "Posto vago",
          titularMatricula: c.ocorrencia?.profissional?.matricula || "—",
          substitutoNome: c.profissionalSubstituto.nome,
          substitutoMatricula: c.profissionalSubstituto.matricula,
          dataInicio: dtIni,
          dataFim: dtFim,
          periodoFormatado,
          diarias,
          motivoCategoria,
          status: c.status as "CONFIRMADA" | "PLANEJADA" | "CANCELADA",
          tipoCobertura: c.tipoCobertura,
          previa: previaSelecionada,
          recortePrevia: recorte,
          parecerPrevia: parecer
            ? {
                competencia: parecer.competencia,
                numero: parecer.previaNumero,
                status: parecer.status,
                comentario: parecer.comentario || "",
                registradoPor: parecer.registradoPor,
                registradoEm: parecer.registradoEm,
              }
            : null,
          statusConferenciaPosto: parecer?.status || null,
          comentarioConferencia: parecer?.comentario || "",
        };
      });

    const filtradas = listaMapeada.filter((item) => {
      if (imovelFiltro !== "TODOS" && item.imovel.toLowerCase() !== imovelFiltro.toLowerCase()) return false;
      if (itemPpuFiltro !== "TODOS" && item.itemPpu !== itemPpuFiltro) return false;
      if (motivoFiltro !== "TODOS" && item.motivoCategoria.toLowerCase() !== motivoFiltro.toLowerCase()) return false;
      if (statusFiltro !== "TODOS" && item.status !== statusFiltro) return false;
      if (busca) {
        const atende =
          item.postoCodigo.toLowerCase().includes(busca) ||
          item.titularNome.toLowerCase().includes(busca) ||
          item.substitutoNome.toLowerCase().includes(busca) ||
          item.imovel.toLowerCase().includes(busca) ||
          item.itemPpu.toLowerCase().includes(busca) ||
          item.motivoCategoria.toLowerCase().includes(busca);
        if (!atende) return false;
      }
      return true;
    });

    filtradas.sort((a, b) => {
      const cmp = b.dataInicio.localeCompare(a.dataInicio);
      if (cmp !== 0) return cmp;
      return a.postoCodigo.localeCompare(b.postoCodigo);
    });

    const totalRegistros = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / pageSize));
    const paginaAtual = Math.min(page, totalPaginas);
    const inicioIndice = (paginaAtual - 1) * pageSize;
    const registrosPaginados = filtradas.slice(inicioIndice, inicioIndice + pageSize);

    const imoveisDisponiveis = Array.from(new Set(listaMapeada.map((c) => c.imovel))).sort();
    const itensPpuDisponiveis = Array.from(new Set(listaMapeada.map((c) => c.itemPpu))).sort();

    return NextResponse.json({
      sucesso: true,
      competencia: previaSelecionada?.competencia || competencia,
      previaSelecionada,
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

export async function POST(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    const nova = await criarCobertura(body, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, cobertura: nova }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao criar cobertura." },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...dados } = body;
    if (!id) {
      return NextResponse.json({ sucesso: false, erro: "ID da cobertura é obrigatório." }, { status: 400 });
    }
    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    const atualizada = await atualizarCobertura(id, dados, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, cobertura: atualizada });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao atualizar cobertura." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ sucesso: false, erro: "ID da cobertura é obrigatório." }, { status: 400 });
    }
    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    await excluirCobertura(id, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, mensagem: "Cobertura excluída com sucesso." });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao excluir cobertura." },
      { status: 400 }
    );
  }
}
