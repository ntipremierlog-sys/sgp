import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import {
  obterPareceresVigentes,
  obterHistoricoPareceres,
  registrarParecerPrevia,
  PeriodoCongeladoError,
} from "@/lib/repositorio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const registroId = searchParams.get("registroId");
    const competencia = searchParams.get("competencia") || undefined;
    const tipoRegistro = searchParams.get("tipoRegistro") || undefined;
    const previaNumero = searchParams.get("previa") ? Number(searchParams.get("previa")) : undefined;

    if (registroId) {
      // Histórico do registro (filtrável por competência e prévia)
      const historico = await obterHistoricoPareceres(registroId, tipoRegistro, competencia, previaNumero);
      const vigente = historico[0] || null;
      return NextResponse.json({ sucesso: true, vigente, historico });
    }

    // Caso geral: pareceres vigentes da competência / prévia
    const vigentes = await obterPareceresVigentes({ competencia, tipoRegistro, previaNumero });
    return NextResponse.json({ sucesso: true, total: vigentes.length, vigentes });
  } catch (erro: any) {
    console.error("Erro na API de Conferência Prévia:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao consultar pareceres." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conferencia-previa
 * Body: { tipoRegistro, registroId, competencia, previaNumero, status, comentario }
 * O parecer vale somente para a prévia (competência + número) informada.
 */
export async function POST(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tipoRegistro, registroId, competencia, previaNumero, dataReferenciaOuInicio, status, comentario } = body;

    if (!tipoRegistro || !registroId || !status || ((!competencia || !previaNumero) && !dataReferenciaOuInicio)) {
      return NextResponse.json(
        { sucesso: false, erro: "Campos obrigatórios: tipoRegistro, registroId, competencia, previaNumero e status." },
        { status: 400 }
      );
    }

    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";

    const novoParecer = await registrarParecerPrevia(
      {
        tipoRegistro,
        registroId,
        competencia: competencia || undefined,
        previaNumero: previaNumero ? Number(previaNumero) : undefined,
        dataReferenciaOuInicio: dataReferenciaOuInicio || undefined,
        status,
        comentario,
      },
      usuarioIdentificador
    );

    return NextResponse.json({ sucesso: true, parecer: novoParecer }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao registrar parecer de prévia." },
      { status: 400 }
    );
  }
}
