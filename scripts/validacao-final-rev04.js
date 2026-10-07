const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelPath = path.resolve('Base_Estruturada_SGP_Petrobras_REV04.xlsx');
const dadosDir = path.resolve('src/lib/dados');

const workbook = xlsx.readFile(excelPath, { raw: false, cellText: true });

// Carregar abas da planilha
const sheet01 = xlsx.utils.sheet_to_json(workbook.Sheets['01_MAPA_CADASTRO'], { raw: false, defval: '' });
const sheet02 = xlsx.utils.sheet_to_json(workbook.Sheets['02_POSTOS'], { raw: false, defval: '' });
const sheet03 = xlsx.utils.sheet_to_json(workbook.Sheets['03_POSICOES'], { raw: false, defval: '' });
const sheet07 = xlsx.utils.sheet_to_json(workbook.Sheets['07_FERISTAS_COBERTURA'], { raw: false, defval: '' });
const sheet08 = xlsx.utils.sheet_to_json(workbook.Sheets['08_ESCALAS_POSICOES'], { raw: false, defval: '' });

// Carregar arquivos gravados no banco/camada oficial
const unidadesCarregadas = JSON.parse(fs.readFileSync(path.join(dadosDir, 'unidades-rev04.json'), 'utf8'));
const postosCarregados = JSON.parse(fs.readFileSync(path.join(dadosDir, 'postos-rev04.json'), 'utf8'));
const posicoesCarregadas = JSON.parse(fs.readFileSync(path.join(dadosDir, 'posicoes-rev04.json'), 'utf8'));
const alocacoesCarregadas = JSON.parse(fs.readFileSync(path.join(dadosDir, 'alocacoes-rev04.json'), 'utf8'));
const feristasCarregados = JSON.parse(fs.readFileSync(path.join(dadosDir, 'feristas-rev04.json'), 'utf8'));
const escalasCarregadas = JSON.parse(fs.readFileSync(path.join(dadosDir, 'escalas-rev04.json'), 'utf8'));

console.log('================================================================');
console.log('RELATÓRIO DE VALIDAÇÃO FINAL DA CARGA REV04');
console.log('================================================================\n');

// 1. TOTAIS GLOBAIS
const totalUnidadesPlanilha = new Set(sheet01.map(r => String(r['Unidade'] || '').trim()).filter(Boolean)).size;
const totalPostosPlanilha = sheet02.length;
const totalPosicoesPlanilha = sheet03.filter(r => r['Posicao_ID_SGP'] && !String(r['Posicao_ID_SGP']).includes('REGRA')).length;
const vagasPlanilha = sheet03.filter(r => String(r['Posicao_Sem_Titular_MC'] || '').trim().toUpperCase() === 'SIM').length;
const ocupadasPlanilha = totalPosicoesPlanilha - vagasPlanilha;

const totalAlocacoesPlanilha = sheet01.length;
const titularesPlanilha = sheet01.filter(r => String(r['Tipo_Alocacao_Validado'] || '').trim().toUpperCase() === 'TITULAR/REGULAR').length;
const feristasPlanilha = sheet01.filter(r => String(r['Tipo_Alocacao_Validado'] || '').trim().toUpperCase() === 'FERISTA').length;
const substitutosPlanilha = sheet01.filter(r => String(r['Tipo_Alocacao_Validado'] || '').trim().toUpperCase() === 'SUBSTITUTO').length;

const totalFeristasAba07 = sheet07.length;
const totalEscalasAba08 = sheet08.length;

// No banco
const totalUnidadesBanco = unidadesCarregadas.length;
const totalPostosBanco = postosCarregados.length;
const totalPosicoesBanco = posicoesCarregadas.length;
const vagasBanco = posicoesCarregadas.filter(p => p.ehVaga || String(p.posicaoSemTitularMC).toUpperCase() === 'SIM').length;
const ocupadasBanco = posicoesCarregadas.filter(p => !p.ehVaga && String(p.posicaoSemTitularMC).toUpperCase() !== 'SIM').length;

const totalAlocacoesBanco = alocacoesCarregadas.length;
const titularesBanco = alocacoesCarregadas.filter(a => String(a.tipoAlocacaoValidado).toUpperCase() === 'TITULAR/REGULAR').length;
const feristasAlocBanco = alocacoesCarregadas.filter(a => String(a.tipoAlocacaoValidado).toUpperCase() === 'FERISTA').length;
const substitutosBanco = alocacoesCarregadas.filter(a => String(a.tipoAlocacaoValidado).toUpperCase() === 'SUBSTITUTO').length;

const totalFeristasBanco = feristasCarregados.length;
const totalEscalasBanco = escalasCarregadas.length;

