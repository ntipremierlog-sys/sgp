const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('Base_Estruturada_SGP_Petrobras_REV04.xlsx');

// 1. 02_POSTOS (244 postos)
const postosRaw = XLSX.utils.sheet_to_json(wb.Sheets['02_POSTOS']);
const postosMap = new Map();

postosRaw.forEach(row => {
  const postoIdSGP = String(row.Posto_ID_SGP).trim();
  const pServ = String(row.Posto_de_Servico || '').trim();
  let tipoId = 'ADM_09H';
  let tipoNome = 'Adm/09h';

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

  const qtdConfirmada = Number(row.Qtd_Estrutural_Confirmada || (tipoId === 'TURNO_16H' ? 3 : tipoId === 'TURNO_24H' ? 4 : tipoId.includes('12H') || tipoId.includes('16H') ? 2 : 1));

  postosMap.set(postoIdSGP, {
    postoIdSGP,
    idReferencia: row.Posto_Base,
    unidade: String(row.Unidade || '').trim(),
    itemPPU: String(row.Item_PPU || '').trim(),
    postoDeServico: pServ,
    nomenclaturaSugerida: String(row.Nomenclatura_Sugerida || '').trim(),
    municipio: String(row.Municipio || '').trim(),
    gerencia: String(row.Gerencia || '').trim(),
    periculosidade: String(row.Periculosidade || 'NÃO').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NÃO',
    tipoPostoId: tipoId,
    tipoPostoNome: tipoNome,
    qtdEstruturalPremissa: qtdConfirmada,
    qtdPosicoesIDObservadas: Number(row.Qtd_Posicoes_ID_Observadas || 0),
    qtdAlocacoesMC: Number(row.Qtd_Alocacoes_MC || 0),
    statusEstrutura: String(row.Status_Estrutura || 'COERENTE COM A REGRA').trim(),
    observacaoEstrutura: String(row.Observacao_Estrutura || '').trim()
  });
});
const postos = Array.from(postosMap.values());
console.log('Postos processados (upsert):', postos.length);

// 2. 03_POSICOES (311 posicoes validas, 8 rejeitadas)
const posicoesRaw = XLSX.utils.sheet_to_json(wb.Sheets['03_POSICOES']);
const posicoesMap = new Map();
const linhasRejeitadasPosicoes = [];

posicoesRaw.forEach((row, idx) => {
  const posId = row.Posicao_ID_SGP ? String(row.Posicao_ID_SGP).trim() : '';
  if (!posId || !posId.startsWith('POS-')) {
    linhasRejeitadasPosicoes.push({
      linhaExcel: idx + 2,
      conteudo: row,
      motivo: 'Linha sem Posicao_ID_SGP válido (anotação de regra operacional)'
    });
    return;
  }

  posicoesMap.set(posId, {
    posicaoIdSGP: posId,
    postoIdSGP: String(row.Posto_ID_SGP).trim(),
    postoBase: row.Posto_Base,
    codigoVisual: String(row.Codigo_Posicao_Estrutural || row.IDs_Luiz_Origem || '').trim(),
    idOriginalMC: String(row.IDs_Luiz_Origem || row.Codigo_Posicao_Estrutural || '').trim(),
    sufixo: Number(row.Numero_Posicao || 1),
    conflitoCadastro: String(row.Status_Mapeamento || 'OK').includes('A VALIDAR') ? 'REVISAR' : 'OK',
    motivoConflito: String(row.Observacao || '').trim(),
    tratamentoSGP: 'POSIÇÃO ESTRUTURAL CONFIRMADA',
    observacoes: String(row.Observacao || row.Observacao_Escala || '').trim(),
    statusValidacao: String(row.Status_Mapeamento || '').includes('A VALIDAR') || row.Posicao_Sem_Titular_MC === 'SIM' ? 'A VALIDAR' : 'VALIDADA',
    ehEstrutural: true,
    // Escala da posição:
    horario_rm: row.Horario_RM_Titular || undefined,
    horarioRm: row.Horario_RM_Titular || undefined,
    escala_tipo: row.Escala_Tipo_Informada || undefined,
    escalaTipo: row.Escala_Tipo_Informada || undefined,
    faixa_horaria: row.Faixa_Horaria_Informada || undefined,
    faixaHoraria: row.Faixa_Horaria_Informada || undefined,
    regime_dias: row.Regime_Dias_Informado || undefined,
    regimeDias: row.Regime_Dias_Informado || undefined,
    fonte_escala: row.Fonte_Escala || undefined,
    fonteEscala: row.Fonte_Escala || undefined,
    status_programacao: row.Status_Programacao_Diaria || undefined,
    statusProgramacao: row.Status_Programacao_Diaria || undefined,
    // Titular na posição:
    titularReferencia: row.Titular_Referencia || undefined,
    chapaTitular: row.Chapa_Titular ? String(row.Chapa_Titular).trim().padStart(6, '0') : undefined,
    statusRMTitular: row.Status_RM_Titular || undefined,
    posicaoSemTitularMC: row.Posicao_Sem_Titular_MC || 'NÃO'
  });
});
const posicoes = Array.from(posicoesMap.values());
console.log('Posicoes validas processadas (upsert):', posicoes.length, '| Rejeitadas:', linhasRejeitadasPosicoes.length);

