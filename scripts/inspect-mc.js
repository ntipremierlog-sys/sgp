const xlsx = require('xlsx');

const wb = xlsx.readFile('Memoria_Calculo.xlsx');
const sheet = wb.Sheets['MC'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows in MC:', data.length);
for (let i = 0; i < Math.min(10, data.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
