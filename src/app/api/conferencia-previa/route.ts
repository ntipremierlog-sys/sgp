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

    if (registroId) {
      // Se solicitou um registroId específico, retorna o histórico completo dele
      const historico = await obterHistoricoPareceres(registroId, tipoRegistro);
      const vigente = historico[0] || null;
      return NextResponse.json({
        sucesso: true,
        vigente,
        historico,
      });
    }

    // Caso geral: retorna pareceres vigentes da competência
    const vigentes = await obterPareceresVigentes({ competencia, tipoRegistro });
    return NextResponse.json({
      sucesso: true,
      total: vigentes.length,
      vigentes,
    });
  } catch (erro: any) {
    console.error("Erro na API de Conferência Prévia:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao consultar pareceres." },
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
    const { tipoRegistro, registroId, dataReferenciaOuInicio, previaNumero, status, comentario } = body;

    if (!tipoRegistro || !registroId || !previaNumero || !status) {
      return NextResponse.json(
        { sucesso: false, erro: "Campos obrigatórios: tipoRegistro, registroId, previaNumero e status." },
        { status: 400 }
      );
    }

    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";

    const novoParecer = await registrarParecerPrevia(
      {
        tipoRegistro,
        registroId,
        dataReferenciaOuInicio: dataReferenciaOuInicio || new Date().toISOString().slice(0, 10),
        previaNumero: Number(previaNumero),
        status,
        comentario,
      },
      usuarioIdentificador
    );

    return NextResponse.json({
      sucesso: true,
      parecer: novoParecer,
    }, { status: 201 });
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
