const xlsx = require('xlsx');

const wb = xlsx.readFile('funcionarios petrobras.XLSX');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows in funcionarios:', data.length);
for (let i = 0; i < Math.min(5, data.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}
