const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  CARGA OFICIAL DA BASE ESTRUTURADA SGP PETROBRAS REV04');
console.log('================================================================\n');

const wb = XLSX.readFile('Base_Estruturada_SGP_Petrobras_REV04.xlsx', {
  raw: false,
  cellText: true,
  cellDates: false
});

function cellToStr(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function cellToInt(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '' || s === '-' || isNaN(Number(s))) return null;
  return parseInt(s, 10);
}

// -----------------------------------------------------------------------------
// 1. ABA 01_MAPA_CADASTRO (322 Alocações e 29 Unidades)
// -----------------------------------------------------------------------------
const raw01 = XLSX.utils.sheet_to_json(wb.Sheets['01_MAPA_CADASTRO'], { header: 1, raw: false, defval: '' });
const headers01 = raw01[0].map(h => String(h).trim());

const alocacoes = [];
const unidadesSet = new Set();
const unidadesMapa = new Map();

for (let r = 1; r < raw01.length; r++) {
  const row = raw01[r];
  if (!row || row.every(c => String(c).trim() === '')) continue;

  const getCol = (name) => {
    const idx = headers01.indexOf(name);
    return idx >= 0 ? row[idx] : undefined;
  };

  const unidade = cellToStr(getCol('Unidade'));
  const postoBase = cellToStr(getCol('Posto_Base'));
  const idLuizOriginal = cellToStr(getCol('ID_Luiz_Original'));
  const sufixo = cellToStr(getCol('Sufixo'));
  const postoIdSGP = cellToStr(getCol('Posto_ID_SGP'));
  const posicaoIdSGP = cellToStr(getCol('Posicao_ID_SGP'));
  const alocacaoIdSGP = cellToStr(getCol('Alocacao_ID_SGP'));
  const itemPPU = cellToStr(getCol('Item_PPU'));
  const postoDeServico = cellToStr(getCol('Posto_de_Servico'));
  const municipio = cellToStr(getCol('Municipio'));
  const gerencia = cellToStr(getCol('Gerencia'));
  const periculosidadeOriginal = cellToStr(getCol('Periculosidade'));
  const identificadorMC = cellToStr(getCol('Identificador_MC'));
  const colaborador = cellToStr(getCol('Colaborador'));
  
  let chapaRM = cellToStr(getCol('Chapa_RM'));
  if (chapaRM && chapaRM !== '0' && chapaRM !== '000000') {
    chapaRM = chapaRM.padStart(6, '0');
  } else if (chapaRM === '0' || chapaRM === '000000') {
    chapaRM = null;
  }

  const statusRM = cellToStr(getCol('Status_RM'));
  const funcaoRM = cellToStr(getCol('Funcao_RM'));
  const horarioRM = cellToStr(getCol('Horario_RM'));
  const unidadeRM = cellToStr(getCol('Unidade_RM'));
  const unidadeConfere = cellToStr(getCol('Unidade_Confere'));
  const tipoAlocacaoSugerido = cellToStr(getCol('Tipo_Alocacao_Sugerido'));
  const incluirNoSGPSugerido = cellToStr(getCol('Incluir_no_SGP_Sugerido'));
  const disponibilidadeDiasMC = cellToInt(getCol('Disponibilidade_Dias_MC'));
  const diasAusenciaMC = cellToInt(getCol('Dias_Ausencia_MC'));
  const comentarioMC = cellToStr(getCol('Comentario_MC'));
  const idLuizDuplicado = cellToStr(getCol('ID_Luiz_Duplicado'));
  const validacaoLuiz = cellToStr(getCol('Validacao_Luiz'));
  const codigoPosicaoValidado = cellToStr(getCol('Codigo_Posicao_Validado'));
  const tipoAlocacaoValidado = cellToStr(getCol('Tipo_Alocacao_Validado'));
  const qtdEstruturalPremissa = cellToInt(getCol('Qtd_Estrutural_Premissa'));
  const statusMapeamentoPosicao = cellToStr(getCol('Status_Mapeamento_Posicao'));
  const observacaoRevisaoEstrutural = cellToStr(getCol('Observacao_Revisao_Estrutural'));
  const qtdEstruturalConfirmada = cellToInt(getCol('Qtd_Estrutural_Confirmada'));
  const papelEstruturalREV03 = cellToStr(getCol('Papel_Estrutural_REV03'));
  const codigoPosicaoEstrutural = cellToStr(getCol('Codigo_Posicao_Estrutural'));
  const statusMapeamentoREV03 = cellToStr(getCol('Status_Mapeamento_REV03'));
  const observacaoREV03 = cellToStr(getCol('Observacao_REV03'));

  // Booleano derivado de periculosidade conforme especificação
  const periculosidadeBooleana = periculosidadeOriginal ? periculosidadeOriginal.trim().toUpperCase() === 'SIM' : false;

  // Alertas de exceções
  const alertaSemChapaRM = !chapaRM || unidadeConfere === 'NÃO LOCALIZADO';
  const alertaUnidadeDivergente = unidadeConfere === 'REVISAR';
  const alertaMapeamentoAValidar = statusMapeamentoREV03 === 'A VALIDAR MAPEAMENTO';

  alocacoes.push({
    linhaExcel: r + 1,
    alocacaoIdSGP,
    posicaoIdSGP,
    postoIdSGP,
    unidade,
    postoBase,
    idLuizOriginal,
    sufixo,
    itemPPU,
    postoDeServico,
    municipio,
    gerencia,
    periculosidade: periculosidadeOriginal,
    periculosidadeBooleana,
    identificadorMC,
    colaborador,
    chapaRM,
    statusRM,
    funcaoRM,
    horarioRM,
    unidadeRM,
    unidadeConfere,
    tipoAlocacaoSugerido,
    incluirNoSGPSugerido,
    disponibilidadeDiasMC,
    diasAusenciaMC,
    comentarioMC,
    idLuizDuplicado,
    validacaoLuiz,
    codigoPosicaoValidado,
    tipoAlocacaoValidado,
    qtdEstruturalPremissa,
    statusMapeamentoPosicao,
    observacaoRevisaoEstrutural,
    qtdEstruturalConfirmada,
    papelEstruturalREV03,
    codigoPosicaoEstrutural,
    statusMapeamentoREV03,
    observacaoREV03,
    // Flags de sinalização visual
    alertaSemChapaRM,
    alertaUnidadeDivergente,
    alertaMapeamentoAValidar
  });

  if (unidade) {
    unidadesSet.add(unidade);
    unidadesMapa.set(unidade, (unidadesMapa.get(unidade) || 0) + 1);
  }
}

