const xlsx = require('xlsx');

const wb = xlsx.readFile('Memoria_Calculo.xlsx');
const sheet = wb.Sheets['MC'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 8; i < 30; i++) {
  const row = data[i];
  if (!row) continue;
  console.log(`Row ${i} -> ID: ${row[0]} | PPU: ${row[1]} | Peric: ${row[2]} | Mun: ${row[3]} | Local: ${row[4]} | Ger: ${row[5]} | ColabID: ${row[6]} | Nome: ${row[7]} | Posto: ${row[8]} | Divisor/Qtd: ${row[24]}`);
}
