const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Leitura da Memória de Cálculo (Aba MC)
const wbMC = xlsx.readFile('Memoria_Calculo.xlsx');
const sheetMC = wbMC.Sheets['MC'];
const rowsMC = xlsx.utils.sheet_to_json(sheetMC, { header: 1 });

// 2. Leitura da exportação de funcionários do RM
const wbFunc = xlsx.readFile('funcionarios petrobras.XLSX');
const sheetFunc = wbFunc.Sheets[wbFunc.SheetNames[0]];
const rowsFunc = xlsx.utils.sheet_to_json(sheetFunc, { header: 1 });

// Indexação RM para cruzamento por Chapa/Matrícula, Nome e Identificador Petrobras
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

// Catálogo fixo oficial de TipoPosto
const TIPOS_POSTO = {
  ADM_09H: { id: 'ADM_09H', nome: 'Adm/09h', vagas: 1 },
  ADM_12H: { id: 'ADM_12H', nome: 'Adm/12h', vagas: 2 },
  ADM_16H: { id: 'ADM_16H', nome: 'Adm/16h', vagas: 2 },
  TURNO_12H: { id: 'TURNO_12H', nome: 'Turno/12h', vagas: 2 },
  TURNO_16H: { id: 'TURNO_16H', nome: 'Turno/16h', vagas: 3 },
  TURNO_24H: { id: 'TURNO_24H', nome: 'Turno/24h', vagas: 4 },
};

function resolverTipoPosto(postoServico) {
  const p = String(postoServico || '').trim();
  if (p.includes('Turno/24h')) return TIPOS_POSTO.TURNO_24H;
  if (p.includes('Turno/16h')) return TIPOS_POSTO.TURNO_16H;
  if (p.includes('Turno/12h')) return TIPOS_POSTO.TURNO_12H;
  if (p.includes('Adm/16h')) return TIPOS_POSTO.ADM_16H;
  if (p.includes('Adm/12h')) return TIPOS_POSTO.ADM_12H;
  if (p.includes('Adm/09h')) return TIPOS_POSTO.ADM_09H;
  // Fallback padrão administrativo
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

const postosMap = new Map();
const vagasMap = new Map();
const alocacoesList = [];

const relatorio = {
  dataGeracao: new Date().toISOString(),
  resumo: {
    totalLinhasMC: 0,
    totalPostos: 0,
    totalVagas: 0,
    totalAlocacoes: 0,
    totalIdsDuplicados: 0,
    totalPostosComExcessoPessoas: 0,
    totalColaboradoresSemRM: 0,
  },
  // As 3 categorias de inconsistências solicitadas:
  idsDuplicados: [],
  excessoPessoasPorPosto: [],
  colaboradoresSemRm: [],
};

const idsOcorrencias = new Map();
const linhasPorIdPosto = new Map();

for (let r = 4; r < rowsMC.length; r++) {
  const row = rowsMC[r];
  if (!row || row[0] === null || row[0] === undefined || String(row[0]).trim() === '') continue;

  // Apenas as colunas estruturais solicitadas:
  const rawId = String(row[0]).trim();
  const itemPPU = String(row[1] || '').trim(); // apenas código contratual, sem valor
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

  // NOTA: Colunas 16 em diante (Valor da PPU, Preço com deflator, Avaliações, Notas, Descontos,
  // Quantidade a medir e Valor Medição) são ESTRITAMENTE IGNORADAS nesta fase.

  const dotIdx = rawId.indexOf('.');
  const idPosto = dotIdx > -1 ? rawId.substring(0, dotIdx) : rawId;
  const seqVaga = dotIdx > -1 ? parseInt(rawId.substring(dotIdx + 1), 10) : 1;

  const tipoPosto = resolverTipoPosto(postoServico);

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
  };

  if (!idsOcorrencias.has(rawId)) idsOcorrencias.set(rawId, []);
  idsOcorrencias.get(rawId).push(itemLinha);

  if (!linhasPorIdPosto.has(idPosto)) linhasPorIdPosto.set(idPosto, []);
  linhasPorIdPosto.get(idPosto).push(itemLinha);
}

relatorio.resumo.totalLinhasMC = rowsMC.length - 4;

// 1. Relatório de IDs Duplicados
for (const [id, list] of idsOcorrencias.entries()) {
  if (list.length > 1) {
    relatorio.idsDuplicados.push({
      id,
      totalOcorrencias: list.length,
      linhas: list.map(l => ({
        linhaExcel: l.linhaExcel,
        colaborador: l.colabNome,
        identificadorPetrobras: l.colabId,
        postoServico: l.postoServico,
        comentario: l.comentario,
      })),
    });
  }
}
relatorio.resumo.totalIdsDuplicados = relatorio.idsDuplicados.length;