// 3. 07_FERISTAS_COBERTURA (23 registros)
const feristasRaw = XLSX.utils.sheet_to_json(wb.Sheets['07_FERISTAS_COBERTURA']);
const feristasMap = new Map();

feristasRaw.forEach(row => {
  const feristaId = String(row.Ferista_ID_SGP).trim();
  const chapaRaw = row.Chapa_RM ? String(row.Chapa_RM).trim() : '';
  const chapaRM = chapaRaw && chapaRaw !== 'undefined' ? chapaRaw.padStart(6, '0') : '';

  feristasMap.set(feristaId, {
    feristaIdSGP: feristaId,
    unidade: String(row.Unidade || '').trim(),
    postoBase: row.Posto_Base,
    postoIdSGP: String(row.Posto_ID_SGP || '').trim(),
    idLuizOriginal: String(row.ID_Luiz_Original || '').trim(),
    colaborador: String(row.Colaborador || '').trim(),
    chapaRM,
    statusRM: String(row.Status_RM || '').trim(),
    funcaoRM: String(row.Funcao_RM || '').trim(),
    horarioRM: String(row.Horario_RM || '').trim(),
    postoDeServico: String(row.Posto_de_Servico || '').trim(),
    papel: String(row.Papel || 'FERISTA').trim(),
    comentarioMC: String(row.Comentario_MC || '').trim()
  });
});
const feristas = Array.from(feristasMap.values());
console.log('Feristas processados (upsert):', feristas.length);

// 4. 08_ESCALAS_POSICOES (311 escalas)
const escalasRaw = XLSX.utils.sheet_to_json(wb.Sheets['08_ESCALAS_POSICOES']);
const escalasMap = new Map();

escalasRaw.forEach(row => {
  const escalaId = String(row.Escala_ID_SGP || '').trim();
  const posId = String(row.Posicao_ID_SGP || '').trim();
  const chave = escalaId || posId;

  escalasMap.set(chave, {
    escalaIdSGP: escalaId,
    posicaoIdSGP: posId,
    postoIdSGP: String(row.Posto_ID_SGP || '').trim(),
    unidade: String(row.Unidade || '').trim(),
    postoBase: row.Posto_Base,
    codigoPosicaoEstrutural: String(row.Codigo_Posicao_Estrutural || '').trim(),
    titularReferencia: row.Titular_Referencia || undefined,
    chapaTitular: row.Chapa_Titular ? String(row.Chapa_Titular).trim().padStart(6, '0') : undefined,
    horarioRMInformado: row.Horario_RM_Informado || undefined,
    escalaTipoInformada: row.Escala_Tipo_Informada || undefined,
    faixaHorariaInformada: row.Faixa_Horaria_Informada || undefined,
    regimeDiasInformado: row.Regime_Dias_Informado || undefined,
    fonteEscala: row.Fonte_Escala || undefined,
    statusProgramacaoDiaria: row.Status_Programacao_Diaria || undefined,
    observacaoEscala: row.Observacao_Escala || undefined
  });
});
const escalas = Array.from(escalasMap.values());
console.log('Escalas processadas (upsert):', escalas.length);

// 5. 09_PENDENCIAS_ESCALA (101 pendências)
const pendEscalaRaw = XLSX.utils.sheet_to_json(wb.Sheets['09_PENDENCIAS_ESCALA']);
const pendenciasEscala = pendEscalaRaw.map((row, idx) => ({
  id: 'PEND-ESC-' + String(idx + 1).padStart(4, '0'),
  prioridade: String(row.Prioridade || 'ALTA').trim(),
  unidade: String(row.Unidade || '').trim(),
  postoBase: row.Posto_Base,
  posicao: String(row.Posicao || '').trim(),
  titular: String(row.Titular || '').trim(),
  horarioRM: String(row.Horario_RM || '').trim(),
  escalaInformada: String(row.Escala_Informada || '').trim(),
  dadoFaltante: String(row.Dado_Faltante || '').trim(),
  acao: String(row.Acao || '').trim(),
  status: String(row.Status || 'A VALIDAR').trim()
}));
console.log('Pendencias Escala processadas:', pendenciasEscala.length);

