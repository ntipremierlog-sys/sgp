import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import {
  obterApontamentos,
  criarApontamento,
  atualizarApontamento,
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
    const imovelNome = searchParams.get("imovel") || undefined;
    const postoCodigo = searchParams.get("postoCodigo") || undefined;
    const periodoInicio = searchParams.get("periodoInicio") || undefined;
    const periodoFim = searchParams.get("periodoFim") || undefined;
    const status = searchParams.get("status") || undefined;

    const apontamentosDb = await obterApontamentos({
      imovelNome: imovelNome && imovelNome !== "TODOS" ? imovelNome : undefined,
      postoCodigo,
      periodoInicio,
      periodoFim,
      status,
    });

    const apontamentos = apontamentosDb.map((apt) => ({
      id: apt.id,
      postoCodigo: apt.posto?.postoIdSgp || apt.posto?.codigoPosto || "",
      idPosto: apt.posto?.codigoPosto,
      funcaoPosto: apt.posto?.funcao || "Operacional",
      dataReferencia: apt.periodoInicio.toISOString().slice(0, 10),
      periodoInicio: apt.periodoInicio.toISOString().slice(0, 10),
      periodoFim: apt.periodoFim.toISOString().slice(0, 10),
      texto: apt.texto,
      criadoPor: apt.criadoPor,
      dataCriacao: apt.criadoEm.toISOString().replace("T", " ").slice(0, 16),
      status: apt.status,
      respostaPremier: apt.respostaPremier,
      respondidoPor: apt.respondidoPor,
      respondidoEm: apt.respondidoEm ? apt.respondidoEm.toISOString().replace("T", " ").slice(0, 16) : null,
    }));

    return NextResponse.json({
      sucesso: true,
      total: apontamentos.length,
      apontamentos,
    });
  } catch (erro: any) {
    console.error("Erro na API de Apontamentos:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao consultar apontamentos." },
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
    const novo = await criarApontamento(body, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, apontamento: novo }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao criar apontamento." },
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
      return NextResponse.json({ sucesso: false, erro: "ID do apontamento é obrigatório." }, { status: 400 });
    }
    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    const atualizado = await atualizarApontamento(id, dados, usuarioIdentificador);
    return NextResponse.json({ sucesso: true, apontamento: atualizado });
  } catch (erro: any) {
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: erro.statusCode }
      );
    }
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao atualizar apontamento." },
      { status: 400 }
    );
  }
}
