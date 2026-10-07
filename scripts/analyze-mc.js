const xlsx = require('xlsx');

const wbMC = xlsx.readFile('Memoria_Calculo.xlsx');
const sheetMC = wbMC.Sheets['MC'];
const rowsMC = xlsx.utils.sheet_to_json(sheetMC, { header: 1 });

const wbFunc = xlsx.readFile('funcionarios petrobras.XLSX');
const sheetFunc = wbFunc.Sheets[wbFunc.SheetNames[0]];
const rowsFunc = xlsx.utils.sheet_to_json(sheetFunc, { header: 1 });

console.log('MC rows count:', rowsMC.length);
console.log('Func rows count:', rowsFunc.length);

// Headers in MC are at row 3 (0-indexed)
const mcHeaders = rowsMC[3];
console.log('MC Headers:', mcHeaders);

// Headers in Func are at row 0
const funcHeaders = rowsFunc[0];
console.log('Func Headers (subset):', funcHeaders.slice(0, 15));