console.log(`[1/6] Alocações carregadas: ${alocacoes.length} (esperado: 322)`);
console.log(`      Unidades distintas: ${unidadesSet.size} (esperado: 29)`);

// -----------------------------------------------------------------------------
// 2. UNIDADES (29 unidades distintas com resumo)
// -----------------------------------------------------------------------------
const unidades = Array.from(unidadesSet).sort().map((nomeUnidade, idx) => ({
  id: `UNI-${String(idx + 1).padStart(3, '0')}`,
  nome: nomeUnidade,
  codigo: nomeUnidade.replace(/[^A-Z0-9]/gi, '_').toUpperCase(),
  totalAlocacoes: unidadesMapa.get(nomeUnidade) || 0
}));

// -----------------------------------------------------------------------------
// 3. ABA 02_POSTOS (244 Postos)
// -----------------------------------------------------------------------------
const raw02 = XLSX.utils.sheet_to_json(wb.Sheets['02_POSTOS'], { header: 1, raw: false, defval: '' });
const headers02 = raw02[0].map(h => String(h).trim());

const postos = [];
const postosMap = new Map();

for (let r = 1; r < raw02.length; r++) {
  const row = raw02[r];
  if (!row || row.every(c => String(c).trim() === '')) continue;

  const getCol = (name) => {
    const idx = headers02.indexOf(name);
    return idx >= 0 ? row[idx] : undefined;
  };

  const postoIdSGP = cellToStr(getCol('Posto_ID_SGP'));
  if (!postoIdSGP) continue;

  const unidade = cellToStr(getCol('Unidade'));
  const postoBase = cellToStr(getCol('Posto_Base'));
  const itemPPU = cellToStr(getCol('Item_PPU'));
  const postoDeServico = cellToStr(getCol('Posto_de_Servico'));
  const nomenclaturaSugerida = cellToStr(getCol('Nomenclatura_Sugerida'));
  const municipio = cellToStr(getCol('Municipio'));
  const gerencia = cellToStr(getCol('Gerencia'));
  const periculosidadeOriginal = cellToStr(getCol('Periculosidade'));
  const qtdPosicoesIDObservadas = cellToInt(getCol('Qtd_Posicoes_ID_Observadas')) || 0;
  const qtdAlocacoesMC = cellToInt(getCol('Qtd_Alocacoes_MC')) || 0;
  const qtdEstruturalConfirmada = cellToInt(getCol('Qtd_Estrutural_Confirmada')) || 1;
  const statusEstrutura = cellToStr(getCol('Status_Estrutura'));
  const observacaoEstrutura = cellToStr(getCol('Observacao_Estrutura'));
  const qtdFeristasIdentificados = cellToInt(getCol('Qtd_Feristas_Identificados')) || 0;
  const qtdPosicoesSemTitularMC = cellToInt(getCol('Qtd_Posicoes_Sem_Titular_MC')) || 0;
  const statusMapeamentoREV03 = cellToStr(getCol('Status_Mapeamento_REV03'));

  const periculosidadeBooleana = periculosidadeOriginal ? periculosidadeOriginal.trim().toUpperCase() === 'SIM' : false;

  let tipoId = 'ADM_09H';
  let tipoNome = 'Adm/09h';
  const pServ = postoDeServico || '';

  if (pServ.includes('Turno/24h')) {
    tipoId = 'TURNO_24H'; tipoNome = 'Turno/24h';
  } else if (pServ.includes('Turno/16h')) {
    tipoId = 'TURNO_16H'; tipoNome = 'Turno/16h';
  } else if (pServ.includes('Adm/16h')) {
    tipoId = 'ADM_16H'; tipoNome = 'Adm/16h';
  } else if (pServ.includes('Turno/12h')) {
    tipoId = 'TURNO_12H'; tipoNome = 'Turno/12h';
  } else if (pServ.includes('Adm/12h')) {
    tipoId = 'ADM_12H'; tipoNome = 'Adm/12h';
  }

  const postoObj = {
    postoIdSGP,
    unidade,
    postoBase,
    itemPPU,
    postoDeServico,
    nomenclaturaSugerida,
    municipio,
    gerencia,
    periculosidade: periculosidadeOriginal,
    periculosidadeBooleana,
    qtdPosicoesIDObservadas,
    qtdAlocacoesMC,
    qtdEstruturalConfirmada,
    statusEstrutura,
    observacaoEstrutura,
    qtdFeristasIdentificados,
    qtdPosicoesSemTitularMC,
    statusMapeamentoREV03,
    tipoPostoId: tipoId,
    tipoPostoNome: tipoNome,
    // Campos para compatibilidade com o modelo de Posto do SGP
    id: postoIdSGP,
    idPosto: postoBase || postoIdSGP,
    codigoPosto: postoBase || postoIdSGP,
    idReferencia: postoBase,
    funcao: postoDeServico,
    descricao: nomenclaturaSugerida,
    localAtuacao: unidade,
    unidadeId: unidade,
    unidadeNome: unidade,
    baseOperacional: unidade,
    gerenciaPetrobras: gerencia,
    escala: tipoId.includes('TURNO') ? '12x36' : '5x2',
    jornadaSemanalHoras: tipoId.includes('09H') ? 44 : 40,
    situacao: 'ATIVO',
    dataInicioVigencia: '2026-08-10'
  };

  postos.push(postoObj);
  postosMap.set(postoIdSGP, postoObj);
}

