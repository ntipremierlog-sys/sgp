import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import {
  listarPreviasCompetencias,
  listarPreviasPadrao,
  obterPreviaServidor,
  ajustarPreviasCompetencia,
  AjustePreviaInvalidoError,
  PeriodoCongeladoError,
} from "@/lib/repositorio";
import { competenciasPadraoCadastro, hojeBrasil } from "@/lib/servicos/previas";

export const dynamic = "force-dynamic";

/** Perfis autorizados a ajustar manualmente as datas das prévias. */
const PERFIS_AJUSTE_PREVIA = ["PREMIER_ADMIN"];

/**
 * GET /api/previas
 *   ?competencia=AAAA-MM[,AAAA-MM]  → prévias dessas competências
 *   ?data=AAAA-MM-DD                 → também retorna a prévia que contém a data
 * Sem parâmetros: competência atual, 2 anteriores e 12 seguintes.
 */
export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const data = (searchParams.get("data") || hojeBrasil()).slice(0, 10);
    const compParam = searchParams.get("competencia");

    const previaDaData = await obterPreviaServidor(data);
    const competencias = compParam
      ? compParam.split(",").map((c) => c.trim()).filter(Boolean)
      : competenciasPadraoCadastro(data);
    if (!competencias.includes(previaDaData.competencia)) competencias.push(previaDaData.competencia);

    const previas = compParam ? await listarPreviasCompetencias(competencias) : await listarPreviasPadrao(data);

    return NextResponse.json({
      sucesso: true,
      data,
      previaDaData,
      competencias: Array.from(new Set(previas.map((p) => p.competencia))).sort(),
      previas,
      podeAjustar: PERFIS_AJUSTE_PREVIA.includes(usuario.perfil),
    });
  } catch (erro: any) {
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao consultar prévias." }, { status: 500 });
  }
}

/**
 * PUT /api/previas — ajuste manual (somente Premier/Administração).
 * Body: { competencia, motivo, previas: [{ numero, dataInicio, dataFim }] }
 */
export async function PUT(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }
  if (!PERFIS_AJUSTE_PREVIA.includes(usuario.perfil)) {
    return NextResponse.json(
      { sucesso: false, erro: "Somente o perfil Premier/Administração pode alterar as datas das prévias." },
      { status: 403 }
    );
  }
  try {
    const body = await request.json();
    const { competencia, motivo, previas } = body || {};
    if (!competencia || !Array.isArray(previas)) {
      return NextResponse.json({ sucesso: false, erro: "Informe a competência e as 3 prévias." }, { status: 400 });
    }
    const atualizadas = await ajustarPreviasCompetencia(
      String(competencia),
      previas.map((p: any) => ({
        numero: Number(p.numero),
        dataInicio: String(p.dataInicio || ""),
        dataFim: String(p.dataFim || ""),
      })),
      String(motivo || ""),
      usuario.email || usuario.nome || "usuario-sistema"
    );
    return NextResponse.json({ sucesso: true, previas: atualizadas });
  } catch (erro: any) {
    if (erro instanceof AjustePreviaInvalidoError) {
      return NextResponse.json({ sucesso: false, erro: erro.message, erros: erro.erros }, { status: 422 });
    }
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json({ sucesso: false, erro: erro.message, codigo: erro.codigo }, { status: erro.statusCode });
    }
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao ajustar prévias." }, { status: 400 });
  }
}
