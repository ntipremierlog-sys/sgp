import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor, carregarArmazemPermissoes, salvarPersonalizacoes } from "@/lib/auth/permissoes-servidor";
import { registrarLog } from "@/lib/dados/estado-operacional";

export const dynamic = "force-dynamic";

/** GET: personalizações de liberação em vigor (perfil × módulo). Exclusivo do Administrador. */
export async function GET() {
  const usuario = await obterSessaoServidor();
  if (!usuario || !canServidor(usuario, "LER", "ADMINISTRACAO")) {
    return NextResponse.json({ sucesso: false, erro: "Acesso não permitido." }, { status: 403 });
  }
  const armazem = carregarArmazemPermissoes();
  return NextResponse.json(
    { sucesso: true, ...armazem },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

/** PUT: grava as liberações. Células bloqueadas (Administrador, módulos exclusivos) são descartadas. */
export async function PUT(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario || !canServidor(usuario, "EDITAR", "ADMINISTRACAO")) {
    return NextResponse.json({ sucesso: false, erro: "Acesso não permitido." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.personalizacoes !== "object") {
    return NextResponse.json({ sucesso: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const anterior = JSON.stringify(carregarArmazemPermissoes().personalizacoes);
  const armazem = salvarPersonalizacoes(body.personalizacoes, usuario);

  try {
    registrarLog(
      "ALTERACAO_PERMISSOES",
      "Liberação de módulos por perfil",
      `Liberações de visualização/exportação por perfil alteradas por ${usuario.nome}.`,
      {
        valorAnterior: anterior,
        valorNovo: JSON.stringify(armazem.personalizacoes),
        usuario: usuario.nome,
        perfil: usuario.perfil,
      }
    );
  } catch {
    // auditoria não deve impedir a gravação
  }

  return NextResponse.json({ sucesso: true, ...armazem });
}
