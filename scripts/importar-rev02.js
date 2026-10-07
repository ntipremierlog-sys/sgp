const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function executarImportacao(caminhoExcel, usuario = 'Sistema SGP') {
  console.log('Iniciando importação de:', caminhoExcel);
  if (!fs.existsSync(caminhoExcel)) {
    throw new Error(`Arquivo não encontrado: ${caminhoExcel}`);
  }

  const wb = XLSX.readFile(caminhoExcel);

  // ---------------------------------------------------------------------------
  // Passo 1 — Regras estruturais (aba 06_REGRAS_ESTRUTURA)
  // ---------------------------------------------------------------------------
  const catalogoTiposPosto = [
    {
      id: 'ADM_09H',
      nome: 'Adm/09h',
      posicoesPorPosto: 1,
      statusPremissa: 'fechada',
      regraCadastro: '1 posto = 1 posição',
      observacao: 'Não inferir nova posição por troca de empregado.',
    },
    {
      id: 'ADM_12H',
      nome: 'Adm/12h',
      posicoesPorPosto: 2,
      statusPremissa: 'fechada',
      regraCadastro: '1 posto = 2 posições',
      observacao: 'Pessoas diferentes no período não aumentam a estrutura.',
    },
    {
      id: 'TURNO_12H',
      nome: 'Turno/12h',
      posicoesPorPosto: 2,
      statusPremissa: 'fechada',
      regraCadastro: '1 posto = 2 posições',
      observacao: 'Pessoas diferentes no período não aumentam a estrutura.',
    },
    {
      id: 'ADM_16H',
      nome: 'Adm/16h',
      posicoesPorPosto: 2,
      statusPremissa: 'a confirmar',
      regraCadastro: 'Premissa: 1 posto = 2 posições',
      observacao: 'Confirmar a regra operacional antes da carga definitiva.',
    },
    {
      id: 'TURNO_16H',
      nome: 'Turno/16h',
      posicoesPorPosto: 2,
      statusPremissa: 'a confirmar',
      regraCadastro: 'Premissa: 1 posto = 2 posições',
      observacao: 'Confirmar a regra operacional antes da carga definitiva.',
      excecoes: {
        'CABIUNAS': 4,
        'PST-CABIUNAS-010': 4,
      },
    },
    {
      id: 'TURNO_24H',
      nome: 'Turno/24h',
      posicoesPorPosto: 4,
      statusPremissa: 'fechada',
      regraCadastro: '1 posto = 4 posições',
      observacao: 'Ferista, férias, substituição ou sucessão não criam 5ª posição.',
    },
  ];

  function obterRegraTipo(postoDeServico, unidade, postoIdSGP) {
    const p = String(postoDeServico || '').trim();
    const u = String(unidade || '').trim().toUpperCase();

    if (p.includes('Turno/24h')) return { tipoId: 'TURNO_24H', tipoNome: 'Turno/24h', qtd: 4 };
    if (p.includes('Turno/16h')) {
      const ehCabiunas = u.includes('CABI') || postoIdSGP === 'PST-CABIUNAS-010';
      return { tipoId: 'TURNO_16H', tipoNome: 'Turno/16h', qtd: ehCabiunas ? 4 : 2, excecao: ehCabiunas };
    }
    if (p.includes('Adm/16h')) return { tipoId: 'ADM_16H', tipoNome: 'Adm/16h', qtd: 2 };
    if (p.includes('Turno/12h')) return { tipoId: 'TURNO_12H', tipoNome: 'Turno/12h', qtd: 2 };
    if (p.includes('Adm/12h')) return { tipoId: 'ADM_12H', tipoNome: 'Adm/12h', qtd: 2 };
    if (p.includes('Adm/09h')) return { tipoId: 'ADM_09H', tipoNome: 'Adm/09h', qtd: 1 };

    // Fallback padrão para apoios de engenharia sem string explícita de regime
    return { tipoId: 'ADM_09H', tipoNome: 'Adm/09h', qtd: 1 };
  }

  // ---------------------------------------------------------------------------
  // Passo 2 — Postos (aba 02_POSTOS)
  // ---------------------------------------------------------------------------
  const postosSheet = XLSX.utils.sheet_to_json(wb.Sheets['02_POSTOS']);
  const postos = postosSheet.map((row) => {
    const regra = obterRegraTipo(row.Posto_de_Servico, row.Unidade, row.Posto_ID_SGP);
    return {
      postoIdSGP: String(row.Posto_ID_SGP).trim(),
      idReferencia: row.Posto_Base,
      unidade: String(row.Unidade || '').trim(),
      itemPPU: String(row.Item_PPU || '').trim(),
      postoDeServico: String(row.Posto_de_Servico || '').trim(),
      nomenclaturaSugerida: String(row.Nomenclatura_Sugerida || '').trim(),
      municipio: String(row.Municipio || '').trim(),
      gerencia: String(row.Gerencia || '').trim(),
      periculosidade: String(row.Periculosidade || 'NÃO').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NÃO',
      tipoPostoId: regra.tipoId,
      tipoPostoNome: regra.tipoNome,
      qtdEstruturalPremissa: Number(row.Qtd_Estrutural_Premissa || regra.qtd),
      qtdPosicoesIDObservadas: Number(row.Qtd_Posicoes_ID_Observadas || 0),
      qtdAlocacoesMC: Number(row.Qtd_Alocacoes_MC || 0),
      statusEstrutura: String(row.Status_Estrutura || 'COERENTE COM A REGRA').trim(),
      observacaoEstrutura: String(row.Observacao_Estrutura || '').trim(),
    };
  });

  const postosMap = new Map();
  postos.forEach((p) => postosMap.set(p.postoIdSGP, p));

  // ---------------------------------------------------------------------------
  // Passo 3 — Posições (aba 03_POSICOES)
  // Regra: A quantidade de posições de cada posto segue a regra do Passo 1,
  // NÃO a quantidade de pessoas. Nenhum posto com mais posições do que a regra.
  // ---------------------------------------------------------------------------
  const posicoesSheet = XLSX.utils.sheet_to_json(wb.Sheets['03_POSICOES']);
  
  // Mapa das linhas originais da aba 03_POSICOES
  const posicoesPlanilhaMap = new Map();
  posicoesSheet.forEach((row) => {
    posicoesPlanilhaMap.set(String(row.Posicao_ID_SGP).trim(), row);
  });

  // Gerar as posições estruturais conforme a regra para cada um dos 244 postos
  const posicoes = [];
  const conflitosPosicoes = [];
  const posicoesExcedentesNaoCriadas = [];

  postos.forEach((posto) => {
    const qtdEsperada = posto.qtdEstruturalPremissa;

    for (let s = 1; s <= qtdEsperada; s++) {
      const sufixoPad = String(s).padStart(2, '0');
      const prefixoPos = posto.postoIdSGP.replace(/^PST-/, 'POS-');
      const posicaoIdSGP = `${prefixoPos}-${sufixoPad}`;
      
      // Procura se existia linha correspondente na aba 03_POSICOES
      const rowOriginal = posicoesPlanilhaMap.get(posicaoIdSGP);

      let codigoVisual = `${posto.idReferencia}.${s}`;
      let conflitoCadastro = 'OK';
      let motivoConflito = '';
      let tratamentoSGP = 'POSIÇÃO ESTRUTURAL';
      let observacoes = `Regra estrutural: ${qtdEsperada} posição(ões) para o posto.`;
      let statusValidacao = 'VALIDADA';

      if (rowOriginal) {
        codigoVisual = String(rowOriginal.ID_Luiz_Original || codigoVisual).trim();
        conflitoCadastro = String(rowOriginal.Conflito_Cadastro || 'OK').trim();
        motivoConflito = String(rowOriginal.Motivo_Conflito || rowOriginal.Observacao_Revisao_Estrutural || '').trim();
        tratamentoSGP = String(rowOriginal.Tratamento_SGP || tratamentoSGP).trim();
        observacoes = String(rowOriginal.Observacao_Revisao_Estrutural || observacoes).trim();
        statusValidacao = String(rowOriginal.Posicao_Estrutural_Validada || 'A VALIDAR').trim();

        if (conflitoCadastro !== 'OK') {
          statusValidacao = 'A VALIDAR';
          conflitosPosicoes.push({
            posicaoIdSGP,
            postoIdSGP: posto.postoIdSGP,
            codigoVisual,
            conflitoCadastro,
            motivoConflito,
            tratamentoSGP,
          });
        }
      } else {
        // Posição que faltava na aba 03_POSICOES para completar a regra (ex.: POS-BOAVENTURA-007-04)
        statusValidacao = 'A VALIDAR';
        tratamentoSGP = 'POSIÇÃO GERADA POR REGRA ESTRUTURAL';
        observacoes = `Gerada para atender à premissa de ${qtdEsperada} posições do posto. Requer validação operacional.`;
        conflitosPosicoes.push({
          posicaoIdSGP,
          postoIdSGP: posto.postoIdSGP,
          codigoVisual,
          conflitoCadastro: 'COMPLEMENTAÇÃO ESTRUTURAL',
          motivoConflito: 'Posição gerada por regra para fechar a quantidade estrutural exigida.',
          tratamentoSGP,
        });
      }

      posicoes.push({
        posicaoIdSGP,
        postoIdSGP: posto.postoIdSGP,
        postoBase: posto.idReferencia,
        codigoVisual,
        sufixo: s,
        conflitoCadastro,
        motivoConflito,
        tratamentoSGP,
        observacoes,
        statusValidacao,
        ehEstrutural: true,
      });
    }
  });

  // Mapear também as linhas excedentes (ex.: sufixo 5 nos postos de 4 vagas)
  // que NÃO viram posições estruturais conforme a regra
  posicoesSheet.forEach((row) => {
    const enquadramento = String(row.Enquadramento_ID_Observado || '').trim();
    if (enquadramento === 'EXCEDE A ESTRUTURA ESPERADA') {
      posicoesExcedentesNaoCriadas.push({
        posicaoIdSGP: String(row.Posicao_ID_SGP).trim(),
        postoIdSGP: String(row.Posto_ID_SGP).trim(),
        codigoVisual: String(row.ID_Luiz_Original || '').trim(),
        sufixo: Number(row.Sufixo || 5),
        colaboradoresAssociados: String(row.Colaboradores_Associados || '').trim(),
        conflitoCadastro: 'EXCEDE A ESTRUTURA',
        motivoConflito: 'Excede a premissa de 4 posições por posto de 24h. Registro tratado como alocação/substituição.',
        tratamentoSGP: String(row.Tratamento_SGP || 'NÃO CRIAR POSIÇÃO EXTRA AUTOMATICAMENTE').trim(),
        observacoes: String(row.Observacao_Revisao_Estrutural || '').trim(),
        statusValidacao: 'A VALIDAR',
        ehEstrutural: false,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Passo 4 — Alocações (aba 01_MAPA_CADASTRO)
  // Cada linha vira uma alocação vinculada a uma posição existente.
  // ---------------------------------------------------------------------------
  const alocacoesSheet = XLSX.utils.sheet_to_json(wb.Sheets['01_MAPA_CADASTRO']);
  
  // Mapeamento de vagas ativas por posto
  const posicoesValidasSet = new Set(posicoes.map((p) => p.posicaoIdSGP));
  
  const alocacoes = alocacoesSheet.map((row) => {
    const alocId = String(row.Alocacao_ID_SGP).trim();
    const postoId = String(row.Posto_ID_SGP).trim();
    let posId = String(row.Posicao_ID_SGP).trim();
    const posOriginalPlanilha = posId;

    let foiRealocadaParaExistente = false;

    // Se a posição referenciada na planilha não existe (porque excedia a regra),
    // vincula à posição 01 do respectivo posto conforme a regra do Passo 4:
    // "Ferista, substituto e sucessor NUNCA criam posição nova: entram como alocação na posição existente."
    if (!posicoesValidasSet.has(posId)) {
      posId = `${postoId.replace(/^PST-/, 'POS-')}-01`;
      foiRealocadaParaExistente = true;
    }

    const chapaRaw = String(row.Chapa_RM || '').trim();
    const chapaRM = chapaRaw && chapaRaw !== 'null' && chapaRaw !== 'undefined'
      ? chapaRaw.padStart(6, '0')
      : '';

    const tipoAlocRaw = String(row.Tipo_Alocacao_Sugerido || 'TITULAR/REGULAR').trim().toUpperCase();

    // Data de início e fim padrão para o ciclo base da MC (agosto/setembro)
    let dataInicio = '2026-08-10';
    let dataFim = null;

    if (tipoAlocRaw === 'FERISTA' || tipoAlocRaw === 'SUBSTITUTO') {
      dataFim = '2026-09-09';
    }

    return {
      alocacaoIdSGP: alocId,
      posicaoIdSGP: posId,
      posicaoOriginalPlanilha: posOriginalPlanilha,
      postoIdSGP: postoId,
      chapaRM,
      identificadorPetrobras: String(row.Identificador_MC || '').trim(),
      nome: String(row.Colaborador || '').trim(),
      statusRM: String(row.Status_RM || 'Ativo').trim(),
      funcao: String(row.Funcao_RM || row.Posto_de_Servico || '').trim(),
      horarioRM: String(row.Horario_RM || '').trim(),
      unidadeRM: String(row.Unidade_RM || '').trim(),
      unidadeConfere: String(row.Unidade_Confere || 'SIM').trim(),
      tipoAlocacao: tipoAlocRaw,
      incluirNoSGP: String(row.Incluir_no_SGP_Sugerido || 'SIM').trim(),
      disponibilidadeDiasMC: Number(row.Disponibilidade_Dias_MC || 0),
      diasAusenciaMC: Number(row.Dias_Ausencia_MC || 0),
      comentarioMC: String(row.Comentario_MC || '').trim(),
      dataInicio,
      dataFim,
      statusMapeamento: String(row.Status_Mapeamento_Posicao || 'MAPEAMENTO PROVISÓRIO COERENTE').trim(),
      observacaoRevisao: String(row.Observacao_Revisao_Estrutural || '').trim(),
      statusValidacao: foiRealocadaParaExistente || row.ID_Luiz_Duplicado === 'SIM' ? 'A VALIDAR' : 'OK',
    };
  });

  // ---------------------------------------------------------------------------
  // Passo 5 — Pendências (04_PENDENTES_RM e 05_VALIDACOES)
  // ---------------------------------------------------------------------------
  const pendentesRMSheet = XLSX.utils.sheet_to_json(wb.Sheets['04_PENDENTES_RM']);
  const pendentesRM = pendentesRMSheet.map((row) => ({
    chapa: String(row.Chapa || '').trim().padStart(6, '0'),
    nome: String(row.Nome || '').trim(),
    statusRM: String(row.Status_RM || 'Ativo').trim(),
    dataAdmissao: row.Data_Admissao,
    unidadeRM: String(row.Unidade_RM || '').trim(),
    funcaoRM: String(row.Funcao_RM || '').trim(),
    horarioRM: String(row.Horario_RM || '').trim(),
    motivo: String(row.Motivo || 'Admissão posterior ao fim da MC-base (09/09/2026); necessita alocação inicial no SGP.').trim(),
    alocarNoSGP: String(row.Alocar_no_SGP || 'A VALIDAR').trim(),
  }));

  const validacoesSheet = XLSX.utils.sheet_to_json(wb.Sheets['05_VALIDACOES']);
  const validacoes = validacoesSheet.map((row, idx) => ({
    id: `VAL-${String(idx + 1).padStart(4, '0')}`,
    prioridade: String(row.Prioridade || 'MÉDIA').trim().toUpperCase(),
    tipo: String(row.Tipo || '').trim(),
    unidade: String(row.Unidade || '').trim(),
    referencia: String(row.Referencia || '').trim(),
    colaboradores: String(row.Colaborador_es || '').trim(),
    achado: String(row.Achado || '').trim(),
    acaoRecomendada: String(row.Acao_Recomendada || '').trim(),
    responsavel: String(row.Responsavel_Sugerido || 'Luiz').trim(),
    status: String(row.Status || 'A VALIDAR').trim(),
  }));

  // ---------------------------------------------------------------------------
  // Passo 6 — Regras de segurança e Registro de Importação
  // ---------------------------------------------------------------------------
  const registroCarga = {
    arquivo: path.basename(caminhoExcel),
    dataImportacao: new Date().toISOString(),
    usuario,
    versao: 'REV02',
    totalPostos: postos.length,
    totalPosicoesEstruturais: posicoes.length,
    totalPosicoesExcedentesPlanilha: posicoesExcedentesNaoCriadas.length,
    totalAlocacoes: alocacoes.length,
    totalPendentesRM: pendentesRM.length,
    totalValidacoes: validacoes.length,
    totalConflitosAValidar: conflitosPosicoes.length + posicoesExcedentesNaoCriadas.length,
    resumoPorTipoPosto: catalogoTiposPosto.map((tipo) => {
      const postosDoTipo = postos.filter((p) => p.tipoPostoId === tipo.id);
      const somaPosicoes = postosDoTipo.reduce((acc, p) => acc + p.qtdEstruturalPremissa, 0);
      return {
        tipoId: tipo.id,
        nome: tipo.nome,
        posicoesPorPosto: tipo.posicoesPorPosto,
        statusPremissa: tipo.statusPremissa,
        totalPostos: postosDoTipo.length,
        totalPosicoes: somaPosicoes,
      };
    }),
  };

  return {
    catalogoTiposPosto,
    postos,
    posicoes,
    posicoesExcedentesNaoCriadas,
    alocacoes,
    pendentesRM,
    validacoes,
    conflitosPosicoes,
    registroCarga,
  };
}

if (require.main === module) {
  const caminhoExcel = path.join(__dirname, '..', 'Base_Estruturada_SGP_Petrobras_REV02.xlsx');
  const resultado = executarImportacao(caminhoExcel);

  console.log('\n--- RESULTADO DA IMPORTAÇÃO REV02 ---');
  console.log('Total Postos:', resultado.postos.length);
  console.log('Total Posições Estruturais:', resultado.posicoes.length);
  console.log('Total Posições Excedentes (NÃO criadas conforme regra):', resultado.posicoesExcedentesNaoCriadas.length);
  console.log('Total Alocações:', resultado.alocacoes.length);
  console.log('Total Pendentes RM:', resultado.pendentesRM.length);
  console.log('Total Validações:', resultado.validacoes.length);
  console.log('Total Conflitos A VALIDAR:', resultado.registroCarga.totalConflitosAValidar);

  const pastaDados = path.join(__dirname, '..', 'src', 'lib', 'dados');
  if (!fs.existsSync(pastaDados)) fs.mkdirSync(pastaDados, { recursive: true });

  fs.writeFileSync(path.join(pastaDados, 'postos-rev02.json'), JSON.stringify(resultado.postos, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'posicoes-rev02.json'), JSON.stringify(resultado.posicoes, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'posicoes-excedentes-rev02.json'), JSON.stringify(resultado.posicoesExcedentesNaoCriadas, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'alocacoes-rev02.json'), JSON.stringify(resultado.alocacoes, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'pendentes-rm-rev02.json'), JSON.stringify(resultado.pendentesRM, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'validacoes-rev02.json'), JSON.stringify(resultado.validacoes, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'registro-carga-rev02.json'), JSON.stringify(resultado.registroCarga, null, 2));
  fs.writeFileSync(path.join(pastaDados, 'catalogo-tipos-posto-rev02.json'), JSON.stringify(resultado.catalogoTiposPosto, null, 2));

  console.log('\nArquivos JSON gerados com sucesso em src/lib/dados/!');
}

module.exports = { executarImportacao };
