import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import { consultarDadosRelatorioCoberturas } from "@/lib/dados/relatorio-coberturas-dados";

export const dynamic = "force-dynamic";

/**
 * Endpoint da Camada de Dados: Relatório Agregado de Coberturas
 *
 * Recebe via GET Query Params:
 * - competencia: string (ex.: "2026-09" ou "09/2026")
 * - imovel: string (opcional, ex.: "EDIHB", "EDISA", "BOAVENTURA")
 * - itemPpu: string (opcional, ex.: "1.1", "3.4", "3.6")
 * - motivo: string (opcional, ex.: "Férias", "Licença", "Afastamento", "Falta")
 *
 * Retorna as agregações calculadas no banco de dados:
 * A) Indicadores do período
 * B) Resumo por Item da PPU
 * C) Resumo por Imóvel
 * D) Ranking dos feristas/substitutos
 */
export async function GET(request: NextRequest) {
  // 1. Verificação de Sessão do Servidor
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json(
      { sucesso: false, erro: "Autenticação necessária." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Controle de Permissões (RBAC)
  if (!canServidor(usuario, "LER", "RELATORIOS") && !canServidor(usuario, "LER", "COBERTURAS")) {
    return NextResponse.json(
      { sucesso: false, erro: "Acesso a relatórios de coberturas não liberado para o seu perfil." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const competencia = searchParams.get("competencia") || "2026-09";
    const imovel = searchParams.get("imovel") || undefined;
    const itemPpu = searchParams.get("itemPpu") || undefined;
    const motivo = searchParams.get("motivo") || undefined;

    // 3. Execução da Consulta e Agregação na Camada de Dados
    const resultado = await consultarDadosRelatorioCoberturas({
      competencia,
      imovel,
      itemPpu,
      motivo,
    });

    return NextResponse.json(resultado, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (erro: any) {
    console.error("Erro no endpoint de relatório de coberturas:", erro);
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro?.message || "Falha ao processar relatório de coberturas.",
      },
      { status: 500 }
    );
  }
}