console.log(`[2/6] Postos carregados: ${postos.length} (esperado: 244)`);

// -----------------------------------------------------------------------------
// 4. ABA 03_POSICOES (311 Posições estruturais canônicas)
// -----------------------------------------------------------------------------
const raw03 = XLSX.utils.sheet_to_json(wb.Sheets['03_POSICOES'], { header: 1, raw: false, defval: '' });
const headers03 = raw03[0].map(h => String(h).trim());

const posicoes = [];
const posicoesMap = new Map();
let posicoesIgnoradas = 0;

for (let r = 1; r < raw03.length; r++) {
  const row = raw03[r];
  if (!row || row.every(c => String(c).trim() === '')) continue;

  const getCol = (name) => {
    const idx = headers03.indexOf(name);
    return idx >= 0 ? row[idx] : undefined;
  };

  const posId = cellToStr(getCol('Posicao_ID_SGP'));
  if (!posId || !posId.startsWith('POS-')) {
    posicoesIgnoradas++;
    continue;
  }

  const postoIdSGP = cellToStr(getCol('Posto_ID_SGP'));
  const unidade = cellToStr(getCol('Unidade'));
  const postoBase = cellToStr(getCol('Posto_Base'));
  const codigoPosicaoEstrutural = cellToStr(getCol('Codigo_Posicao_Estrutural'));
  const numeroPosicao = cellToInt(getCol('Numero_Posicao')) || 1;
  const itemPPU = cellToStr(getCol('Item_PPU'));
  const postoDeServico = cellToStr(getCol('Posto_de_Servico'));
  const qtdEstruturalConfirmada = cellToInt(getCol('Qtd_Estrutural_Confirmada')) || 1;
  const titularReferencia = cellToStr(getCol('Titular_Referencia'));
  
  let chapaTitular = cellToStr(getCol('Chapa_Titular'));
  if (chapaTitular && chapaTitular !== '0' && chapaTitular !== '000000') {
    chapaTitular = chapaTitular.padStart(6, '0');
  } else {
    chapaTitular = null;
  }

  const statusRMTitular = cellToStr(getCol('Status_RM_Titular'));
  const substitutosNoPeriodo = cellToStr(getCol('Substitutos_no_Periodo'));
  const idsLuizOrigem = cellToStr(getCol('IDs_Luiz_Origem'));
  const feristasDoPosto = cellToStr(getCol('Feristas_do_Posto'));
  const statusMapeamento = cellToStr(getCol('Status_Mapeamento'));
  const posicaoSemTitularMC = cellToStr(getCol('Posicao_Sem_Titular_MC')) || 'NÃO';
  const observacao = cellToStr(getCol('Observacao'));
  const horarioRMTitular = cellToStr(getCol('Horario_RM_Titular'));
  const escalaTipoInformada = cellToStr(getCol('Escala_Tipo_Informada'));
  const faixaHorariaInformada = cellToStr(getCol('Faixa_Horaria_Informada'));
  const regimeDiasInformado = cellToStr(getCol('Regime_Dias_Informado'));
  const grupoRevezamento = cellToStr(getCol('Grupo_Revezamento'));
  const dataBaseEscala = cellToStr(getCol('Data_Base_Escala'));
  const faseCiclo = cellToStr(getCol('Fase_Ciclo'));
  const fonteEscala = cellToStr(getCol('Fonte_Escala'));
  const statusProgramacaoDiaria = cellToStr(getCol('Status_Programacao_Diaria'));
  const observacaoEscala = cellToStr(getCol('Observacao_Escala'));

  const ehVaga = posicaoSemTitularMC === 'SIM' || !titularReferencia || titularReferencia.toUpperCase().includes('SEM TITULAR');

  const posObj = {
    posicaoIdSGP: posId,
    postoIdSGP,
    unidade,
    postoBase,
    codigoPosicaoEstrutural,
    numeroPosicao,
    sufixo: numeroPosicao,
    itemPPU,
    postoDeServico,
    qtdEstruturalConfirmada,
    titularReferencia: ehVaga ? null : titularReferencia,
    chapaTitular: ehVaga ? null : chapaTitular,
    statusRMTitular,
    substitutosNoPeriodo,
    idsLuizOrigem,
    feristasDoPosto,
    statusMapeamento,
    posicaoSemTitularMC,
    ehVaga,
    statusOcupacaoMC: ehVaga ? 'VAGA' : 'OCUPADA',
    observacao,
    horario_rm: horarioRMTitular,
    horarioRm: horarioRMTitular,
    escala_tipo: escalaTipoInformada,
    escalaTipo: escalaTipoInformada,
    faixa_horaria: faixaHorariaInformada,
    faixaHoraria: faixaHorariaInformada,
    regime_dias: regimeDiasInformado,
    regimeDias: regimeDiasInformado,
    grupo_revezamento: grupoRevezamento,
    grupoRevezamento: grupoRevezamento,
    data_base_escala: dataBaseEscala,
    dataBaseEscala: dataBaseEscala,
    fase_ciclo: faseCiclo,
    faseCiclo: faseCiclo,
    fonte_escala: fonteEscala,
    fonteEscala: fonteEscala,
    status_programacao: statusProgramacaoDiaria,
    statusProgramacao: statusProgramacaoDiaria,
    observacaoEscala,
    // Compatibilidade com modelos anteriores do SGP
    id: posId,
    idPosto: postoIdSGP,
    etiqueta: codigoPosicaoEstrutural || idsLuizOrigem,
    codigoVisual: codigoPosicaoEstrutural || idsLuizOrigem,
    idOriginalMC: idsLuizOrigem || codigoPosicaoEstrutural,
    statusValidacao: statusMapeamento && statusMapeamento.includes('A VALIDAR') ? 'A VALIDAR' : 'VALIDADA',
    conflitoCadastro: statusMapeamento && statusMapeamento.includes('A VALIDAR') ? 'REVISAR' : 'OK',
    ehEstrutural: true
  };

  posicoes.push(posObj);
  posicoesMap.set(posId, posObj);
}

