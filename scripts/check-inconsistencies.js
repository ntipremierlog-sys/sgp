const xlsx = require('xlsx');

const wbMC = xlsx.readFile('Memoria_Calculo.xlsx', { cellFormula: true });
const sheetMC = wbMC.Sheets['MC'];
const rowsMC = xlsx.utils.sheet_to_json(sheetMC, { header: 1 });

const wbFunc = xlsx.readFile('funcionarios petrobras.XLSX');
const sheetFunc = wbFunc.Sheets[wbFunc.SheetNames[0]];
const rowsFunc = xlsx.utils.sheet_to_json(sheetFunc, { header: 1 });

// Build RM lookup maps
// Func headers: 0: Nome, 1: Chapa, 11: Descrição do Horario, 15: Identificador, 19: Horário
const rmPorChapa = new Map();
const rmPorNome = new Map();
const rmPorIdentificador = new Map();

for (let i = 1; i < rowsFunc.length; i++) {
  const row = rowsFunc[i];
  if (!row) continue;
  const nome = String(row[0] || '').trim().toUpperCase();
  const chapa = String(row[1] || '').trim().padStart(6, '0');
  const horarioDesc = String(row[11] || '').trim();
  const identificador = String(row[15] || '').trim();
  const horarioCod = String(row[19] || '').trim();

  const funcData = {
    nome,
    chapa,
    horarioDesc,
    identificador,
    horarioCod,
    linhaOriginal: i + 1,
  };

  if (chapa && chapa !== '000000') rmPorChapa.set(chapa, funcData);
  if (nome) rmPorNome.set(nome, funcData);
  if (identificador) rmPorIdentificador.set(identificador, funcData);
}

console.log('RM Map created. Total RM:', rowsFunc.length - 1);

// Map of TipoPosto -> expected slots (divisor)
const VAGAS_POR_TIPO = {
  'Adm/09h': 1,
  'Adm/12h': 2,
  'Adm/16h': 2,
  'Turno/12h': 2,
  'Turno/16h': 3,
  'Turno/24h': 4,
};

function extrairTipoPosto(postoStr) {
  if (!postoStr) return null;
  const p = String(postoStr).trim();
  for (const tipo of Object.keys(VAGAS_POR_TIPO)) {
    if (p.includes(tipo)) return tipo;
  }
  // Try case-insensitive or variations
  if (/adm.*09/i.test(p)) return 'Adm/09h';
  if (/adm.*12/i.test(p)) return 'Adm/12h';
  if (/adm.*16/i.test(p)) return 'Adm/16h';
  if (/turno.*12/i.test(p)) return 'Turno/12h';
  if (/turno.*16/i.test(p)) return 'Turno/16h';
  if (/turno.*24/i.test(p)) return 'Turno/24h';
  return null;
}