// 2. Relatório de Mais pessoas do que vagas no mesmo posto & Criação de Postos e Vagas
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
      excesso: list.length - vagasEsperadas,
      ocupantes: list.map(l => ({
        linhaExcel: l.linhaExcel,
        idNaMC: l.rawId,
        colaborador: l.colabNome,
        identificadorPetrobras: l.colabId,
        comentario: l.comentario,
      })),
    });
  }

  let escala = '5x2';
  let jornadaSemanal = 44;
  let horarioInicio = '07:00';
  let horarioFim = '16:48';

  if (tipoPosto.id === 'TURNO_24H' || tipoPosto.id === 'TURNO_12H') {
    escala = '12x36';
    jornadaSemanal = 36;
    horarioInicio = '07:00';
    horarioFim = '19:00';
  } else if (tipoPosto.id === 'TURNO_16H' || tipoPosto.id === 'ADM_16H' || tipoPosto.id === 'ADM_12H') {
    escala = '5x2';
    jornadaSemanal = 40;
    horarioInicio = '07:00';
    horarioFim = '15:48';
  }

  // Modelo PostoOperacional sem valores financeiros, apenas identificação contratual
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

  // Vagas automáticas a partir do tipo de posto (Regra 3)
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

  // Preservar slots se a planilha de origem tiver linhas adicionais (ex: 8.5)
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
relatorio.resumo.totalPostosComExcessoPessoas = relatorio.excessoPessoasPorPosto.length;

// 3. Relatório de Colaborador sem correspondência no RM & Criação das Alocações
for (const [idPosto, list] of linhasPorIdPosto.entries()) {
  for (const item of list) {
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

    let motivo = 'titular';
    const comentarioLower = item.comentario.toLowerCase();
    if (comentarioLower.includes('ferista')) {
      motivo = 'ferista';
    } else if (comentarioLower.includes('substituto') || comentarioLower.includes('substituição') || comentarioLower.includes('afastado')) {
      motivo = 'substituicao';
    } else if (comentarioLower.includes('sucessão') || comentarioLower.includes('sucessor')) {
      motivo = 'sucessao';
    }

    const vagaEsperadaId = item.tipoPosto.vagas === 1 ? idPosto : `${idPosto}.${item.seqVaga}`;
    const vagaIdFinal = vagasMap.has(item.rawId) ? item.rawId : (vagasMap.has(vagaEsperadaId) ? vagaEsperadaId : (item.tipoPosto.vagas === 1 ? idPosto : `${idPosto}.1`));

    const horarioEscalaRm = rmMatch ? rmMatch.horarioDesc : undefined;

    let dataBaseCiclo = undefined;
    if (horarioEscalaRm && (horarioEscalaRm.includes('12X36') || horarioEscalaRm.includes('4X4') || horarioEscalaRm.includes('4X2'))) {
      dataBaseCiclo = '2026-08-10'; // Início do ciclo
    }

    const alocacao = {
      id: `alc-${vagaIdFinal}-${rmMatch ? rmMatch.chapa : item.colabId || 'vago'}-${item.linhaExcel}`,
      vagaId: vagaIdFinal,
      matricula: rmMatch ? rmMatch.chapa : (item.colabId !== '-' ? item.colabId : ''),
      identificadorPetrobras: item.colabId !== '-' ? item.colabId : undefined,
      nome: item.colabNome !== '-' ? item.colabNome : 'VAGO',
      dataInicio: item.dataAdmissao || '2024-01-01',
      dataFim: null, // vigente
      horarioEscalaRm,
      dataBaseCiclo,
      motivo,
      observacoes: item.comentario || undefined,
    };

    alocacoesList.push(alocacao);
  }
}

relatorio.resumo.totalColaboradoresSemRM = relatorio.colaboradoresSemRm.length;
relatorio.resumo.totalPostos = postosMap.size;
relatorio.resumo.totalVagas = vagasMap.size;
relatorio.resumo.totalAlocacoes = alocacoesList.length;

// Salvar arquivos JSON
const postosArr = Array.from(postosMap.values());
const vagasArr = Array.from(vagasMap.values());

fs.writeFileSync(path.join('src', 'lib', 'dados', 'postos-mc-reais.json'), JSON.stringify(postosArr, null, 2), 'utf8');
fs.writeFileSync(path.join('src', 'lib', 'dados', 'vagas-mc-reais.json'), JSON.stringify(vagasArr, null, 2), 'utf8');
fs.writeFileSync(path.join('src', 'lib', 'dados', 'alocacoes-mc-reais.json'), JSON.stringify(alocacoesList, null, 2), 'utf8');
fs.writeFileSync(path.join('src', 'lib', 'dados', 'relatorio-inconsistencias-mc.json'), JSON.stringify(relatorio, null, 2), 'utf8');

console.log('Arquivos gerados com sucesso!');
console.log('Postos salvos (sem valores/preços):', postosArr.length);
console.log('Vagas salvas:', vagasArr.length);
console.log('Alocações salvas:', alocacoesList.length);
console.log('Relatório resumo:', JSON.stringify(relatorio.resumo, null, 2));