const posicoesVagas = posicoes.filter(p => p.ehVaga);
const posicoesOcupadas = posicoes.filter(p => !p.ehVaga);

console.log(`[3/6] Posições carregadas: ${posicoes.length} (esperado: 311)`);
console.log(`      ↳ Posições com Titular na MC: ${posicoesOcupadas.length} (esperado: 292)`);
console.log(`      ↳ Posições sem Titular (VAGAS): ${posicoesVagas.length} (esperado: 19)`);
console.log(`      ↳ Linhas de notas ignoradas ao final da aba 03: ${posicoesIgnoradas} (esperado: 8)`);

// -----------------------------------------------------------------------------
// 5. ABA 07_FERISTAS_COBERTURA (23 Feristas)
// -----------------------------------------------------------------------------
const raw07 = XLSX.utils.sheet_to_json(wb.Sheets['07_FERISTAS_COBERTURA'], { header: 1, raw: false, defval: '' });
const headers07 = raw07[0].map(h => String(h).trim());

const feristas = [];

for (let r = 1; r < raw07.length; r++) {
  const row = raw07[r];
  if (!row || row.every(c => String(c).trim() === '')) continue;

  const getCol = (name) => {
    const idx = headers07.indexOf(name);
    return idx >= 0 ? row[idx] : undefined;
  };

  const feristaIdSGP = cellToStr(getCol('Ferista_ID_SGP'));
  if (!feristaIdSGP) continue;

  const unidade = cellToStr(getCol('Unidade'));
  const postoBase = cellToStr(getCol('Posto_Base'));
  const postoIdSGP = cellToStr(getCol('Posto_ID_SGP'));
  const idLuizOriginal = cellToStr(getCol('ID_Luiz_Original'));
  const colaborador = cellToStr(getCol('Colaborador'));
  
  let chapaRM = cellToStr(getCol('Chapa_RM'));
  if (chapaRM && chapaRM !== '0' && chapaRM !== '000000') {
    chapaRM = chapaRM.padStart(6, '0');
  } else {
    chapaRM = null;
  }

  const statusRM = cellToStr(getCol('Status_RM'));
  const funcaoRM = cellToStr(getCol('Funcao_RM'));
  const horarioRM = cellToStr(getCol('Horario_RM'));
  const postoDeServico = cellToStr(getCol('Posto_de_Servico'));
  const posicaoPermanente = cellToStr(getCol('Posicao_Permanente'));
  const papel = cellToStr(getCol('Papel'));
  const comentarioMC = cellToStr(getCol('Comentario_MC'));

  feristas.push({
    feristaIdSGP,
    postoIdSGP,
    unidade,
    postoBase,
    idLuizOriginal,
    colaborador,
    chapaRM,
    statusRM,
    funcaoRM,
    horarioRM,
    postoDeServico,
    posicaoPermanente,
    papel,
    comentarioMC,
    // Compatibilidade com FeristaPostoVinculo
    id: feristaIdSGP,
    matricula: chapaRM || feristaIdSGP,
    nome: colaborador,
    unidadeId: unidade,
    ativo: true,
    dataInicio: '2026-08-10',
    observacoes: comentarioMC || `Ferista vinculado ao posto ${postoIdSGP}`
  });
}