console.log('--- CONFERÊNCIA DE TOTAIS GLOBAIS ---');
const globais = [
  { Metrica: 'Unidades Distintas', Planilha: totalUnidadesPlanilha, Banco: totalUnidadesBanco, Status: totalUnidadesPlanilha === totalUnidadesBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: 'Postos de Serviço', Planilha: totalPostosPlanilha, Banco: totalPostosBanco, Status: totalPostosPlanilha === totalPostosBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: 'Posições Totais', Planilha: totalPosicoesPlanilha, Banco: totalPosicoesBanco, Status: totalPosicoesPlanilha === totalPosicoesBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: '  - Posições Ocupadas', Planilha: ocupadasPlanilha, Banco: ocupadasBanco, Status: ocupadasPlanilha === ocupadasBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: '  - Posições Vagas', Planilha: vagasPlanilha, Banco: vagasBanco, Status: vagasPlanilha === vagasBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: 'Alocações Totais', Planilha: totalAlocacoesPlanilha, Banco: totalAlocacoesBanco, Status: totalAlocacoesPlanilha === totalAlocacoesBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: '  - Titulares', Planilha: titularesPlanilha, Banco: titularesBanco, Status: titularesPlanilha === titularesBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: '  - Feristas', Planilha: feristasPlanilha, Banco: feristasAlocBanco, Status: feristasPlanilha === feristasAlocBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: '  - Substitutos', Planilha: substitutosPlanilha, Banco: substitutosBanco, Status: substitutosPlanilha === substitutosBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: 'Feristas de Cobertura (Aba 07)', Planilha: totalFeristasAba07, Banco: totalFeristasBanco, Status: totalFeristasAba07 === totalFeristasBanco ? 'OK' : 'DIVERGÊNCIA' },
  { Metrica: 'Escalas de Posições (Aba 08)', Planilha: totalEscalasAba08, Banco: totalEscalasBanco, Status: totalEscalasAba08 === totalEscalasBanco ? 'OK' : 'DIVERGÊNCIA' },
];
console.table(globais);

// 2. CONFERÊNCIA POR UNIDADE
console.log('\n--- CONFERÊNCIA POR UNIDADE (ALOCAÇÕES PLANILHA × BANCO) ---');
const unidadesMapPlanilha = {};
sheet01.forEach(r => {
  const u = String(r['Unidade'] || '').trim();
  if (u) unidadesMapPlanilha[u] = (unidadesMapPlanilha[u] || 0) + 1;
});

const unidadesMapBanco = {};
alocacoesCarregadas.forEach(r => {
  const u = String(r.unidade || '').trim();
  if (u) unidadesMapBanco[u] = (unidadesMapBanco[u] || 0) + 1;
});

const todasUnidades = Array.from(new Set([...Object.keys(unidadesMapPlanilha), ...Object.keys(unidadesMapBanco)])).sort();

const linhasUnidade = todasUnidades.map((u, idx) => {
  const qtdPlanilha = unidadesMapPlanilha[u] || 0;
  const qtdBanco = unidadesMapBanco[u] || 0;
  const dif = qtdBanco - qtdPlanilha;
  return {
    Item: idx + 1,
    Unidade: u,
    'Alocações Planilha': qtdPlanilha,
    'Alocações Banco': qtdBanco,
    Diferença: dif === 0 ? '0' : (dif > 0 ? `+${dif}` : `${dif}`),
    Status: dif === 0 ? 'OK' : 'DIVERGÊNCIA'
  };
});

console.table(linhasUnidade);

// Conferência específica EDIHB e REDUC
console.log('Verificação obrigatória:');
console.log('EDIHB:', unidadesMapBanco['EDIHB'] === 84 ? 'CONFIRMADO (84)' : `ERRO (${unidadesMapBanco['EDIHB']})`);
console.log('REDUC:', unidadesMapBanco['REDUC'] === 23 ? 'CONFIRMADO (23)' : `ERRO (${unidadesMapBanco['REDUC']})`);

// 3. Salvar relatório estruturado em JSON para artefato
const resultadoValidacao = {
  dataValidacao: new Date().toISOString(),
  totaisGlobais: globais,
  conferenciaUnidades: linhasUnidade,
  verificacoesEspeciais: {
    edihb: { esperado: 84, obtido: unidadesMapBanco['EDIHB'], ok: unidadesMapBanco['EDIHB'] === 84 },
    reduc: { esperado: 23, obtido: unidadesMapBanco['REDUC'], ok: unidadesMapBanco['REDUC'] === 23 },
    vagasConfirmadas: { esperado: 19, obtido: vagasBanco, ok: vagasBanco === 19 },
    ocupadasConfirmadas: { esperado: 292, obtido: ocupadasBanco, ok: ocupadasBanco === 292 },
    titularesConfirmados: { esperado: 297, obtido: titularesBanco, ok: titularesBanco === 297 },
    feristasConfirmados: { esperado: 23, obtido: feristasAlocBanco, ok: feristasAlocBanco === 23 },
    substitutosConfirmados: { esperado: 2, obtido: substitutosBanco, ok: substitutosBanco === 2 },
    semDivergenciaGeral: linhasUnidade.every(l => l.Status === 'OK') && globais.every(g => g.Status === 'OK')
  }
};

fs.writeFileSync(path.join(dadosDir, 'resultado-validacao-final.json'), JSON.stringify(resultadoValidacao, null, 2), 'utf8');
console.log('\nValidação salva em src/lib/dados/resultado-validacao-final.json');
