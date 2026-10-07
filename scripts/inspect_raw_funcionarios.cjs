const fs = require('fs');
const XLSX = require('xlsx');

const fileBuffer = fs.readFileSync('FUNCIONÁRIOS PETROBRAS novo.XLS');
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

const situacoes = new Set();
const descSituacoes = new Set();

data.forEach(r => {
  situacoes.add(r['Situação']);
  descSituacoes.add(r['Descrição da Situação']);
});

console.log('Distinct Situação:', Array.from(situacoes));
console.log('Distinct Descrição da Situação:', Array.from(descSituacoes));

const sampleWithDesc = data.filter(r => r['Situação'] !== 'A' || r['Descrição da Situação'] !== 'Ativo');
console.log('Not strictly A/Ativo:', sampleWithDesc.length);
sampleWithDesc.forEach(r => {
  console.log(`Chapa: ${r['Chapa']} | Nome: ${r['Nome']} | Situação: ${r['Situação']} | Desc: ${r['Descrição da Situação']}`);
});