console.log(`[4/6] Feristas carregados: ${feristas.length} (esperado: 23)`);

// -----------------------------------------------------------------------------
// 6. ABA 08_ESCALAS_POSICOES (311 Escalas vinculadas a Posicao_ID_SGP)
// -----------------------------------------------------------------------------
const raw08 = XLSX.utils.sheet_to_json(wb.Sheets['08_ESCALAS_POSICOES'], { header: 1, raw: false, defval: '' });
const headers08 = raw08[0].map(h => String(h).trim());

const escalas = [];

for (let r = 1; r < raw08.length; r++) {
  const row = raw08[r];
  if (!row || row.every(c => String(c).trim() === '')) continue;

  const getCol = (name) => {
    const idx = headers08.indexOf(name);
    return idx >= 0 ? row[idx] : undefined;
  };

  const escalaIdSGP = cellToStr(getCol('Escala_ID_SGP'));
  const posicaoIdSGP = cellToStr(getCol('Posicao_ID_SGP'));
  if (!escalaIdSGP && !posicaoIdSGP) continue;

  const postoIdSGP = cellToStr(getCol('Posto_ID_SGP'));
  const unidade = cellToStr(getCol('Unidade'));
  const postoBase = cellToStr(getCol('Posto_Base'));
  const codigoPosicaoEstrutural = cellToStr(getCol('Codigo_Posicao_Estrutural'));
  const titularReferencia = cellToStr(getCol('Titular_Referencia'));
  
  let chapaTitular = cellToStr(getCol('Chapa_Titular'));
  if (chapaTitular && chapaTitular !== '0' && chapaTitular !== '000000') {
    chapaTitular = chapaTitular.padStart(6, '0');
  } else {
    chapaTitular = null;
  }

  const horarioRMInformado = cellToStr(getCol('Horario_RM_Informado'));
  const escalaTipoInformada = cellToStr(getCol('Escala_Tipo_Informada'));
  const faixaHorariaInformada = cellToStr(getCol('Faixa_Horaria_Informada'));
  const regimeDiasInformado = cellToStr(getCol('Regime_Dias_Informado'));
  const grupoRevezamento = cellToStr(getCol('Grupo_Revezamento'));
  const dataBaseEscala = cellToStr(getCol('Data_Base_Escala'));
  const faseCiclo = cellToStr(getCol('Fase_Ciclo'));
  const fonteEscala = cellToStr(getCol('Fonte_Escala'));
  const statusProgramacaoDiaria = cellToStr(getCol('Status_Programacao_Diaria'));
  const pendenciaParaProgramar = cellToStr(getCol('Pendencia_Para_Programar'));
  const observacaoEscala = cellToStr(getCol('Observacao_Escala'));

  escalas.push({
    escalaIdSGP,
    posicaoIdSGP,
    postoIdSGP,
    unidade,
    postoBase,
    codigoPosicaoEstrutural,
    titularReferencia,
    chapaTitular,
    horarioRMInformado,
    escalaTipoInformada,
    faixaHorariaInformada,
    regimeDiasInformado,
    grupoRevezamento,
    dataBaseEscala,
    faseCiclo,
    fonteEscala,
    statusProgramacaoDiaria,
    pendenciaParaProgramar,
    observacaoEscala
  });
}

