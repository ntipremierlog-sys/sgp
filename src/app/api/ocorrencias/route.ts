import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import {
  obterOcorrencias,
  criarOcorrencia,
  atualizarOcorrencia,
  obterPareceresVigentes,
  obterPreviasDaCompetencia,
  obterPreviaServidor,
  chaveParecer,
  PeriodoCongeladoError,
} from "@/lib/repositorio";
import { recortarNaPrevia, hojeBrasil, type Previa } from "@/lib/servicos/previas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  if (!canServidor(usuario, "LER", "OCORRENCIAS")) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso a Ocorrências não liberado para o seu perfil." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const imovelFiltro = searchParams.get("imovel") || undefined;
    const competencia = searchParams.get("competencia") || undefined;
    const matricula = searchParams.get("matricula") || undefined;
    const postoCodigo = searchParams.get("postoCodigo") || undefined;
    const periodoInicio = searchParams.get("periodoInicio") || undefined;
    const periodoFim = searchParams.get("periodoFim") || undefined;

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

    const [ocorrenciasDb, pareceresDb] = await Promise.all([
      obterOcorrencias({
        imovelNome: imovelFiltro && imovelFiltro !== "TODOS" ? imovelFiltro : undefined,
        matricula,
        postoCodigo,
        periodoInicio: previaSelecionada?.dataInicio || periodoInicio,
        periodoFim: previaSelecionada?.dataFim || periodoFim,
        perfilUsuario: usuario.perfil,
      }),
      previaSelecionada
        ? obterPareceresVigentes({
            competencia: previaSelecionada.competencia,
            previaNumero: previaSelecionada.numero,
            tipoRegistro: "OCORRENCIA",
          })
        : obterPareceresVigentes({ competencia, tipoRegistro: "OCORRENCIA" }),
    ]);

    const mapaPareceres = new Map<string, typeof pareceresDb[0]>();
    for (const p of pareceresDb) {
      mapaPareceres.set(chaveParecer(p.registroId, p.competencia, p.previaNumero), p);
      if (!previaSelecionada) mapaPareceres.set(p.registroId, p);
    }

    // Dentro de uma prévia: só registros com dias nela, mostrando apenas esses dias,
    // e somente o parecer dado nessa prévia.
    const ocorrenciasMapeadas = ocorrenciasDb
      .map((oc) => {
        const dtIni = oc.dataInicio.toISOString().slice(0, 10);
        const dtFim = oc.dataFim.toISOString().slice(0, 10);
        const recorte = previaSelecionada ? recortarNaPrevia(dtIni, dtFim, previaSelecionada) : null;
        return { oc, recorte };
      })
      .filter(({ recorte }) => !previaSelecionada || recorte !== null)
      .map(({ oc, recorte }) => {
      const parecer = previaSelecionada
        ? mapaPareceres.get(chaveParecer(oc.id, previaSelecionada.competencia, previaSelecionada.numero))
        : mapaPareceres.get(oc.id);
      return {
        id: oc.id,
        matricula: oc.profissional.matricula,
        profissionalNome: oc.profissional.nome,
        postoCodigo: oc.posto?.postoIdSgp || oc.posto?.codigoPosto,
        imovel: oc.posto?.imovel?.nome || oc.posto?.unidade.nome,
        tipoOcorrencia: oc.tipoOcorrencia.codigo,
        rotuloPublico: oc.tipoOcorrencia.rotuloPublico,
        dataInicio: oc.dataInicio.toISOString().slice(0, 10),
        dataFim: oc.dataFim.toISOString().slice(0, 10),
        diasAfetados: oc.diasUteisAfetados,
        status: oc.status,
        origem: oc.origem,
        observacaoPublica: oc.observacaoPublica || oc.tipoOcorrencia.rotuloPublico,
        substituicao_aprovada: oc.substituicaoAprovada,
        substituto_chapa: oc.substitutoChapa,
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
        dadoSensivel: oc.dadoSensivel || null,
      };
    });

    return NextResponse.json({
      sucesso: true,
      perfil: usuario.perfil,
      previaSelecionada,
      total: ocorrenciasMapeadas.length,
      ocorrencias: ocorrenciasMapeadas,
    });
  } catch (erro: any) {
    console.error("Erro na API de Ocorrências:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao consultar ocorrências." },
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
    const nova = await criarOcorrencia(body, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, ocorrencia: nova }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao criar ocorrência." },
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
      return NextResponse.json({ sucesso: false, erro: "ID da ocorrência é obrigatório." }, { status: 400 });
    }
    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    const atualizada = await atualizarOcorrencia(id, dados, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, ocorrencia: atualizada });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao atualizar ocorrência." },
      { status: 400 }
    );
  }
}
