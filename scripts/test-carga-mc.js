const xlsx = require('xlsx');
const fs = require('fs');

const wbMC = xlsx.readFile('Memoria_Calculo.xlsx', { cellFormula: true });
const sheetMC = wbMC.Sheets['MC'];
const rowsMC = xlsx.utils.sheet_to_json(sheetMC, { header: 1 });

const wbFunc = xlsx.readFile('funcionarios petrobras.XLSX');
const sheetFunc = wbFunc.Sheets[wbFunc.SheetNames[0]];
const rowsFunc = xlsx.utils.sheet_to_json(sheetFunc, { header: 1 });

// RM Indexing
const rmPorNome = new Map();
const rmPorChapa = new Map();
const rmPorIdentificador = new Map();

for (let i = 1; i < rowsFunc.length; i++) {
  const row = rowsFunc[i];
  if (!row) continue;
  const nome = String(row[0] || '').trim().toUpperCase();
  const chapa = String(row[1] || '').trim().padStart(6, '0');
  const horarioDesc = String(row[11] || '').trim();
  const jornada = String(row[12] || '').trim();
  const identificador = String(row[15] || '').trim();
  const horarioCod = String(row[19] || '').trim();
  const secaoDesc = String(row[8] || '').trim();
  const funcaoRm = String(row[10] || '').trim();
  const dataAdmissao = row[6];
  const dataDemissao = row[7];

  const rmData = {
    nome,
    chapa,
    horarioDesc,
    jornada,
    identificador,
    horarioCod,
    secaoDesc,
    funcaoRm,
    dataAdmissao,
    dataDemissao,
  };

  if (chapa && chapa !== '000000') rmPorChapa.set(chapa, rmData);
  if (nome) rmPorNome.set(nome, rmData);
  if (identificador) rmPorIdentificador.set(identificador, rmData);
}

const TIPOS_POSTO = {
  ADM_09H: { id: 'ADM_09H', nome: 'Adm/09h', vagas: 1 },
  ADM_12H: { id: 'ADM_12H', nome: 'Adm/12h', vagas: 2 },
  ADM_16H: { id: 'ADM_16H', nome: 'Adm/16h', vagas: 2 },
  TURNO_12H: { id: 'TURNO_12H', nome: 'Turno/12h', vagas: 2 },
  TURNO_16H: { id: 'TURNO_16H', nome: 'Turno/16h', vagas: 3 },
  TURNO_24H: { id: 'TURNO_24H', nome: 'Turno/24h', vagas: 4 },
};

function resolverTipoPosto(postoServico, divisorFormula) {
  const p = String(postoServico || '').trim();
  if (p.includes('Turno/24h')) return TIPOS_POSTO.TURNO_24H;
  if (p.includes('Turno/16h')) return TIPOS_POSTO.TURNO_16H;
  if (p.includes('Turno/12h')) return TIPOS_POSTO.TURNO_12H;
  if (p.includes('Adm/16h')) return TIPOS_POSTO.ADM_16H;
  if (p.includes('Adm/12h')) return TIPOS_POSTO.ADM_12H;
  if (p.includes('Adm/09h')) return TIPOS_POSTO.ADM_09H;

  // Fallback se não tiver texto explícito (ex: SERVIÇO DE APOIO EM ANÁSELISE DE ENGENHARIA)
  if (divisorFormula === 4) return TIPOS_POSTO.TURNO_24H;
  if (divisorFormula === 3) return TIPOS_POSTO.TURNO_16H;
  if (divisorFormula === 2) return TIPOS_POSTO.TURNO_12H; // ou ADM_12H
  return TIPOS_POSTO.ADM_09H;
}

function parseExcelDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string' && excelDate.includes('-')) return excelDate;
  if (typeof excelDate === 'number') {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  return null;
}

// Check lines
const postosMap = new Map();
const vagasMap = new Map();
const alocacoesList = [];

// For reports
const relatorio = {
  idsDuplicados: [],
  excessoPessoasPorPosto: [],
  divergenciasDivisor: [],
  colaboradoresSemRm: [],
};

const idsOcorrencias = new Map();
const linhasPorIdPosto = new Map();