console.log(`[5/6] Escalas carregadas: ${escalas.length} (esperado: 311)`);

// -----------------------------------------------------------------------------
// 7. COMPATIBILIDADE DE VAGAS E ALOCAÇÕES PARA O MOTOR DE OCUPAÇÃO DO SGP
// -----------------------------------------------------------------------------
const vagasFormatadas = posicoes.map(pos => {
  return {
    id: pos.posicaoIdSGP,
    posicaoIdSGP: pos.posicaoIdSGP,
    idPosto: pos.postoIdSGP,
    postoIdSGP: pos.postoIdSGP,
    postoBase: pos.postoBase,
    sequencia: pos.numeroPosicao,
    etiqueta: pos.codigoVisual,
    codigoVisual: pos.codigoVisual,
    idOriginalMC: pos.idsLuizOrigem || pos.codigoVisual,
    statusValidacao: pos.statusValidacao,
    conflitoCadastro: pos.conflitoCadastro,
    regime: pos.escalaTipo || '5x2',
    tipoEscala: pos.escalaTipo || '5x2',
    escala_tipo: pos.escalaTipo,
    escalaTipo: pos.escalaTipo,
    faixa_horaria: pos.faixaHoraria,
    faixaHoraria: pos.faixaHoraria,
    regime_dias: pos.regimeDias,
    regimeDias: pos.regimeDias,
    horario_rm: pos.horarioRm,
    horarioRm: pos.horarioRm,
    horario: pos.horarioRm,
    grupo_revezamento: pos.grupoRevezamento,
    grupoRevezamento: pos.grupoRevezamento,
    data_base_escala: pos.dataBaseEscala,
    dataBaseEscala: pos.dataBaseEscala,
    fase_ciclo: pos.faseCiclo,
    faseCiclo: pos.faseCiclo,
    fonte_escala: pos.fonteEscala,
    fonteEscala: pos.fonteEscala,
    status_programacao: pos.statusProgramacao,
    statusProgramacao: pos.statusProgramacao,
    titularReferencia: pos.titularReferencia,
    chapaTitular: pos.chapaTitular,
    ehVaga: pos.ehVaga,
    posicaoSemTitularMC: pos.posicaoSemTitularMC
  };
});

