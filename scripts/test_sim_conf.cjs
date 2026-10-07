const fs = require('fs');
const path = require('path');

// Execute through TypeScript bundle / tsx
async function run() {
  const { simularImportacaoFuncionariosRm, confirmarImportacaoFuncionariosRm } = require('../src/lib/importadores/rm-funcionarios');
  const { carregarEstado } = require('../src/lib/dados/estado-operacional');

  const buf = fs.readFileSync('FUNCIONÁRIOS PETROBRAS novo.XLS');
  const sim = await simularImportacaoFuncionariosRm(buf, 'FUNCIONÁRIOS PETROBRAS novo.XLS', '2026-09-09', { competencia: '2026-09' });
  console.log('Simulação concluída:');
  console.log('Totais:', sim.totais);
  console.log('Competencia:', sim.competencia);

  const res = confirmarImportacaoFuncionariosRm(sim, 'Teste');
  console.log('Confirmação:', res);

  const est = carregarEstado();
  console.log('Total ocorrências no estado:', est.ocorrencias?.length);
  const ferias = est.ocorrencias?.filter(o => o.tipoOcorrencia === 'FERIAS');
  console.log('Férias count:', ferias?.length);
  ferias?.forEach(f => console.log(' - Férias:', f.matricula, f.profissionalNome, f.dataInicio, f.dataFim));
  
  const afast = est.ocorrencias?.filter(o => o.categoriaAusencia === 'Afastamento' || o.tipoOcorrencia === 'ATESTADO_MEDICO');
  console.log('Afastamento count:', afast?.length);
}

run().catch(console.error);
