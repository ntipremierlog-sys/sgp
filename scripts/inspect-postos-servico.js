const xlsx = require('xlsx');

const wbMC = xlsx.readFile('Memoria_Calculo.xlsx');
const sheetMC = wbMC.Sheets['MC'];
const rowsMC = xlsx.utils.sheet_to_json(sheetMC, { header: 1 });

const postosServico = new Set();
for (let i = 4; i < rowsMC.length; i++) {
  const row = rowsMC[i];
  if (!row || !row[0]) continue;
  postosServico.add(row[8]);
}

console.log('Unique POSTO DE SERVIÇO values:');
for (const p of postosServico) {
  console.log('-', p);
}