// 6. 04_PENDENTES_RM (11) e 05_VALIDACOES (29)
const pendRmRaw = XLSX.utils.sheet_to_json(wb.Sheets['04_PENDENTES_RM']);
const pendentesRM = pendRmRaw.map(row => ({
  chapa: String(row.Chapa || '').trim().padStart(6, '0'),
  nome: String(row.Nome || '').trim(),
  statusRM: String(row.Status_RM || 'Ativo').trim(),
  dataAdmissao: row.Data_Admissao,
  unidadeRM: String(row.Unidade_RM || '').trim(),
  funcaoRM: String(row.Funcao_RM || '').trim(),
  horarioRM: String(row.Horario_RM || '').trim(),
  motivo: String(row.Motivo || '').trim(),
  alocarNoSGP: String(row.Alocar_no_SGP || 'A VALIDAR').trim(),
  postoIdSGP: row.Posto_ID_SGP,
  posicaoIdSGP: row.Posicao_ID_SGP
}));

const validacoesRaw = XLSX.utils.sheet_to_json(wb.Sheets['05_VALIDACOES']);
const validacoes = validacoesRaw.map((row, idx) => ({
  id: 'VAL-' + String(idx + 1).padStart(4, '0'),
  prioridade: String(row.Prioridade || 'MÉDIA').trim().toUpperCase(),
  tipo: String(row.Tipo || '').trim(),
  unidade: String(row.Unidade || '').trim(),
  referencia: String(row.Referencia || '').trim(),
  colaboradores: String(row.Colaborador_es || '').trim(),
  achado: String(row.Achado || '').trim(),
  acaoRecomendada: String(row.Acao_Recomendada || '').trim(),
  responsavel: String(row.Responsavel_Sugerido || 'Luiz').trim(),
  status: String(row.Status || 'A VALIDAR').trim()
}));

// 7. Validações automáticas
const rm = require('../src/lib/dados/funcionarios-reais.json');
const rmChapas = new Set(rm.map(f => String(f.matricula || f.chapa || '').padStart(6, '0')));

const validacaoSegSexEmTurno = posicoes.filter(p => {
  const posto = postos.find(post => post.postoIdSGP === p.postoIdSGP);
  const isTurno = (posto?.postoDeServico || '').includes('Turno') || (p.postoDeServico || '').includes('Turno');
  const horario = (p.horario_rm || p.regime_dias || '').toUpperCase();
  return isTurno && (horario.includes('SEG/SEX') || horario.includes('5X2') || horario.includes('ADMINISTRATIVO'));
}).map(p => ({
  tipo: 'TITULAR_SEG_SEX_EM_TURNO',
  posicaoIdSGP: p.posicaoIdSGP,
  postoIdSGP: p.postoIdSGP,
  titular: p.titularReferencia,
  horario: p.horario_rm,
  mensagem: 'Titular com horário SEG/SEX em posto de Turno contínuo'
}));

const validacaoSemTitular = posicoes.filter(p => !p.chapaTitular || p.posicaoSemTitularMC === 'SIM' || String(p.titularReferencia || '').includes('SEM TITULAR')).map(p => ({
  tipo: 'POSICAO_SEM_TITULAR',
  posicaoIdSGP: p.posicaoIdSGP,
  postoIdSGP: p.postoIdSGP,
  mensagem: 'Posição estrutural ativa sem titular confirmado na MC'
}));

const validacaoPosto9hFerista = postos.filter(post => {
  const is9h = (post.postoDeServico || '').includes('09h') || (post.postoDeServico || '').includes('9h');
  if (!is9h) return false;
  const posDoPosto = posicoes.filter(p => p.postoIdSGP === post.postoIdSGP);
  const feristasDoPosto = feristas.filter(f => f.postoIdSGP === post.postoIdSGP);
  const temTitular = posDoPosto.some(p => p.chapaTitular && !String(p.titularReferencia || '').includes('SEM TITULAR'));
  return !temTitular && feristasDoPosto.length > 0;
}).map(post => ({
  tipo: 'POSTO_9H_UNICA_PESSOA_FERISTA',
  postoIdSGP: post.postoIdSGP,
  mensagem: 'Posto 09h cuja única pessoa identificada é ferista'
}));

