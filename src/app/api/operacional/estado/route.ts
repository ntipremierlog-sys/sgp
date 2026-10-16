import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import {
  obterPostos,
  obterPosicoes,
  obterFeristas,
  obterProfissionais,
  obterAlocacoes,
  obterOcorrencias,
  obterCoberturas,
  obterApontamentos,
  obterPareceresVigentes,
  obterImoveis,
} from "@/lib/repositorio";
import { competenciaDaData } from "@/lib/servicos/periodo-competencia";
import { vincularTitularesPosicoes } from "@/lib/repositorio/vinculo-titular";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessao = await obterSessaoServidor();
    const perfil = sessao?.perfil || "PETROBRAS_FISCAL";

    const { searchParams } = new URL(request.url);
    const imovel = searchParams.get("imovel") || undefined;
    const competencia = searchParams.get("competencia") || undefined;
    const periodoInicio = searchParams.get("periodoInicio") || undefined;
    const periodoFim = searchParams.get("periodoFim") || undefined;

    const filtroImovel = imovel && imovel !== "TODOS" ? imovel : undefined;

    // Buscar dados em paralelo no banco Neon
    const [
      imoveisDb,
      postosDb,
      posicoesDb,
      profissionaisDb,
      alocacoesDb,
      feristasDb,
      ocorrenciasDb,
      coberturasDb,
      apontamentosDb,
      pareceresDb,
    ] = await Promise.all([
      obterImoveis(),
      obterPostos({ imovelNome: filtroImovel }),
      obterPosicoes({ imovelNome: filtroImovel }),
      obterProfissionais(),
      obterAlocacoes(),
      obterFeristas(),
      obterOcorrencias({
        imovelNome: filtroImovel,
        periodoInicio,
        periodoFim,
        perfilUsuario: perfil,
      }),
      obterCoberturas({
        imovelNome: filtroImovel,
        periodoInicio,
        periodoFim,
      }),
      obterApontamentos({
        imovelNome: filtroImovel,
        periodoInicio,
        periodoFim,
      }),
      obterPareceresVigentes({ competencia }),
    ]);

    // Mapeamento de Pareceres por registroId
    const mapaPareceres = new Map<string, typeof pareceresDb[0]>();
    for (const p of pareceresDb) {
      mapaPareceres.set(`${p.registroId}:${p.previaNumero}`, p);
      mapaPareceres.set(p.registroId, p);
    }

    // 1. Postos
    const postos = postosDb.map((p) => {
      const escala = p.escala === "ESCALA_12X36" ? "12x36" : (p.escala === "ESCALA_6X1" ? "6x1" : "5x2");
      return {
        id: p.postoIdSgp || p.id,
        idPosto: p.codigoPosto,
        postoIdSGP: p.postoIdSgp || undefined,
        codigoPosto: p.codigoPosto,
        funcao: p.funcao,
        descricao: p.descricao || undefined,
        itemPPU: p.itemPpuCodigo || "1.1",
        tipoPostoId: p.regimePosto?.codigo || p.regime || "ADM_09H",
        tipoPostoNome: p.regimePosto?.nome || p.regime || "Adm/09h",
        periculosidade: (p.periculosidade || "NÃO") as "SIM" | "NÃO",
        periculosidadeBooleana: p.periculosidade === "SIM",
        municipio: p.imovel?.cidade || p.unidade.municipio,
        localAtuacao: p.imovel?.nome || p.unidade.nome,
        baseOperacional: p.imovel?.nome || p.unidade.nome,
        unidade: p.imovel?.nome || p.unidade.nome,
        unidadeNome: p.unidade.nome,
        gerenciaPetrobras: p.imovel?.gerencia || "COMPARTILHADO/GIO",
        gerencia: p.imovel?.gerencia || "COMPARTILHADO/GIO",
        escala,
        jornadaSemanalHoras: Number(p.jornadaSemanalHoras || 44),
        horarioInicio: p.horarioInicio || "07:00",
        horarioFim: p.horarioFim || "16:48",
        situacao: p.situacao as "ATIVO" | "SUSPENSO" | "ENCERRADO",
        qtdEstruturalConfirmada: p.qtdPosicoes || 1,
        qtdPosicoesIDObservadas: p.posicoes.length,
      };
    });

    // 2. Posições (Vagas)
    const vagas = posicoesDb.map((pos) => {
      return {
        id: pos.posicaoIdSgp,
        posicaoIdSGP: pos.posicaoIdSgp,
        idPosto: pos.posto.codigoPosto,
        postoIdSGP: pos.posto.postoIdSgp || undefined,
        postoBase: pos.posto.codigoPosto,
        sequencia: pos.sufixo,
        sufixo: pos.sufixo,
        numeroPosicao: pos.sufixo,
        codigoPosicaoEstrutural: pos.codigoEstrutural || undefined,
        idOriginalMC: pos.idOriginalMc || undefined,
        chapaTitular: pos.chapaTitular || undefined,
        titularReferencia: pos.nomeTitular || undefined,
        statusRMTitular: pos.situacaoRm || undefined,
        statusValidacao: pos.statusValidacao || "VALIDADA",
        conflitoCadastro: pos.conflitoCadastro || undefined,
        ehEstrutural: pos.ehEstrutural,
        ehVaga: pos.escalaPendente || !pos.chapaTitular,
        posicaoSemTitularMC: !pos.chapaTitular ? "SIM" : undefined,
        itemPPU: pos.posto.itemPpuCodigo || "1.1",
        postoDeServico: pos.posto.funcao,
        unidade: pos.posto.imovel?.nome || pos.posto.unidade.nome,
        horario_rm: pos.horarioRm || undefined,
        horarioRm: pos.horarioRm || undefined,
        escala_tipo: pos.escalaTipo || undefined,
        escalaTipo: pos.escalaTipo || undefined,
        faixa_horaria: pos.faixaHoraria || undefined,
        faixaHoraria: pos.faixaHoraria || undefined,
        regime_dias: pos.regimeDias || undefined,
        regimeDias: pos.regimeDias || undefined,
        grupo_revezamento: pos.grupoRevezamento || undefined,
        grupoRevezamento: pos.grupoRevezamento || undefined,
        data_base_escala: pos.dataBaseEscala ? pos.dataBaseEscala.toISOString().slice(0, 10) : undefined,
        dataBaseEscala: pos.dataBaseEscala ? pos.dataBaseEscala.toISOString().slice(0, 10) : undefined,
        fase_ciclo: pos.faseCiclo || undefined,
        faseCiclo: pos.faseCiclo || undefined,
        fonte_escala: pos.fonteEscala || undefined,
        fonteEscala: pos.fonteEscala || undefined,
        status_programacao: pos.statusProgramacao || undefined,
        statusProgramacao: pos.statusProgramacao || undefined,
      };
    });

    // 3. Profissionais
    const profissionais = profissionaisDb.map((prof) => {
      const escala = prof.escalaPadrao === "ESCALA_12X36" ? "12x36" : (prof.escalaPadrao === "ESCALA_6X1" ? "6x1" : "5x2");
      return {
        id: prof.id,
        chapa: prof.matricula,
        matricula: prof.matricula,
        nome: prof.nome,
        cpfLimpo: prof.cpf,
        funcao: prof.funcao,
        unidadeId: prof.unidade.codigo,
        unidadeNome: prof.unidade.nome,
        escala,
        situacao: prof.situacao as "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO",
        dataAdmissao: prof.dataAdmissao.toISOString().slice(0, 10),
        dataDesligamento: prof.dataDesligamento ? prof.dataDesligamento.toISOString().slice(0, 10) : null,
      };
    });

    // 4. Alocações
    // Vínculo posição → titular (fonte única, igual à Conferência): vagaId = posicao_id_sgp.
    const alocacoes = vincularTitularesPosicoes(
      posicoesDb.map((pos) => ({
        posicaoIdSgp: pos.posicaoIdSgp,
        postoId: pos.postoId,
        postoIdSgp: pos.posto.postoIdSgp,
        codigoPosto: pos.posto.codigoPosto,
        sufixo: pos.sufixo,
        chapaTitular: pos.chapaTitular,
        nomeTitular: pos.nomeTitular,
        horarioRm: pos.horarioRm,
      })),
      alocacoesDb.map((aloc) => ({
        id: aloc.id,
        postoId: aloc.postoId,
        postoIdSgp: aloc.posto.postoIdSgp,
        codigoPosto: aloc.posto.codigoPosto,
        matricula: aloc.profissional.matricula,
        nome: aloc.profissional.nome,
        tipo: aloc.tipo,
        dataInicio: aloc.dataInicio,
        dataFim: aloc.dataFim,
        motivoMovimentacao: aloc.motivoMovimentacao,
        documentoReferencia: aloc.documentoReferencia,
      }))
    ).alocacoes;

    // 5. Ocorrências (com pareceres vigentes acoplados e LGPD)
    const ocorrencias = ocorrenciasDb.map((oc) => {
      const parecer = mapaPareceres.get(oc.id);
      return {
        id: oc.id,
        matricula: oc.profissional.matricula,
        profissionalNome: oc.profissional.nome,
        postoCodigo: oc.posto?.postoIdSgp || oc.posto?.codigoPosto,
        tipoOcorrencia: oc.tipoOcorrencia.codigo as any,
        dataInicio: oc.dataInicio.toISOString().slice(0, 10),
        dataFim: oc.dataFim.toISOString().slice(0, 10),
        diasAfetados: oc.diasUteisAfetados,
        status: oc.status as any,
        observacaoPublica: oc.observacaoPublica || oc.tipoOcorrencia.rotuloPublico,
        substituicao_aprovada: oc.substituicaoAprovada,
        substituto_chapa: oc.substitutoChapa || undefined,
        previaConferencia: parecer ? `Prévia ${parecer.previaNumero}` : undefined,
        statusConferenciaPosto: parecer?.status || undefined,
        comentarioConferencia: parecer?.comentario || undefined,
        dadoSensivel: oc.dadoSensivel ? {
          cid: oc.dadoSensivel.cid || undefined,
          descricaoClinica: oc.dadoSensivel.descricaoClinica || undefined,
          profissionalEmissor: oc.dadoSensivel.profissionalEmissor || undefined,
        } : undefined,
      };
    });

    // 6. Coberturas (com pareceres vigentes acoplados)
    const coberturas = coberturasDb.map((cob) => {
      const parecer = mapaPareceres.get(cob.id);
      return {
        id: cob.id,
        postoCodigo: cob.posto.postoIdSgp || cob.posto.codigoPosto,
        idPosto: cob.posto.codigoPosto,
        posicaoIdSGP: cob.posicao?.posicaoIdSgp || undefined,
        funcaoPosto: cob.posto.funcao,
        itemPpu: cob.itemPpuCodigo || cob.posto.itemPpuCodigo || "1.1",
        titularMatricula: cob.ocorrencia?.profissional?.matricula || undefined,
        titularNome: cob.ocorrencia?.profissional?.nome || undefined,
        substitutoMatricula: cob.profissionalSubstituto.matricula,
        substitutoNome: cob.profissionalSubstituto.nome,
        dataInicio: cob.dataInicio.toISOString().slice(0, 10),
        dataFim: cob.dataFim.toISOString().slice(0, 10),
        tipoCobertura: cob.tipoCobertura as any,
        status: cob.status as any,
        justificativa: cob.justificativa || "",
        ocorrenciaId: cob.ocorrenciaId || undefined,
        criadoEm: cob.criadoEm.toISOString(),
        previaConferencia: parecer ? `Prévia ${parecer.previaNumero}` : undefined,
        statusConferenciaPosto: parecer?.status || undefined,
        comentarioConferencia: parecer?.comentario || undefined,
      };
    });

    // 7. Apontamentos
    const apontamentos = apontamentosDb.map((apt) => {
      const dataRef = apt.periodoInicio.toISOString().slice(0, 10);
      return {
        id: apt.id,
        postoCodigo: apt.posto?.postoIdSgp || apt.posto?.codigoPosto || "",
        idPosto: apt.posto?.codigoPosto || undefined,
        funcaoPosto: apt.posto?.funcao || "Operacional",
        dataReferencia: dataRef,
        competencia: competenciaDaData(dataRef),
        texto: apt.texto,
        criadoPor: apt.criadoPor,
        dataCriacao: apt.criadoEm.toISOString().replace("T", " ").slice(0, 16),
        status: apt.status as any,
        respostaPremier: apt.respostaPremier || undefined,
        respondidoPor: apt.respondidoPor || undefined,
        respondidoEm: apt.respondidoEm ? apt.respondidoEm.toISOString().replace("T", " ").slice(0, 16) : undefined,
      };
    });

    // 8. Feristas
    const feristas = feristasDb.map((fer) => {
      return {
        feristaIdSGP: fer.id,
        postoIdSGP: fer.posto.postoIdSgp || fer.posto.codigoPosto,
        colaborador: fer.nome,
        nome: fer.nome,
        chapaRM: fer.chapa,
        matricula: fer.chapa,
        statusRM: fer.situacaoRm || "Ativo",
        unidade: fer.posto.imovel?.nome || fer.posto.unidade.nome,
        unidadeId: fer.posto.unidadeId,
        observacoes: fer.observacoes || "",
        ativo: fer.ativo,
      };
    });

    return NextResponse.json({
      sucesso: true,
      perfil,
      estado: {
        imoveis: imoveisDb.map((i) => i.nome),
        postos,
        vagas,
        profissionais,
        alocacoes,
        feristas,
        ocorrencias,
        coberturas,
        apontamentos,
      },
    });
  } catch (erro: any) {
    console.error("Erro na API /api/operacional/estado:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao carregar estado operacional." },
      { status: 500 }
    );
  }
}