for (let r = 4; r < rowsMC.length; r++) {
  const row = rowsMC[r];
  if (!row || row[0] === null || row[0] === undefined || String(row[0]).trim() === '') continue;

  const rawId = String(row[0]).trim();
  const itemPPU = String(row[1] || '').trim();
  const periculosidade = String(row[2] || '').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NÃO';
  const municipio = String(row[3] || '').trim();
  const localAtuacao = String(row[4] || '').trim();
  const gerenciaPetrobras = String(row[5] || '').trim();
  const colabId = String(row[6] || '').trim();
  const colabNome = String(row[7] || '').trim();
  const postoServico = String(row[8] || '').trim();
  const cargo = String(row[9] || '').trim();
  const dataAdmissao = parseExcelDate(row[10]);
  const comentario = String(row[15] || '').trim();

  // Excel cell formula in column Y
  const cellY = sheetMC['Y' + (r + 1)];
  const cellFormula = cellY ? cellY.f || '' : '';
  const matchDiv = cellFormula.match(/\/(\d+)/);
  const divisorFormula = matchDiv ? parseInt(matchDiv[1], 10) : 1;

  // Extract idPosto and sequencia
  const dotIdx = rawId.indexOf('.');
  const idPosto = dotIdx > -1 ? rawId.substring(0, dotIdx) : rawId;
  const seqVaga = dotIdx > -1 ? parseInt(rawId.substring(dotIdx + 1), 10) : 1;

  const tipoPosto = resolverTipoPosto(postoServico, divisorFormula);

  const itemLinha = {
    linhaExcel: r + 1,
    rawId,
    idPosto,
    seqVaga,
    itemPPU,
    periculosidade,
    municipio,
    localAtuacao,
    gerenciaPetrobras,
    colabId,
    colabNome,
    postoServico,
    cargo,
    dataAdmissao,
    comentario,
    tipoPosto,
    cellFormula,
    divisorFormula,
  };

  // IDs duplicados check
  if (!idsOcorrencias.has(rawId)) idsOcorrencias.set(rawId, []);
  idsOcorrencias.get(rawId).push(itemLinha);

  // Group by idPosto
  if (!linhasPorIdPosto.has(idPosto)) linhasPorIdPosto.set(idPosto, []);
  linhasPorIdPosto.get(idPosto).push(itemLinha);
}

// 1. Report IDs Duplicados
for (const [id, list] of idsOcorrencias.entries()) {
  if (list.length > 1) {
    relatorio.idsDuplicados.push({
      id,
      ocorrencias: list.map(l => ({
        linhaExcel: l.linhaExcel,
        colaborador: l.colabNome,
        identificadorPetrobras: l.colabId,
        postoServico: l.postoServico,
        comentario: l.comentario,
      })),
    });
  }
}

// 2. Report Excesso de pessoas por posto & criação dos Postos e Vagas
for (const [idPosto, list] of linhasPorIdPosto.entries()) {
  const primeira = list[0];
  const tipoPosto = primeira.tipoPosto;
  const vagasEsperadas = tipoPosto.vagas;

  if (list.length > vagasEsperadas) {
    relatorio.excessoPessoasPorPosto.push({
      idPosto,
      tipoPosto: tipoPosto.nome,
      vagasEsperadas,
      totalOcupantesNaMC: list.length,
      pessoas: list.map(l => ({
        linhaExcel: l.linhaExcel,
        idNaMC: l.rawId,
        colaborador: l.colabNome,
        comentario: l.comentario,
      })),
    });
  }

  // Define PostoOperacional
  let escala = '5x2';
  let jornadaSemanal = 44;
  let horarioInicio = '07:00';
  let horarioFim = '16:48';

  if (tipoPosto.id === 'TURNO_24H' || tipoPosto.id === 'TURNO_12H') {
    escala = '12x36';
    jornadaSemanal = 36;
    horarioInicio = '07:00';
    horarioFim = '19:00';
  } else if (tipoPosto.id === 'TURNO_16H' || tipoPosto.id === 'ADM_16H') {
    escala = '5x2';
    jornadaSemanal = 40;
    horarioInicio = '07:00';
    horarioFim = '15:48';
  } else if (tipoPosto.id === 'ADM_12H') {
    escala = '5x2';
    jornadaSemanal = 40;
    horarioInicio = '07:00';
    horarioFim = '15:48';
  }

  const posto = {
    id: `pst-${idPosto}`,
    idPosto,
    codigoPosto: `PST-${primeira.localAtuacao.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8)}-${idPosto.padStart(3, '0')}`,
    funcao: primeira.cargo || primeira.postoServico.split('-')[0].trim(),
    descricao: primeira.postoServico,
    itemPPU: primeira.itemPPU,
    tipoPostoId: tipoPosto.id,
    periculosidade: primeira.periculosidade,
    municipio: primeira.municipio,
    localAtuacao: primeira.localAtuacao,
    gerenciaPetrobras: primeira.gerenciaPetrobras,
    escala,
    jornadaSemanalHoras: jornadaSemanal,
    horarioInicio,
    horarioFim,
    situacao: 'ATIVO',
    dataInicioVigencia: primeira.dataAdmissao || '2024-01-01',
    unidadeId: primeira.localAtuacao.replace(/[^A-Z0-9]/gi, '_').toUpperCase(),
    unidadeNome: primeira.localAtuacao,
    baseOperacional: primeira.localAtuacao,
  };

  postosMap.set(idPosto, posto);

  // Vagas automáticas a partir do tipo de posto (Regra 3: identificador = idPosto + "." + seq; 1 vaga usa só idPosto)
  const vagasDoPosto = [];
  if (vagasEsperadas === 1) {
    vagasDoPosto.push({
      id: idPosto,
      idPosto,
      sequencia: 1,
    });
  } else {
    for (let s = 1; s <= vagasEsperadas; s++) {
      vagasDoPosto.push({
        id: `${idPosto}.${s}`,
        idPosto,
        sequencia: s,
      });
    }
  }

  // Also if MC has additional slots (like .5 in excess cases), preserve them or map them
  for (const item of list) {
    if (item.seqVaga > vagasEsperadas) {
      const extraVagaId = `${idPosto}.${item.seqVaga}`;
      if (!vagasDoPosto.some(v => v.id === extraVagaId)) {
        vagasDoPosto.push({
          id: extraVagaId,
          idPosto,
          sequencia: item.seqVaga,
        });
      }
    }
  }

  for (const v of vagasDoPosto) {
    vagasMap.set(v.id, v);
  }
}