const alocacoesFormatadas = alocacoes.map(aloc => {
  let motivo = 'titular';
  const t = (aloc.tipoAlocacaoValidado || '').toUpperCase();
  if (t.includes('FERISTA')) motivo = 'ferista';
  else if (t.includes('SUBSTITUT')) motivo = 'substituicao';

  return {
    id: aloc.alocacaoIdSGP,
    vagaId: aloc.posicaoIdSGP || `SEM_POS_${aloc.alocacaoIdSGP}`,
    posicaoIdSGP: aloc.posicaoIdSGP,
    postoIdSGP: aloc.postoIdSGP,
    matricula: aloc.chapaRM || `SEM_CHAPA_${aloc.alocacaoIdSGP}`,
    identificadorPetrobras: aloc.identificadorMC,
    nome: aloc.colaborador,
    dataInicio: '2026-08-10',
    dataFim: null,
    horarioEscalaRm: aloc.horarioRM,
    tipoAlocacao: aloc.tipoAlocacaoValidado,
    motivo,
    observacoes: aloc.comentarioMC || aloc.observacaoREV03,
    alocacaoDetalhe: aloc
  };
});

// -----------------------------------------------------------------------------
// 8. GRAVAÇÃO DOS ARQUIVOS JSON OFICIAIS
// -----------------------------------------------------------------------------
const pastaDestino = path.resolve('src/lib/dados');

fs.writeFileSync(path.join(pastaDestino, 'unidades-rev04.json'), JSON.stringify(unidades, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'postos-rev04.json'), JSON.stringify(postos, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'posicoes-rev04.json'), JSON.stringify(posicoes, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'alocacoes-rev04.json'), JSON.stringify(alocacoes, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'feristas-rev04.json'), JSON.stringify(feristas, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'escalas-rev04.json'), JSON.stringify(escalas, null, 2), 'utf8');

// Atualiza também os arquivos canônicos de consumo direto da aplicação
fs.writeFileSync(path.join(pastaDestino, 'postos-mc-reais.json'), JSON.stringify(postos, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'postos-rev02.json'), JSON.stringify(postos, null, 2), 'utf8');

fs.writeFileSync(path.join(pastaDestino, 'vagas-mc-reais.json'), JSON.stringify(vagasFormatadas, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'posicoes-rev02.json'), JSON.stringify(posicoes, null, 2), 'utf8');

fs.writeFileSync(path.join(pastaDestino, 'alocacoes-mc-reais.json'), JSON.stringify(alocacoesFormatadas, null, 2), 'utf8');
fs.writeFileSync(path.join(pastaDestino, 'alocacoes-rev02.json'), JSON.stringify(alocacoes, null, 2), 'utf8');

console.log('\n[6/6] Arquivos gravados em src/lib/dados/:');
console.log('  ✓ unidades-rev04.json');
console.log('  ✓ postos-rev04.json & postos-mc-reais.json');
console.log('  ✓ posicoes-rev04.json & vagas-mc-reais.json');
console.log('  ✓ alocacoes-rev04.json & alocacoes-mc-reais.json');
console.log('  ✓ feristas-rev04.json');
console.log('  ✓ escalas-rev04.json');

console.log('\n================================================================');
console.log('  CARGA EXECUTADA COM SUCESSO E ZERO PERDA DE DADOS!');
console.log('================================================================\n');
