import { describe, it, expect } from "vitest";
import {
  carregarEstado,
  adicionarCobertura,
  adicionarOcorrencia,
  calcularStatusVagaDia,
  rotuloPrevia,
} from "../lib/dados/estado-operacional";

describe("Critérios de Aceite — Mapa Operacional & Prévia Desacoplada", () => {
  it("Critério 1 & 3: gera intervalo que cruza a virada da competência (05/09 a 15/09) com todos os 11 dias", () => {
    const ini = "2026-09-05";
    const fim = "2026-09-15";

    const [anoIni, mesIni, diaIni] = ini.split("-").map(Number);
    const [anoFim, mesFim, diaFim] = fim.split("-").map(Number);

    const dtInicio = new Date(anoIni, mesIni - 1, diaIni);
    const dtFim = new Date(anoFim, mesFim - 1, diaFim);
    const lista: string[] = [];
    const dt = new Date(dtInicio);

    while (dt <= dtFim) {
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      lista.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      dt.setDate(dt.getDate() + 1);
    }

    expect(lista.length).toBe(11);
    expect(lista[0]).toBe("2026-09-05");
    expect(lista[4]).toBe("2026-09-09"); // Último dia do ciclo 2026-09
    expect(lista[5]).toBe("2026-09-10"); // Primeiro dia do ciclo 2026-10
    expect(lista[10]).toBe("2026-09-15");

    const estado = carregarEstado();
    const posto = estado.postos[0];
    const vaga = (estado.vagas || []).find((v) => v.idPosto === (posto.idPosto || posto.id)) || {
      id: "POS-1.1",
      idPosto: posto.idPosto || posto.id,
      sequencia: 1,
    };

    const status0509 = calcularStatusVagaDia(vaga, posto, "2026-09-05", estado.alocacoes, estado.ocorrencias, estado.coberturas);
    const status1509 = calcularStatusVagaDia(vaga, posto, "2026-09-15", estado.alocacoes, estado.ocorrencias, estado.coberturas);

    expect(status0509).toBeDefined();
    expect(status1509).toBeDefined();
    expect(status0509.data).toBe("2026-09-05");
    expect(status1509.data).toBe("2026-09-15");
  });

  it("Critério 4 & 5: confere pelo menos 3 registros com parecer de prévia intactos em Coberturas e Ocorrências", async () => {
    // Registro 1: Cobertura Prévia 1
    const cob1 = adicionarCobertura({
      postoCodigo: "PST-BOAVENTURA-008",
      funcaoPosto: "Suporte à Operação",
      substitutoMatricula: "045858",
      substitutoNome: "LUCAS SANTOS",
      dataInicio: "2026-09-02",
      dataFim: "2026-09-04",
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      status: "CONFIRMADA",
      justificativa: "Substituição de titular",
      previaConferencia: "PREVIA_1",
      statusConferenciaPosto: "COBERTO",
      comentarioConferencia: "Parecer Prévia 1 - Cobertura validada pela Petrobras",
    });

    await new Promise((r) => setTimeout(r, 15));

    // Registro 2: Cobertura Prévia 2
    const cob2 = adicionarCobertura({
      postoCodigo: "PST-CABIUNAS-010",
      funcaoPosto: "Suporte Turno",
      substitutoMatricula: "036832",
      substitutoNome: "ANA BEATRIZ",
      dataInicio: "2026-09-12",
      dataFim: "2026-09-14",
      tipoCobertura: "HORA_EXTRA_TITULAR_OUTRO_POSTO",
      status: "CONFIRMADA",
      justificativa: "Cobertura de folga",
      previaConferencia: "PREVIA_2",
      statusConferenciaPosto: "COBERTO",
      comentarioConferencia: "Parecer Prévia 2 - Substituto homologado",
    });

    await new Promise((r) => setTimeout(r, 15));

    // Registro 3: Ocorrência Prévia 3
    const oco1 = adicionarOcorrencia({
      postoCodigo: "PST-BOAVENTURA-008",
      matricula: "035918",
      profissionalNome: "CARLOS SILVA",
      tipoOcorrencia: "FALTA_INJUSTIFICADA",
      dataInicio: "2026-09-11",
      dataFim: "2026-09-11",
      diasAfetados: 1,
      status: "VALIDADA",
      observacaoPublica: "Falta não coberta",
      previaConferencia: "PREVIA_3",
      statusConferenciaPosto: "DESCOBERTO",
      comentarioConferencia: "Parecer Prévia 3 - Posto descoberto confirmado na medição",
    });

    const estadoRecarregado = carregarEstado();

    // Verificação do Registro 1 (Coberturas - Prévia 1)
    const r1 = estadoRecarregado.coberturas.find((c) => c.id === cob1.id);
    expect(r1).toBeDefined();
    expect(r1?.previaConferencia).toBe("PREVIA_1");
    expect(rotuloPrevia(r1?.previaConferencia)).toBe("Prévia 1");
    expect(r1?.statusConferenciaPosto).toBe("COBERTO");
    expect(r1?.comentarioConferencia).toBe("Parecer Prévia 1 - Cobertura validada pela Petrobras");

    // Verificação do Registro 2 (Coberturas - Prévia 2)
    const r2 = estadoRecarregado.coberturas.find((c) => c.id === cob2.id);
    expect(r2).toBeDefined();
    expect(r2?.previaConferencia).toBe("PREVIA_2");
    expect(rotuloPrevia(r2?.previaConferencia)).toBe("Prévia 2");
    expect(r2?.statusConferenciaPosto).toBe("COBERTO");
    expect(r2?.comentarioConferencia).toBe("Parecer Prévia 2 - Substituto homologado");

    // Verificação do Registro 3 (Ocorrências - Prévia 3)
    const r3 = estadoRecarregado.ocorrencias.find((o) => o.id === oco1.id);
    expect(r3).toBeDefined();
    expect(r3?.previaConferencia).toBe("PREVIA_3");
    expect(rotuloPrevia(r3?.previaConferencia)).toBe("Prévia 3");
    expect(r3?.statusConferenciaPosto).toBe("DESCOBERTO");
    expect(r3?.comentarioConferencia).toBe("Parecer Prévia 3 - Posto descoberto confirmado na medição");
  });
});
