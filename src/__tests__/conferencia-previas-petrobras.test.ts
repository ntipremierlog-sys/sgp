import { describe, it, expect, beforeEach } from 'vitest';
import {
  carregarEstado,
  adicionarCobertura,
  atualizarCobertura,
  adicionarOcorrencia,
  atualizarOcorrencia,
  rotuloPrevia,
} from '@/lib/dados/estado-operacional';
import { limparDadosOperacionaisOcupacao } from '@/lib/dados/limpeza-dados-demo';

describe('Conferência de Prévias Petrobras (Item 11.3 do Contrato)', () => {
  beforeEach(() => {
    limparDadosOperacionaisOcupacao('Teste Automatizado');
  });

  describe('Função auxiliar rotuloPrevia', () => {
    it('formata corretamente os identificadores de Prévia', () => {
      expect(rotuloPrevia('PREVIA_1')).toBe('Prévia 1');
      expect(rotuloPrevia('PREVIA_2')).toBe('Prévia 2');
      expect(rotuloPrevia('PREVIA_3')).toBe('Prévia 3');
      expect(rotuloPrevia(null)).toBe('Sem prévia');
      expect(rotuloPrevia(undefined)).toBe('Sem prévia');
    });
  });

  describe('Conferência em Coberturas', () => {
    it('deve registrar cobertura com Prévia 1, status Coberto e comentário da fiscalização', () => {
      const cob = adicionarCobertura({
        postoCodigo: 'PST-BOAVENTURA-008',
        funcaoPosto: 'Suporte à Operação',
        substitutoMatricula: '045858',
        substitutoNome: 'LUCAS SANTOS',
        dataInicio: '2026-09-02',
        dataFim: '2026-09-04',
        tipoCobertura: 'SUBSTITUICAO_INTERNA',
        status: 'CONFIRMADA',
        justificativa: 'Substituição de titular',
        previaConferencia: 'PREVIA_1',
        statusConferenciaPosto: 'COBERTO',
        comentarioConferencia: 'Petrobras conferiu a substituição válida e homologada na Prévia 1.',
      });

      expect(cob.id).toBeDefined();
      expect(cob.previaConferencia).toBe('PREVIA_1');
      expect(cob.statusConferenciaPosto).toBe('COBERTO');
      expect(cob.comentarioConferencia).toContain('Petrobras conferiu');

      // Verifica se está persistida no estado
      const estado = carregarEstado();
      const gravada = estado.coberturas.find((c) => c.id === cob.id);
      expect(gravada).toBeDefined();
      expect(gravada?.previaConferencia).toBe('PREVIA_1');
      expect(gravada?.statusConferenciaPosto).toBe('COBERTO');
    });

    it('deve permitir atualizar para Prévia 2 com novos comentários de ajuste', () => {
      const cob = adicionarCobertura({
        postoCodigo: 'PST-CABIUNAS-010',
        funcaoPosto: 'Suporte Turno',
        substitutoMatricula: '045858',
        substitutoNome: 'LUCAS SANTOS',
        dataInicio: '2026-09-05',
        dataFim: '2026-09-05',
        tipoCobertura: 'SUBSTITUICAO_INTERNA',
        status: 'CONFIRMADA',
        justificativa: 'Cobertura de treinamento',
        previaConferencia: 'PREVIA_1',
        statusConferenciaPosto: 'DESCOBERTO',
        comentarioConferencia: 'Apontamento inicial de pendência de escala.',
      });

      const res = atualizarCobertura(cob.id, {
        previaConferencia: 'PREVIA_2',
        statusConferenciaPosto: 'COBERTO',
        comentarioConferencia: 'Comprovante de ponto anexado e aceito na Prévia 2.',
      });

      expect(res.sucesso).toBe(true);
      expect(res.coberturaAtualizada?.previaConferencia).toBe('PREVIA_2');
      expect(res.coberturaAtualizada?.statusConferenciaPosto).toBe('COBERTO');
      expect(res.coberturaAtualizada?.comentarioConferencia).toContain('Prévia 2');
    });
  });

  describe('Conferência em Ocorrências', () => {
    it('deve registrar ausência com verificação de posto descoberto na Prévia 1', () => {
      const oco = adicionarOcorrencia({
        matricula: '036480',
        profissionalNome: 'WALLACE ALBUQUERQUE',
        postoCodigo: 'PST-BOAVENTURA-008',
        tipoOcorrencia: 'FALTA_INJUSTIFICADA',
        dataInicio: '2026-09-06',
        dataFim: '2026-09-06',
        diasAfetados: 1,
        status: 'VALIDADA',
        observacaoPublica: 'Falta sem substituto',
        previaConferencia: 'PREVIA_1',
        statusConferenciaPosto: 'DESCOBERTO',
        comentarioConferencia: 'Fiscalização Petrobras constatou ausência do titular sem cobertura designada.',
      });

      expect(oco.id).toBeDefined();
      expect(oco.previaConferencia).toBe('PREVIA_1');
      expect(oco.statusConferenciaPosto).toBe('DESCOBERTO');
      expect(oco.comentarioConferencia).toContain('Fiscalização Petrobras');

      const estado = carregarEstado();
      const gravada = estado.ocorrencias.find((o) => o.id === oco.id);
      expect(gravada?.previaConferencia).toBe('PREVIA_1');
      expect(gravada?.statusConferenciaPosto).toBe('DESCOBERTO');
    });

    it('deve permitir atualizar ocorrência na Prévia 3 para fechamento definitivo', () => {
      const oco = adicionarOcorrencia({
        matricula: '036480',
        profissionalNome: 'WALLACE ALBUQUERQUE',
        postoCodigo: 'PST-BOAVENTURA-008',
        tipoOcorrencia: 'ATESTADO_MEDICO',
        dataInicio: '2026-09-07',
        dataFim: '2026-09-07',
        diasAfetados: 1,
        status: 'VALIDADA',
        observacaoPublica: 'Atestado médico',
        previaConferencia: 'PREVIA_2',
        statusConferenciaPosto: 'DESCOBERTO',
        comentarioConferencia: 'Aguardando validação do substituto.',
      });

      const res = atualizarOcorrencia(oco.id, {
        previaConferencia: 'PREVIA_3',
        statusConferenciaPosto: 'COBERTO',
        comentarioConferencia: 'Fechamento final aprovado pela comissão de medição Petrobras na Prévia 3.',
      });

      expect(res.sucesso).toBe(true);
      expect(res.ocorrenciaAtualizada?.previaConferencia).toBe('PREVIA_3');
      expect(res.ocorrenciaAtualizada?.statusConferenciaPosto).toBe('COBERTO');
    });
  });

  describe('Limpeza Segura de Dados Operacionais', () => {
    it('limpa presenças, coberturas e ausências, mantendo a estrutura oficial dos postos', () => {
      adicionarCobertura({
        postoCodigo: 'PST-BOAVENTURA-008',
        funcaoPosto: 'Suporte',
        substitutoMatricula: '045858',
        substitutoNome: 'LUCAS SANTOS',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-01',
        tipoCobertura: 'SUBSTITUICAO_INTERNA',
        status: 'CONFIRMADA',
        justificativa: 'Teste Limpeza',
      });

      adicionarOcorrencia({
        matricula: '036480',
        profissionalNome: 'WALLACE ALBUQUERQUE',
        postoCodigo: 'PST-BOAVENTURA-008',
        tipoOcorrencia: 'FOLGA_ESCALA',
        dataInicio: '2026-09-01',
        dataFim: '2026-09-01',
        diasAfetados: 1,
        status: 'VALIDADA',
        observacaoPublica: 'Folga',
      });

      const antes = carregarEstado();
      expect(antes.coberturas.length).toBeGreaterThan(0);
      expect(antes.ocorrencias.length).toBeGreaterThan(0);

      const relatorio = limparDadosOperacionaisOcupacao('Administrador Premier');
      expect(relatorio.sucesso).toBe(true);
      expect(relatorio.postosAnexo1APreservados).toBeGreaterThan(0);

      const depois = carregarEstado();
      expect(depois.coberturas.length).toBe(0);
      expect(depois.ocorrencias.length).toBe(0);
      expect(depois.postos.length).toBeGreaterThan(0);
      expect(depois.vagas.length).toBeGreaterThan(0);
    });
  });
});