const validacaoSemRegime = postos.filter(post => {
  const s = post.postoDeServico || '';
  return !s.includes('09h') && !s.includes('12h') && !s.includes('16h') && !s.includes('24h');
}).map(post => ({
  tipo: 'POSTO_SEM_REGIME_IDENTIFICAVEL',
  postoIdSGP: post.postoIdSGP,
  postoDeServico: post.postoDeServico,
  mensagem: 'Posto sem regime de jornada identificável no nome do serviço'
}));

const mapaCadastro = XLSX.utils.sheet_to_json(wb.Sheets['01_MAPA_CADASTRO']);
const validacaoColaboradorSemRM = mapaCadastro.filter(r => {
  const chapa = String(r.Chapa_RM || '').trim().padStart(6, '0');
  return chapa === '000000' || !rmChapas.has(chapa);
}).map(r => ({
  tipo: 'COLABORADOR_MC_NAO_LOCALIZADO_RM',
  colaborador: r.Colaborador,
  chapa: r.Chapa_RM,
  postoIdSGP: r.Posto_ID_SGP,
  mensagem: 'Colaborador da MC não localizado na folha de pagamento RM'
}));

const relatorio = {
  dataGeracao: new Date().toISOString(),
  planilhaFonte: 'Base_Estruturada_SGP_Petrobras_REV04.xlsx',
  totais: {
    totalPostos: postos.length,
    totalPosicoes: posicoes.length,
    totalFeristas: feristas.length,
    totalEscalas: escalas.length,
    totalPendenciasEscala: pendenciasEscala.length,
    totalPendentesRM: pendentesRM.length,
    totalValidacoesPlanilha: validacoes.length,
    totalLinhasRejeitadasPosicoes: linhasRejeitadasPosicoes.length
  },
  linhasRejeitadas: linhasRejeitadasPosicoes,
  validacoesAutomaticas: {
    titularSegSexEmTurno: validacaoSegSexEmTurno,
    posicaoSemTitular: validacaoSemTitular,
    posto9hUnicaPessoaFerista: validacaoPosto9hFerista,
    postoSemRegimeIdentificavel: validacaoSemRegime,
    colaboradorMcNaoLocalizadoRM: validacaoColaboradorSemRM
  }
};

// Salvar JSONs
fs.writeFileSync('./src/lib/dados/postos-rev02.json', JSON.stringify(postos, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/posicoes-rev02.json', JSON.stringify(posicoes, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/feristas-rev04.json', JSON.stringify(feristas, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/escalas-rev04.json', JSON.stringify(escalas, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/pendencias-escala-rev04.json', JSON.stringify(pendenciasEscala, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/pendentes-rm-rev02.json', JSON.stringify(pendentesRM, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/validacoes-rev02.json', JSON.stringify(validacoes, null, 2), 'utf8');
fs.writeFileSync('./src/lib/dados/relatorio-importacao-rev04.json', JSON.stringify(relatorio, null, 2), 'utf8');

const registro = {
  arquivo: 'Base_Estruturada_SGP_Petrobras_REV04.xlsx',
  dataImportacao: new Date().toISOString(),
  usuario: 'Administrador Premier',
  versao: 'REV04',
  totalPostos: postos.length,
  totalPosicoesEstruturais: posicoes.length,
  totalPosicoesExcedentesPlanilha: 9,
  totalAlocacoes: 322,
  totalFeristas: feristas.length,
  totalEscalas: escalas.length,
  totalPendenciasEscala: pendenciasEscala.length,
  totalPendentesRM: pendentesRM.length,
  totalValidacoes: validacoes.length,
  totalConflitosAValidar: posicoes.filter(p => p.statusValidacao === 'A VALIDAR').length
};
fs.writeFileSync('./src/lib/dados/registro-carga-rev02.json', JSON.stringify(registro, null, 2), 'utf8');

console.log('--- RELATÓRIO DE IMPORTAÇÃO REV04 ---');
console.log('Postos:', postos.length);
console.log('Posições:', posicoes.length);
console.log('Registros de Ferista:', feristas.length);
console.log('Escalas:', escalas.length);
console.log('Pendências de Escala:', pendenciasEscala.length);
console.log('Linhas rejeitadas em 03_POSICOES:', linhasRejeitadasPosicoes.length);
console.log('Validações automáticas geradas:');
console.log(' - Titular SEG/SEX em Turno:', validacaoSegSexEmTurno.length);
console.log(' - Posição sem titular:', validacaoSemTitular.length);
console.log(' - Posto 9h única pessoa ferista:', validacaoPosto9hFerista.length);
console.log(' - Posto sem regime identificável:', validacaoSemRegime.length);
console.log(' - Colaborador MC não localizado RM:', validacaoColaboradorSemRM.length);