// 3. Report Divergências no divisor & Alocações
for (const [idPosto, list] of linhasPorIdPosto.entries()) {
  for (const item of list) {
    // Check divisor
    if (item.tipoPosto.vagas !== item.divisorFormula) {
      relatorio.divergenciasDivisor.push({
        linhaExcel: item.linhaExcel,
        idNaMC: item.rawId,
        idPosto: item.idPosto,
        tipoPosto: item.tipoPosto.nome,
        vagasTipoPosto: item.tipoPosto.vagas,
        divisorUsadoNaFormula: item.divisorFormula,
        formula: item.cellFormula,
      });
    }

    // Match with RM
    const colabNomeNorm = item.colabNome.toUpperCase();
    let rmMatch = null;
    if (colabNomeNorm && colabNomeNorm !== '-') {
      rmMatch = rmPorNome.get(colabNomeNorm);
      if (!rmMatch && item.colabId && item.colabId !== '-') {
        rmMatch = rmPorIdentificador.get(item.colabId) || rmPorChapa.get(item.colabId.padStart(6, '0'));
      }
    }

    if (!rmMatch) {
      relatorio.colaboradoresSemRm.push({
        linhaExcel: item.linhaExcel,
        idNaMC: item.rawId,
        idPosto: item.idPosto,
        colaborador: item.colabNome,
        identificadorPetrobras: item.colabId,
      });
    }

    // Determine motivo: titular, ferista, substituicao, sucessao
    let motivo = 'titular';
    const comentarioLower = item.comentario.toLowerCase();
    if (comentarioLower.includes('ferista')) {
      motivo = 'ferista';
    } else if (comentarioLower.includes('substituto') || comentarioLower.includes('substituição') || comentarioLower.includes('afastado')) {
      motivo = 'substituicao';
    } else if (comentarioLower.includes('sucessão') || comentarioLower.includes('sucessor')) {
      motivo = 'sucessao';
    }

    // VagaId
    const vagaEsperadaId = item.tipoPosto.vagas === 1 ? idPosto : `${idPosto}.${item.seqVaga}`;
    const vagaIdFinal = vagasMap.has(item.rawId) ? item.rawId : (vagasMap.has(vagaEsperadaId) ? vagaEsperadaId : (item.tipoPosto.vagas === 1 ? idPosto : `${idPosto}.1`));

    // Extract horario / escala
    const horarioEscalaRm = rmMatch ? rmMatch.horarioDesc : undefined;
    
    // Determine dataBaseCiclo
    let dataBaseCiclo = undefined;
    if (horarioEscalaRm && (horarioEscalaRm.includes('12X36') || horarioEscalaRm.includes('4X4') || horarioEscalaRm.includes('4X2'))) {
      dataBaseCiclo = '2026-08-10'; // Início do ciclo de medição Petrobras
    }

    const alocacao = {
      id: `alc-${vagaIdFinal}-${rmMatch ? rmMatch.chapa : item.colabId || 'sem-id'}-${item.linhaExcel}`,
      vagaId: vagaIdFinal,
      matricula: rmMatch ? rmMatch.chapa : (item.colabId !== '-' ? item.colabId : ''),
      identificadorPetrobras: item.colabId !== '-' ? item.colabId : undefined,
      nome: item.colabNome !== '-' ? item.colabNome : 'VAGO',
      dataInicio: item.dataAdmissao || '2024-01-01',
      dataFim: null, // Vigente
      horarioEscalaRm,
      dataBaseCiclo,
      motivo,
      observacoes: item.comentario || undefined,
    };

    alocacoesList.push(alocacao);
  }
}

console.log('Postos gerados:', postosMap.size);
console.log('Vagas geradas:', vagasMap.size);
console.log('Alocações geradas:', alocacoesList.length);
console.log('\n--- RESUMO DO RELATÓRIO DE INCONSISTÊNCIAS ---');
console.log('1. IDs Duplicados:', relatorio.idsDuplicados.length);
console.log('2. Excesso de pessoas por posto:', relatorio.excessoPessoasPorPosto.length);
console.log('3. Divergências no Divisor da Fórmula:', relatorio.divergenciasDivisor.length);
console.log('4. Colaboradores sem RM:', relatorio.colaboradoresSemRm.length);