function extrairDivisorFormula(cellFormula) {
  if (!cellFormula) return 1;
  const m = cellFormula.match(/\/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

// Data structures for analysis
const todasLinhas = [];
const idsOcorrencias = new Map(); // idString -> array of row indices
const pessoasPorPosto = new Map(); // idPosto -> array of people/rows

for (let r = 4; r < rowsMC.length; r++) {
  const row = rowsMC[r];
  if (!row || row[0] === null || row[0] === undefined || String(row[0]).trim() === '') continue;

  const rawId = String(row[0]).trim();
  const itemPPU = String(row[1] || '').trim();
  const periculosidade = String(row[2] || '').trim().toUpperCase();
  const municipio = String(row[3] || '').trim();
  const localAtuacao = String(row[4] || '').trim();
  const gerencia = String(row[5] || '').trim();
  const colabId = String(row[6] || '').trim();
  const colaborador = String(row[7] || '').trim().toUpperCase();
  const postoServico = String(row[8] || '').trim();

  // Excel cell formula in column Y (row r+1)
  const cellY = sheetMC['Y' + (r + 1)];
  const cellFormula = cellY ? cellY.f : '';
  const divisorFormula = extrairDivisorFormula(cellFormula);
  const tipoPosto = extrairTipoPosto(postoServico);
  const vagasEsperadas = tipoPosto ? VAGAS_POR_TIPO[tipoPosto] : null;

  // Derive idPosto from rawId:
  // e.g. "6.1" -> idPosto = "6", "7.3" -> idPosto = "7", "1" -> idPosto = "1", "227" -> idPosto = "227"
  const dotIndex = rawId.indexOf('.');
  const idPosto = dotIndex > -1 ? rawId.substring(0, dotIndex) : rawId;
  const seqVaga = dotIndex > -1 ? parseInt(rawId.substring(dotIndex + 1), 10) : 1;

  // Cross with RM
  let rmMatch = null;
  if (colaborador) {
    rmMatch = rmPorNome.get(colaborador);
  }
  // Try matching by colabId (could be Petrobras ID or chapa)
  if (!rmMatch && colabId) {
    const chapaPad = colabId.padStart(6, '0');
    rmMatch = rmPorChapa.get(chapaPad) || rmPorIdentificador.get(colabId);
  }

  const record = {
    excelRow: r + 1,
    rawId,
    idPosto,
    seqVaga,
    itemPPU,
    periculosidade,
    municipio,
    localAtuacao,
    gerencia,
    colabId,
    colaborador,
    postoServico,
    tipoPosto,
    vagasEsperadas,
    cellFormula,
    divisorFormula,
    rmMatch,
  };

  todasLinhas.push(record);

  // Track rawId occurrences
  if (!idsOcorrencias.has(rawId)) idsOcorrencias.set(rawId, []);
  idsOcorrencias.get(rawId).push(record);

  // Track people per idPosto
  if (!pessoasPorPosto.has(idPosto)) pessoasPorPosto.set(idPosto, []);
  pessoasPorPosto.get(idPosto).push(record);
}

console.log('Linhas de dados válidas na MC:', todasLinhas.length);
console.log('Total de Postos distintos (idPosto):', pessoasPorPosto.size);

// 1. IDs duplicados
console.log('\n=== 1. IDs DUPLICADOS ===');
let totalDuplicados = 0;
for (const [id, list] of idsOcorrencias.entries()) {
  if (list.length > 1) {
    totalDuplicados++;
    console.log(`ID "${id}" aparece ${list.length} vezes:`);
    list.forEach(item => {
      console.log(`   - Linha Excel ${item.excelRow}: Colab="${item.colaborador}" (ID Pet: ${item.colabId}) Posto="${item.postoServico}"`);
    });
  }
}
console.log('Total de IDs duplicados:', totalDuplicados);

// 2. Mais pessoas do que vagas no mesmo posto
console.log('\n=== 2. MAIS PESSOAS DO QUE VAGAS NO MESMO POSTO ===');
let totalExcessoPessoas = 0;
for (const [idPosto, list] of pessoasPorPosto.entries()) {
  const vagas = list[0].vagasEsperadas || 1;
  if (list.length > vagas) {
    totalExcessoPessoas++;
    console.log(`Posto idPosto "${idPosto}" (Tipo: ${list[0].tipoPosto}, Vagas: ${vagas}) tem ${list.length} pessoas:`);
    list.forEach(item => {
      console.log(`   - Linha Excel ${item.excelRow} (ID: ${item.rawId}): Colab="${item.colaborador}"`);
    });
  }
}
console.log('Total de postos com excesso de pessoas:', totalExcessoPessoas);

// 3. Linhas cujo tipo de posto não bate com o divisor usado
console.log('\n=== 3. TIPO DE POSTO NÃO BATE COM O DIVISOR USADO ===');
let totalDivisorInvalido = 0;
for (const item of todasLinhas) {
  if (item.vagasEsperadas !== null && item.vagasEsperadas !== item.divisorFormula) {
    totalDivisorInvalido++;
    console.log(`Linha Excel ${item.excelRow} (ID: ${item.rawId}): TipoPosto="${item.tipoPosto}" (Vagas: ${item.vagasEsperadas}) vs Divisor Formula=${item.divisorFormula} (Formula: ${item.cellFormula})`);
  }
}
console.log('Total de linhas com divergência no divisor:', totalDivisorInvalido);

// 4. Colaborador sem correspondência no RM
console.log('\n=== 4. COLABORADOR SEM CORRESPONDÊNCIA NO RM ===');
let totalSemRm = 0;
for (const item of todasLinhas) {
  if (!item.rmMatch) {
    totalSemRm++;
    console.log(`Linha Excel ${item.excelRow} (ID: ${item.rawId}): Colaborador="${item.colaborador}", ID Pet="${item.colabId}"`);
  }
}
console.log('Total de colaboradores sem correspondência no RM:', totalSemRm);
