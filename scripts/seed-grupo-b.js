/**
 * SGP — Sistema de Gestão de Postos
 * Script de Carga Idempotente do Grupo (b) para o Banco Neon PostgreSQL (Branch Preview)
 *
 * Carga estritamente idempotente (upsert / skipDuplicates) dos dados estruturais e históricos:
 * - Contrato Petrobras ICJ 5900.0129796.25.2
 * - ItemPpu (19 itens contratuais)
 * - RegimePosto (6 tipos)
 * - Imovel (29 imóveis)
 * - Unidade (29 unidades)
 * - Posto (244 postos)
 * - PosicaoPosto (311 posições)
 * - Profissional (389 colaboradores)
 * - FeristaPosto (23 feristas)
 * - Alocacao (alocações estruturais com chapa e posto)
 * - TipoOcorrencia (tipos de ausência)
 * - Ocorrencia (92 ocorrências reais)
 * - MarcacaoPonto (38.901 marcações em lotes)
 *
 * NUNCA executar automaticamente em build ou deploy.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carregar .env.local SOBRESCREVENDO qualquer variável prévia
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const dbUrl = process.env.DATABASE_URL || '';
const hostMatch = dbUrl.match(/@([^\/:]+)/);
const host = hostMatch ? hostMatch[1] : 'desconhecido';
const hostPrefix = host.split('.')[0];

console.log('================================================================');
console.log('SGP — CARGA IDEMPOTENTE DO GRUPO (b) NO BANCO PREVIEW');
console.log('Servidor conectado:', hostPrefix.startsWith('ep-sweet-rice') ? hostPrefix.substring(0, 13) + '... (CONFIRMADO BRANCH PREVIEW)' : 'ATENÇÃO: ' + hostPrefix);
console.log('================================================================\n');

if (!hostPrefix.startsWith('ep-sweet-rice')) {
  console.error('ERRO CRÍTICO: O banco de destino não é a branch preview (ep-sweet-rice)! Abortando por segurança.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

function toUuid(str) {
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

const CATALOGO_ITEM_PPU = [
  { codigo: '1.1', descricao: 'Serviços de Apoio Logístico (Adm 09h)', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '1.2', descricao: 'Serviços de Apoio Logístico (Turno 12h)', regime: 'Turno/12h', posicoesPorPosto: 2 },
  { codigo: '2.1', descricao: 'Suporte à Fiscalização de Mobilidade (Adm 09h)', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '2.2', descricao: 'Suporte à Fiscalização de Mobilidade (Turno 12h)', regime: 'Turno/12h', posicoesPorPosto: 2 },
  { codigo: '3.1', descricao: 'Suporte à Operação de Mobilidade (Adm 09h)', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '3.2', descricao: 'Suporte à Operação de Mobilidade (Adm 12h)', regime: 'Adm/12h', posicoesPorPosto: 2 },
  { codigo: '3.3', descricao: 'Suporte à Operação de Mobilidade (Adm 16h)', regime: 'Adm/16h', posicoesPorPosto: 2 },
  { codigo: '3.4', descricao: 'Suporte à Operação de Mobilidade (Turno 12h)', regime: 'Turno/12h', posicoesPorPosto: 2 },
  { codigo: '3.5', descricao: 'Suporte à Operação de Mobilidade (Turno 16h)', regime: 'Turno/16h', posicoesPorPosto: 3 },
  { codigo: '3.6', descricao: 'Suporte à Operação de Mobilidade (Turno 24h)', regime: 'Turno/24h', posicoesPorPosto: 4 },
  { codigo: '4.1', descricao: 'Suporte à Coordenação de Mobilidade (Adm 09h)', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '4.2', descricao: 'Suporte à Coordenação de Mobilidade (Turno 12h)', regime: 'Turno/12h', posicoesPorPosto: 2 },
  { codigo: '5.1', descricao: 'Apoio em Análise de Logística', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '6.1', descricao: 'Apoio em Análise de Mobilidade Corporativa', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '7.1', descricao: 'Análise de Projeto de Mobilidade Corporativa', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '8.1', descricao: 'Análise de Sistemas', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '9.1', descricao: 'Gestão e Liderança nas Atividades Técnicas de Mobilidade', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '10.1', descricao: 'Apoio em Análise de Engenharia', regime: 'Adm/09h', posicoesPorPosto: 1 },
  { codigo: '11.1', descricao: 'Gerenciamento de Mobilidade Corporativa (Adm 09h)', regime: 'Adm/09h', posicoesPorPosto: 1 },
];

async function main() {
  const dadosDir = path.join(__dirname, '..', 'src', 'lib', 'dados');

  // 1. Contrato
  console.log('1/13 Carga do Contrato Petrobras ICJ 5900.0129796.25.2...');
  const contrato = await prisma.contrato.upsert({
    where: { numeroIcj: '5900.0129796.25.2' },
    update: {
      numeroSap: '4600682336',
      objeto: 'Prestação de serviços de apoio operacional e administrativo às unidades da Petrobras',
      cliente: 'Petróleo Brasileiro S.A. - Petrobras',
      vigenciaInicio: new Date('2025-01-01'),
      vigenciaFim: new Date('2028-12-31'),
      ativo: true
    },
    create: {
      numeroIcj: '5900.0129796.25.2',
      numeroSap: '4600682336',
      objeto: 'Prestação de serviços de apoio operacional e administrativo às unidades da Petrobras',
      cliente: 'Petróleo Brasileiro S.A. - Petrobras',
      vigenciaInicio: new Date('2025-01-01'),
      vigenciaFim: new Date('2028-12-31'),
      ativo: true
    }
  });

  // 2. ItemPpu
  console.log('2/13 Carga de Itens da PPU (Catálogo Contratual)...');
  for (const item of CATALOGO_ITEM_PPU) {
    await prisma.itemPpu.upsert({
      where: { codigo: item.codigo },
      update: {
        descricao: item.descricao,
        regime: item.regime,
        posicoesPorPosto: item.posicoesPorPosto
      },
      create: {
        codigo: item.codigo,
        descricao: item.descricao,
        regime: item.regime,
        posicoesPorPosto: item.posicoesPorPosto
      }
    });
  }

  // 3. RegimePosto
  console.log('3/13 Carga de Regimes de Posto (catalogo-tipos-posto-rev02.json)...');
  const regimes = JSON.parse(fs.readFileSync(path.join(dadosDir, 'catalogo-tipos-posto-rev02.json'), 'utf8'));
  const regimeMap = new Map();
  for (const r of regimes) {
    const rec = await prisma.regimePosto.upsert({
      where: { codigo: r.id },
      update: {
        nome: r.nome,
        quantidadePosicoes: r.posicoesPorPosto,
        regraCadastro: r.regraCadastro,
        observacoes: r.observacao || null,
        statusPremissa: r.statusPremissa || 'fechada'
      },
      create: {
        codigo: r.id,
        nome: r.nome,
        quantidadePosicoes: r.posicoesPorPosto,
        regraCadastro: r.regraCadastro,
        observacoes: r.observacao || null,
        statusPremissa: r.statusPremissa || 'fechada'
      }
    });
    regimeMap.set(r.id, rec.id);
  }

  // 4. Imovel
  console.log('4/13 Carga de Imóveis (imoveis-rev04.json)...');
  const imoveis = JSON.parse(fs.readFileSync(path.join(dadosDir, 'imoveis-rev04.json'), 'utf8'));
  const imovelMap = new Map();
  for (const im of imoveis) {
    const imId = toUuid(im.id || im.nome);
    const rec = await prisma.imovel.upsert({
      where: { nome: im.nome },
      update: {
        cidade: im.cidade,
        uf: im.uf,
        gerencia: im.gerencia,
        preposto: im.preposto || null,
        statusImovel: im.statusImovel === 'ATIVO' ? 'ATIVO' : (im.statusImovel === 'INATIVO' ? 'INATIVO' : 'ATIVO')
      },
      create: {
        id: imId,
        nome: im.nome,
        cidade: im.cidade,
        uf: im.uf,
        gerencia: im.gerencia,
        preposto: im.preposto || null,
        statusImovel: im.statusImovel === 'ATIVO' ? 'ATIVO' : (im.statusImovel === 'INATIVO' ? 'INATIVO' : 'ATIVO')
      }
    });
    imovelMap.set(im.nome, rec.id);
  }

  // 5. Unidade
  console.log('5/13 Carga de Unidades (unidades-rev04.json)...');
  const unidades = JSON.parse(fs.readFileSync(path.join(dadosDir, 'unidades-rev04.json'), 'utf8'));
  const unidadeMap = new Map();
  for (const u of unidades) {
    const imovel = imoveis.find(i => i.nome === u.nome);
    const rec = await prisma.unidade.upsert({
      where: { codigo: u.codigo },
      update: {
        nome: u.nome,
        contratoId: contrato.id,
        uf: imovel ? imovel.uf : 'RJ',
        municipio: imovel ? imovel.cidade : u.nome,
        situacao: 'ATIVA'
      },
      create: {
        id: toUuid(u.id || u.codigo),
        codigo: u.codigo,
        nome: u.nome,
        contratoId: contrato.id,
        uf: imovel ? imovel.uf : 'RJ',
        municipio: imovel ? imovel.cidade : u.nome,
        situacao: 'ATIVA'
      }
    });
    unidadeMap.set(u.nome, rec.id);
    unidadeMap.set(u.codigo, rec.id);
  }

  // 6. Posto
  console.log('6/13 Carga de Postos (postos-rev04.json)...');
  const postos = JSON.parse(fs.readFileSync(path.join(dadosDir, 'postos-rev04.json'), 'utf8'));
  const postoMap = new Map();
  for (const p of postos) {
    const unidadeId = unidadeMap.get(p.unidade) || unidadeMap.get(p.unidadeNome);
    const imovelId = imovelMap.get(p.unidade);
    const regimePostoId = p.tipoPostoId ? regimeMap.get(p.tipoPostoId) : null;
    const escala = p.escala === '12x36' ? 'ESCALA_12X36' : (p.escala === '6x1' ? 'ESCALA_6X1' : 'ESCALA_5X2');

    const rec = await prisma.posto.upsert({
      where: { codigoPosto: p.codigoPosto },
      update: {
        postoIdSgp: p.postoIdSGP,
        unidadeId: unidadeId,
        imovelId: imovelId || null,
        itemPpuCodigo: p.itemPPU || null,
        regime: p.tipoPostoNome || null,
        regimePostoId: regimePostoId || null,
        periculosidade: p.periculosidade || 'NÃO',
        fatorMedicao: p.periculosidadeBooleana ? 1.0 : 0.8,
        qtdPosicoes: p.qtdEstruturalConfirmada || p.qtdPosicoesIDObservadas || 1,
        funcao: p.funcao,
        descricao: p.descricao || null,
        escala: escala,
        jornadaSemanalHoras: p.jornadaSemanalHoras || 44,
        quantidade: 1,
        dataInicioVigencia: new Date(p.dataInicioVigencia || '2026-08-10'),
        situacao: 'ATIVO'
      },
      create: {
        id: toUuid(p.postoIdSGP),
        codigoPosto: p.codigoPosto,
        postoIdSgp: p.postoIdSGP,
        unidadeId: unidadeId,
        imovelId: imovelId || null,
        itemPpuCodigo: p.itemPPU || null,
        regime: p.tipoPostoNome || null,
        regimePostoId: regimePostoId || null,
        periculosidade: p.periculosidade || 'NÃO',
        fatorMedicao: p.periculosidadeBooleana ? 1.0 : 0.8,
        qtdPosicoes: p.qtdEstruturalConfirmada || p.qtdPosicoesIDObservadas || 1,
        funcao: p.funcao,
        descricao: p.descricao || null,
        escala: escala,
        jornadaSemanalHoras: p.jornadaSemanalHoras || 44,
        quantidade: 1,
        dataInicioVigencia: new Date(p.dataInicioVigencia || '2026-08-10'),
        situacao: 'ATIVO'
      }
    });
    postoMap.set(p.postoIdSGP, rec.id);
    postoMap.set(p.codigoPosto, rec.id);
  }

  // 7. PosicaoPosto
  console.log('7/13 Carga de Posições (posicoes-rev04.json)...');
  const posicoes = JSON.parse(fs.readFileSync(path.join(dadosDir, 'posicoes-rev04.json'), 'utf8'));
  const posicaoMap = new Map();
  for (const pos of posicoes) {
    const postoId = postoMap.get(pos.postoIdSGP);
    const rec = await prisma.posicaoPosto.upsert({
      where: { posicaoIdSgp: pos.posicaoIdSGP },
      update: {
        postoId: postoId,
        codigoEstrutural: pos.codigoPosicaoEstrutural || null,
        idOriginalMc: pos.idOriginalMC || pos.idsLuizOrigem || null,
        sufixo: pos.sufixo || 1,
        chapaTitular: pos.chapaTitular || null,
        nomeTitular: pos.titularReferencia || null,
        situacaoRm: pos.statusRMTitular || null,
        escalaPendente: Boolean(pos.ehVaga || pos.posicaoSemTitularMC),
        statusValidacao: pos.statusValidacao || 'VALIDADA',
        conflitoCadastro: pos.conflitoCadastro || null,
        ehEstrutural: pos.ehEstrutural !== false,
        horarioRm: pos.horarioRm || pos.horario_rm || null,
        escalaTipo: pos.escalaTipo || pos.escala_tipo || null,
        faixaHoraria: pos.faixaHoraria || pos.faixa_horaria || null,
        regimeDias: pos.regimeDias || pos.regime_dias || null,
        grupoRevezamento: pos.grupoRevezamento || pos.grupo_revezamento || null,
        dataBaseEscala: (pos.dataBaseEscala || pos.data_base_escala) ? new Date(pos.dataBaseEscala || pos.data_base_escala) : null,
        faseCiclo: pos.faseCiclo || pos.fase_ciclo || null,
        fonteEscala: pos.fonteEscala || pos.fonte_escala || null,
        statusProgramacao: pos.statusProgramacao || pos.status_programacao || null
      },
      create: {
        id: toUuid(pos.posicaoIdSGP),
        posicaoIdSgp: pos.posicaoIdSGP,
        postoId: postoId,
        codigoEstrutural: pos.codigoPosicaoEstrutural || null,
        idOriginalMc: pos.idOriginalMC || pos.idsLuizOrigem || null,
        sufixo: pos.sufixo || 1,
        chapaTitular: pos.chapaTitular || null,
        nomeTitular: pos.titularReferencia || null,
        situacaoRm: pos.statusRMTitular || null,
        escalaPendente: Boolean(pos.ehVaga || pos.posicaoSemTitularMC),
        statusValidacao: pos.statusValidacao || 'VALIDADA',
        conflitoCadastro: pos.conflitoCadastro || null,
        ehEstrutural: pos.ehEstrutural !== false,
        horarioRm: pos.horarioRm || pos.horario_rm || null,
        escalaTipo: pos.escalaTipo || pos.escala_tipo || null,
        faixaHoraria: pos.faixaHoraria || pos.faixa_horaria || null,
        regimeDias: pos.regimeDias || pos.regime_dias || null,
        grupoRevezamento: pos.grupoRevezamento || pos.grupo_revezamento || null,
        dataBaseEscala: (pos.dataBaseEscala || pos.data_base_escala) ? new Date(pos.dataBaseEscala || pos.data_base_escala) : null,
        faseCiclo: pos.faseCiclo || pos.fase_ciclo || null,
        fonteEscala: pos.fonteEscala || pos.fonte_escala || null,
        statusProgramacao: pos.statusProgramacao || pos.status_programacao || null
      }
    });
    posicaoMap.set(pos.posicaoIdSGP, rec.id);
  }

  // 8. Profissional
  console.log('8/13 Carga de Profissionais (funcionarios-reais.json)...');
  const funcs = JSON.parse(fs.readFileSync(path.join(dadosDir, 'funcionarios-reais.json'), 'utf8'));
  const profMap = new Map();
  for (const f of funcs) {
    const unidadeId = unidadeMap.get(f.unidadeId) || unidadeMap.get(f.unidadeNome) || Array.from(unidadeMap.values())[0];
    const rec = await prisma.profissional.upsert({
      where: { matricula: f.matricula },
      update: {
        nome: f.nome,
        cpf: f.cpfLimpo || f.cpfMascarado || '00000000000',
        dataNascimento: f.dataNascimento ? new Date(f.dataNascimento) : null,
        funcao: f.funcao,
        dataAdmissao: new Date(f.dataAdmissao || '2026-01-01'),
        dataDesligamento: f.dataDesligamento ? new Date(f.dataDesligamento) : null,
        situacao: (f.situacao === 'ATIVO' ? 'ATIVO' : (f.situacao === 'AFASTADO' ? 'AFASTADO' : (f.situacao === 'FERIAS' ? 'FERIAS' : 'ATIVO'))),
        unidadeId: unidadeId,
        escalaPadrao: f.escala === '12x36' ? 'ESCALA_12X36' : (f.escala === '6x1' ? 'ESCALA_6X1' : 'ESCALA_5X2')
      },
      create: {
        id: toUuid(f.id || f.matricula),
        matricula: f.matricula,
        nome: f.nome,
        cpf: f.cpfLimpo || f.cpfMascarado || '00000000000',
        dataNascimento: f.dataNascimento ? new Date(f.dataNascimento) : null,
        funcao: f.funcao,
        dataAdmissao: new Date(f.dataAdmissao || '2026-01-01'),
        dataDesligamento: f.dataDesligamento ? new Date(f.dataDesligamento) : null,
        situacao: (f.situacao === 'ATIVO' ? 'ATIVO' : (f.situacao === 'AFASTADO' ? 'AFASTADO' : (f.situacao === 'FERIAS' ? 'FERIAS' : 'ATIVO'))),
        unidadeId: unidadeId,
        escalaPadrao: f.escala === '12x36' ? 'ESCALA_12X36' : (f.escala === '6x1' ? 'ESCALA_6X1' : 'ESCALA_5X2')
      }
    });
    profMap.set(f.matricula, rec.id);
    profMap.set(f.chapa, rec.id);
  }

  // 9. FeristaPosto
  console.log('9/13 Carga de Feristas (feristas-rev04.json)...');
  const feristas = JSON.parse(fs.readFileSync(path.join(dadosDir, 'feristas-rev04.json'), 'utf8'));
  for (const fer of feristas) {
    const postoId = postoMap.get(fer.postoIdSGP);
    const chapa = fer.chapaRM || fer.matricula || fer.feristaIdSGP;
    const profId = chapa ? profMap.get(chapa) : null;
    const ferId = toUuid(fer.feristaIdSGP);

    await prisma.feristaPosto.upsert({
      where: { id: ferId },
      update: {
        postoId: postoId,
        chapa: chapa,
        nome: fer.colaborador || fer.nome || null,
        situacaoRm: fer.statusRM || null,
        profissionalId: profId || null,
        ativo: true,
        observacoes: fer.comentarioMC || null
      },
      create: {
        id: ferId,
        postoId: postoId,
        chapa: chapa,
        nome: fer.colaborador || fer.nome || null,
        situacaoRm: fer.statusRM || null,
        profissionalId: profId || null,
        ativo: true,
        observacoes: fer.comentarioMC || null
      }
    });
  }

  // 10. Alocacao (com rastreamento de rejeitados)
  console.log('10/13 Carga de Alocações (alocacoes-mc-reais.json)...');
  const alocs = JSON.parse(fs.readFileSync(path.join(dadosDir, 'alocacoes-mc-reais.json'), 'utf8'));
  const rejeitadas = [];
  let alocadasCount = 0;

  for (const a of alocs) {
    const postoId = postoMap.get(a.postoIdSGP);
    const profId = profMap.get(a.matricula);

    if (a.tipoAlocacao === 'FERISTA') {
      rejeitadas.push({
        id: a.id,
        chapa: a.matricula,
        nome: a.nome,
        posto: a.postoIdSGP,
        posicao: a.posicaoIdSGP,
        motivo: 'Colaborador Ferista sem posição fixa permanente (alocado e registrado na tabela ferista_posto)'
      });
      continue;
    }

    if (!profId) {
      rejeitadas.push({
        id: a.id,
        chapa: a.matricula,
        nome: a.nome,
        posto: a.postoIdSGP,
        posicao: a.posicaoIdSGP,
        motivo: 'Chapa/Profissional não cadastrado em funcionarios-reais.json (' + a.matricula + ')'
      });
      continue;
    }

    if (!postoId) {
      rejeitadas.push({
        id: a.id,
        chapa: a.matricula,
        nome: a.nome,
        posto: a.postoIdSGP,
        posicao: a.posicaoIdSGP,
        motivo: 'Posto não encontrado no cadastro (' + a.postoIdSGP + ')'
      });
      continue;
    }

    const alocId = toUuid(a.id);
    const tipo = a.tipoAlocacao === 'SUBSTITUTO' ? 'SUBSTITUTO_FIXO' : 'TITULAR';

    await prisma.alocacao.upsert({
      where: { id: alocId },
      update: {
        postoId: postoId,
        profissionalId: profId,
        tipo: tipo,
        dataInicio: new Date(a.dataInicio || '2026-08-10'),
        dataFim: a.dataFim ? new Date(a.dataFim) : null,
        motivoMovimentacao: a.motivo || null,
        documentoReferencia: a.identificadorPetrobras || null
      },
      create: {
        id: alocId,
        postoId: postoId,
        profissionalId: profId,
        tipo: tipo,
        dataInicio: new Date(a.dataInicio || '2026-08-10'),
        dataFim: a.dataFim ? new Date(a.dataFim) : null,
        motivoMovimentacao: a.motivo || null,
        documentoReferencia: a.identificadorPetrobras || null
      }
    });
    alocadasCount++;
  }

  // 11. TipoOcorrencia
  console.log('11/13 Carga de Tipos de Ocorrência...');
  const tiposOcorrBase = [
    { codigo: 'FALTA_JUSTIFICADA', descricao: 'Falta justificada com abono', rotulo: 'Ausência justificada', grupo: 'AUSENCIA_JUSTIFICADA', exigeCobertura: true },
    { codigo: 'ATESTADO_MEDICO', descricao: 'Atestado médico homologado', rotulo: 'Ausência por motivo de saúde', grupo: 'AUSENCIA_JUSTIFICADA', geraDadoSensivel: true, exigeCobertura: true },
    { codigo: 'ABONO_LEGAL', descricao: 'Abono previsto em lei ou ACT', rotulo: 'Ausência justificada legal', grupo: 'AUSENCIA_JUSTIFICADA', exigeCobertura: true },
    { codigo: 'FERIAS', descricao: 'Período regular de férias', rotulo: 'Férias regulares', grupo: 'FERIAS', exigeCobertura: true },
    { codigo: 'FALTA_INJUSTIFICADA', descricao: 'Falta injustificada', rotulo: 'Ausência não justificada', grupo: 'AUSENCIA_NAO_JUSTIFICADA', exigeCobertura: false },
    { codigo: 'FOLGA_ESCALA', descricao: 'Folga de escala', rotulo: 'Folga de escala', grupo: 'FOLGA_ESCALA', exigeCobertura: false },
    { codigo: 'TREINAMENTO', descricao: 'Treinamento institucional', rotulo: 'Treinamento', grupo: 'TREINAMENTO', exigeCobertura: true },
    { codigo: 'SUSPENSAO', descricao: 'Suspensão disciplinar', rotulo: 'Suspensão', grupo: 'SUSPENSAO', exigeCobertura: false },
    { codigo: 'DESLIGAMENTO', descricao: 'Desligamento de colaborador', rotulo: 'Desligamento', grupo: 'DESLIGAMENTO', exigeCobertura: true },
    { codigo: 'OUTROS', descricao: 'Outras ocorrências operacionais', rotulo: 'Outros', grupo: 'OUTROS', exigeCobertura: false }
  ];

  const tipoOcorrMap = new Map();
  for (const t of tiposOcorrBase) {
    const rec = await prisma.tipoOcorrencia.upsert({
      where: { codigo: t.codigo },
      update: {
        descricaoInterna: t.descricao,
        rotuloPublico: t.rotulo,
        grupo: t.grupo,
        geraDadoSensivel: Boolean(t.geraDadoSensivel),
        exigeCobertura: t.exigeCobertura,
        impactaMedicao: true
      },
      create: {
        codigo: t.codigo,
        descricaoInterna: t.descricao,
        rotuloPublico: t.rotulo,
        grupo: t.grupo,
        geraDadoSensivel: Boolean(t.geraDadoSensivel),
        exigeCobertura: t.exigeCobertura,
        impactaMedicao: true
      }
    });
    tipoOcorrMap.set(t.codigo, rec.id);
  }

  // 12. Ocorrencia
  console.log('12/13 Carga de Ocorrências (ocorrencias-reais.json)...');
  const ocorrs = JSON.parse(fs.readFileSync(path.join(dadosDir, 'ocorrencias-reais.json'), 'utf8'));
  for (const o of ocorrs) {
    const profId = profMap.get(o.matricula);
    const postoId = o.postoCodigo ? postoMap.get(o.postoCodigo) : null;
    const tipoId = tipoOcorrMap.get(o.tipoOcorrencia) || tipoOcorrMap.get('FALTA_JUSTIFICADA');
    const ocorrId = toUuid(o.id);

    await prisma.ocorrencia.upsert({
      where: { id: ocorrId },
      update: {
        profissionalId: profId,
        postoId: postoId || null,
        tipoOcorrenciaId: tipoId,
        dataInicio: new Date(o.dataInicio + 'T00:00:00.000Z'),
        dataFim: new Date(o.dataFim + 'T23:59:59.000Z'),
        diasUteisAfetados: o.diasAfetados || o.quantidadeDias || 1,
        status: 'VALIDADA',
        origem: 'IMPORTACAO',
        observacaoPublica: o.observacaoPublica || o.tipoAbono || null
      },
      create: {
        id: ocorrId,
        profissionalId: profId,
        postoId: postoId || null,
        tipoOcorrenciaId: tipoId,
        dataInicio: new Date(o.dataInicio + 'T00:00:00.000Z'),
        dataFim: new Date(o.dataFim + 'T23:59:59.000Z'),
        diasUteisAfetados: o.diasAfetados || o.quantidadeDias || 1,
        status: 'VALIDADA',
        origem: 'IMPORTACAO',
        observacaoPublica: o.observacaoPublica || o.tipoAbono || null,
        criadoEm: o.criadoEm ? new Date(o.criadoEm) : new Date()
      }
    });
  }

  // 13. MarcacaoPonto (em lotes de 2.000)
  console.log('13/13 Carga de Marcações de Ponto (marcacoes-reais.json - 38.901 registros)...');
  const marcacoes = JSON.parse(fs.readFileSync(path.join(dadosDir, 'marcacoes-reais.json'), 'utf8'));
  const batchSize = 2000;
  for (let i = 0; i < marcacoes.length; i += batchSize) {
    const chunk = marcacoes.slice(i, i + batchSize).map(m => ({
      id: m.id,
      loteId: m.loteId,
      arquivoOrigem: m.arquivoOrigem || null,
      colaboradorId: m.colaboradorId || null,
      chapa: m.chapa,
      cpfLimpo: m.cpfLimpo || null,
      dataHoraUtc: m.dataHoraUtc ? new Date(m.dataHoraUtc) : null,
      dataLocal: m.dataLocal,
      horaLocal: m.horaLocal,
      equipamentoOrigem: m.equipamentoOrigem || null,
      importadoEm: m.importadoEm ? new Date(m.importadoEm) : null
    }));

    await prisma.marcacaoPonto.createMany({
      data: chunk,
      skipDuplicates: true
    });
    process.stdout.write('   Progresso: ' + Math.min(i + batchSize, marcacoes.length) + ' / ' + marcacoes.length + '\r');
  }
  console.log('\n   Marcações de ponto carregadas com sucesso!');

  // Contagem final no banco
  console.log('\n================================================================');
  console.log('CONTAGEM NO BANCO DE DADOS (PREVIEW):');
  console.log('================================================================');

  const counts = {
    contrato: await prisma.contrato.count(),
    itemPpu: await prisma.itemPpu.count(),
    regimePosto: await prisma.regimePosto.count(),
    imovel: await prisma.imovel.count(),
    unidade: await prisma.unidade.count(),
    posto: await prisma.posto.count(),
    posicaoPosto: await prisma.posicaoPosto.count(),
    profissional: await prisma.profissional.count(),
    feristaPosto: await prisma.feristaPosto.count(),
    alocacao: await prisma.alocacao.count(),
    tipoOcorrencia: await prisma.tipoOcorrencia.count(),
    ocorrencia: await prisma.ocorrencia.count(),
    marcacaoPonto: await prisma.marcacaoPonto.count()
  };

  console.table(counts);

  console.log('\nTotal de alocações carregadas:', alocadasCount);
  console.log('Total de alocações rejeitadas:', rejeitadas.length);
  if (rejeitadas.length > 0) {
    console.log('Amostra de registros rejeitados:');
    rejeitadas.slice(0, 10).forEach(r => console.log(' - ' + r.id + ': ' + r.motivo));
  }

  // Gravar detalhes de rejeição em arquivo JSON para o relatório
  fs.writeFileSync(
    path.join(__dirname, 'rejeitados-alocacao-b1.json'),
    JSON.stringify(rejeitadas, null, 2)
  );

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Erro na execução da carga:', err);
  prisma.$disconnect();
  process.exit(1);
});
