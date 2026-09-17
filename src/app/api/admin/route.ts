import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/permissoes";
import {
  carregarUsuarios,
  criarUsuario,
  atualizarPerfilUsuario,
  atualizarBasesUsuario,
  alterarStatusUsuario,
  redefinirSenhaLocal,
  excluirUsuario,
  carregarLogsAuditoriaAdmin,
  registrarLogAuditoriaAdmin,
} from "@/lib/auth/usuarios";
import {
  obterParametrosContrato,
  salvarParametrosContrato,
  listarConfiguracoesPendentes,
} from "@/lib/auth/parametros";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const usuario = await obterSessaoServidor();

    // Verificação estrita de autorização no servidor
    if (!usuario || !can(usuario, "LER", "ADMINISTRACAO")) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Acesso não permitido. Módulo restrito ao perfil Administrador Premier.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const secao = searchParams.get("secao");

    const parametros = obterParametrosContrato();
    const pendencias = listarConfiguracoesPendentes(parametros);

    if (secao === "auditoria") {
      const logs = carregarLogsAuditoriaAdmin();
      return NextResponse.json({ sucesso: true, logs });
    }

    if (secao === "parametros") {
      return NextResponse.json({ sucesso: true, parametros, pendencias });
    }

    const usuarios = carregarUsuarios();
    return NextResponse.json({
      sucesso: true,
      usuarios,
      parametros,
      pendencias,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await obterSessaoServidor();

    // Somente PREMIER_ADMIN pode executar ações administrativas
    if (!usuario || !can(usuario, "CRIAR", "ADMINISTRACAO")) {
      return NextResponse.json(
        { sucesso: false, erro: "Acesso não permitido." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { acao } = body;

    if (acao === "CRIAR_USUARIO") {
      const { nome, email, empresa, perfil, tipoConta, basesVinculadas, cargo } = body;
      const novo = criarUsuario(
        {
          nome,
          email,
          empresa: empresa || "Premier Logistics",
          perfil,
          status: "ATIVO",
          tipoConta: tipoConta || "LOCAL",
          basesVinculadas: basesVinculadas || ["TODAS"],
          cargo,
        },
        usuario
      );
      return NextResponse.json({ sucesso: true, usuario: novo });
    }

    if (acao === "EDITAR_PERFIL") {
      const { usuarioId, novoPerfil } = body;
      const atualizado = atualizarPerfilUsuario(usuarioId, novoPerfil, usuario);
      return NextResponse.json({ sucesso: true, usuario: atualizado });
    }

    if (acao === "VINCULAR_BASES") {
      const { usuarioId, novasBases } = body;
      const atualizado = atualizarBasesUsuario(usuarioId, novasBases, usuario);
      return NextResponse.json({ sucesso: true, usuario: atualizado });
    }

    if (acao === "ALTERAR_STATUS") {
      const { usuarioId, novoStatus } = body;
      const atualizado = alterarStatusUsuario(usuarioId, novoStatus, usuario);
      return NextResponse.json({ sucesso: true, usuario: atualizado });
    }

    if (acao === "REDEFINIR_SENHA") {
      const { usuarioId } = body;
      const resultado = redefinirSenhaLocal(usuarioId, usuario);
      return NextResponse.json({ sucesso: true, resultado });
    }

    if (acao === "EXCLUIR_USUARIO") {
      const { usuarioId } = body;
      excluirUsuario(usuarioId, usuario);
      return NextResponse.json({ sucesso: true, mensagem: "Usuário removido com sucesso." });
    }

    if (acao === "SALVAR_PARAMETROS") {
      const { fatorGlosa, prazoFechamento, metaSla } = body;
      const paramsAnteriores = obterParametrosContrato();

      const atualizado = salvarParametrosContrato(
        {
          fatorGlosa: fatorGlosa !== undefined ? fatorGlosa : paramsAnteriores.fatorGlosa,
          prazoFechamento: prazoFechamento !== undefined ? prazoFechamento : paramsAnteriores.prazoFechamento,
          metaSla: metaSla !== undefined ? Number(metaSla) : paramsAnteriores.metaSla,
        },
        usuario.nome
      );

      registrarLogAuditoriaAdmin(
        usuario,
        "ALTERAR_PARAMETROS_CONTRATO",
        "PARAMETRO_CONTRATO",
        "param-contrato-icj",
        "Atualização de parâmetros contratuais (glosa e prazo de fechamento)",
        `Glosa: ${paramsAnteriores.fatorGlosa ?? "NÃO CADASTRADO"} | Prazo: ${paramsAnteriores.prazoFechamento ?? "NÃO CADASTRADO"}`,
        `Glosa: ${atualizado.fatorGlosa ?? "NÃO CADASTRADO"} | Prazo: ${atualizado.prazoFechamento ?? "NÃO CADASTRADO"}`
      );

      return NextResponse.json({ sucesso: true, parametros: atualizado });
    }

    return NextResponse.json({ sucesso: false, erro: "Ação não reconhecida." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro na operação administrativa";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 400 });
  }
}
