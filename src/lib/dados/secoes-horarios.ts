/**
 * SGP — Sistema de Gestão de Postos
 * Gerenciador de Mapeamento de Seções RM → Bases SGP e Catálogo de Horários
 */

export interface MapeamentoSecao {
  codigoSecao: string; // Ex: "1.01.080.029"
  descricaoSecao: string; // Ex: "UFN-III (Três Lagoas - MS)"
  unidadeId: string; // "UFN-III", "MACAE", "SANTOS", "PAULINIA" ou "NAO_MAPEADA"
  unidadeNome: string;
  sugeridoAutomaticamente?: boolean;
  confirmado: boolean;
  atualizadoEm: string;
  atualizadoPor: string;
}

export interface HorarioRmItem {
  codigo: string;
  descricao: string;
  jornada?: string;
  primeiraOcorrenciaEm: string;
}

export interface BaseOperacionalItem {
  id: string;
  nome: string;
  tags: string[];
  fusoHorario: "America/Sao_Paulo" | "America/Campo_Grande" | "America/Manaus";
  diferencaUtcHoras: number;
}

export const BASES_SGP_SISTEMA: BaseOperacionalItem[] = [
  { id: "UFN-III", nome: "UFN III – Três Lagoas/MS", tags: ["ufn", "tres lagoas", "três lagoas", "ufn-iii", "ufn3"], fusoHorario: "America/Campo_Grande", diferencaUtcHoras: -4 },
  { id: "MACAE", nome: "Macaé / Parque de Tubos", tags: ["macae", "macaé", "parque de tubos", "imbetiba", "cabiunas", "cabiúnas", "imboassica", "tubos"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "SANTOS", nome: "Terminal Santos/SP", tags: ["santos", "terminal santos", "porto", "edisa", "rpbc", "cubatao", "cubatão", "utg-ca", "caraguatatuba"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "PAULINIA", nome: "Refinaria Paulínia (Replan)", tags: ["paulinia", "paulínia", "replan", "campinas"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "RIO_DE_JANEIRO", nome: "Rio de Janeiro / Sede (EDIHB/CENPES)", tags: ["edihb", "rio de janeiro", "cenpes", "edisen", "fronape"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REDUC", nome: "Refinaria Duque de Caxias (REDUC)", tags: ["reduc", "duque de caxias"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "BOAVENTURA", nome: "Complexo Boaventura (Itaboraí/RJ)", tags: ["boaventura", "itaborai", "itaboraí"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "RNEST", nome: "Refinaria Abreu e Lima (RNEST/PE)", tags: ["rnest", "ipojuca"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "EDIBRA", nome: "Edifício Brasília (EDIBRA/DF)", tags: ["edibra", "brasilia", "brasília"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REVAP", nome: "Refinaria Henrique Lage (REVAP/SP)", tags: ["revap", "sao jose dos campos", "são josé dos campos"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REGAP", nome: "Refinaria Gabriel Passos (REGAP/MG)", tags: ["regap", "betim"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "RECAP", nome: "Refinaria de Capuava (RECAP/SP)", tags: ["recap", "maua", "mauá"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "PITUBA", nome: "Salvador / Pituba / Taquipe (BA)", tags: ["pituba", "salvador", "taquipe", "sao sebastiao do passe"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REPAR", nome: "Refinaria Pres. Getúlio Vargas (REPAR/PR)", tags: ["repar", "araucaria", "araucária"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REFAP", nome: "Refinaria Alberto Pasqualini (REFAP/RS)", tags: ["refap", "canoas"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "FAROL_SAO_TOME", nome: "Farol de São Tomé (Campos/RJ)", tags: ["farol", "sao tome", "campos", "campos dos goytacazes"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "NORDESTE", nome: "Bases Regionais Nordeste (CE/RN/SE)", tags: ["lubnor", "fortaleza", "edirn", "natal", "ediser", "aracaju"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "EDIVIT", nome: "Edifício Vitória (EDIVIT/ES)", tags: ["edivit", "vitoria", "vitória"], fusoHorario: "America/Sao_Paulo", diferencaUtcHoras: -3 },
  { id: "REMAN", nome: "Refinaria Isaac Sabbá (REMAN/AM)", tags: ["reman", "manaus"], fusoHorario: "America/Manaus", diferencaUtcHoras: -4 },
];

/**
 * Retorna o fuso horário da base operacional (padrão America/Sao_Paulo).
 */
export function obterFusoHorarioBase(unidadeId?: string): "America/Sao_Paulo" | "America/Campo_Grande" | "America/Manaus" {
  if (!unidadeId) return "America/Sao_Paulo";
  const base = BASES_SGP_SISTEMA.find((b) => b.id === unidadeId);
  return base?.fusoHorario || "America/Sao_Paulo";
}

/**
 * Retorna o offset em horas em relação a UTC (-3 para Brasília, -4 para MS e AM).
 */
export function obterDiferencaUtcHoras(fuso: string): number {
  if (fuso === "America/Campo_Grande" || fuso === "America/Manaus") {
    return -4;
  }
  return -3;
}

/**
 * Converte data e hora locais da base para ISO UTC.
 * Exemplo: 2026-08-31 07:00 em America/Campo_Grande (-4) -> 2026-08-31T11:00:00.000Z
 */
export function converterLocalParaUtc(dataLocal: string, horaLocal: string, fuso: string = "America/Sao_Paulo"): string {
  const [ano, mes, dia] = dataLocal.split("-").map(Number);
  const partesHora = horaLocal.split(":").map(Number);
  const hora = partesHora[0] || 0;
  const minuto = partesHora[1] || 0;
  const segundo = partesHora[2] || 0;

  const diffHoras = obterDiferencaUtcHoras(fuso);
  // Para converter de local para UTC, subtraímos o offset negativo (ou seja, somamos |offset|):
  // Ex: local = 07:00, diff = -4 => UTC = 07 - (-4) = 11:00
  const dataMs = Date.UTC(ano, mes - 1, dia, hora - diffHoras, minuto, segundo);
  return new Date(dataMs).toISOString();
}

/**
 * Converte data e hora UTC ISO para data e hora locais da base.
 */
export function converterUtcParaLocal(
  dataHoraUtcIso: string,
  fuso: string = "America/Sao_Paulo"
): { dataLocal: string; horaLocal: string } {
  const d = new Date(dataHoraUtcIso);
  const diffHoras = obterDiferencaUtcHoras(fuso);
  // UTC para local: somamos o offset negativo
  const localMs = d.getTime() + diffHoras * 3600 * 1000;
  const localDate = new Date(localMs);

  const ano = localDate.getUTCFullYear();
  const mes = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(localDate.getUTCDate()).padStart(2, "0");
  const hora = String(localDate.getUTCHours()).padStart(2, "0");
  const minuto = String(localDate.getUTCMinutes()).padStart(2, "0");

  return {
    dataLocal: `${ano}-${mes}-${dia}`,
    horaLocal: `${hora}:${minuto}`,
  };
}

const CHAVE_STORAGE_SECOES = "sgp_mapeamento_secoes_v1";
const CHAVE_STORAGE_HORARIOS = "sgp_catalogo_horarios_v1";


let secoesMemoria: MapeamentoSecao[] = [
  { codigoSecao: "1.01.080.023", descricaoSecao: "UFN-III (Três Lagoas - MS)", unidadeId: "UFN-III", unidadeNome: "UFN III – Três Lagoas/MS", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.014", descricaoSecao: "IMBETIBA (Macaé - RJ)", unidadeId: "MACAE", unidadeNome: "Macaé / Parque de Tubos", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.003", descricaoSecao: "CABIUNAS (Macaé - RJ)", unidadeId: "MACAE", unidadeNome: "Macaé / Parque de Tubos", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.021", descricaoSecao: "IMBOASSICA (Macaé - RJ)", unidadeId: "MACAE", unidadeNome: "Macaé / Parque de Tubos", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.025", descricaoSecao: "REPLAN (Paulínia - SP)", unidadeId: "PAULINIA", unidadeNome: "Refinaria Paulínia (Replan)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.009", descricaoSecao: "EDISA (Santos - SP)", unidadeId: "SANTOS", unidadeNome: "Terminal Santos/SP", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.019", descricaoSecao: "RPBC (Cubatão - SP)", unidadeId: "SANTOS", unidadeNome: "Terminal Santos/SP", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.020", descricaoSecao: "UTG-CA (Caraguatatuba - SP)", unidadeId: "SANTOS", unidadeNome: "Terminal Santos/SP", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.006", descricaoSecao: "EDIHB (Rio de Janeiro - RJ)", unidadeId: "RIO_DE_JANEIRO", unidadeNome: "Rio de Janeiro / Sede (EDIHB/CENPES)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.004", descricaoSecao: "CENPES (Rio de Janeiro - RJ)", unidadeId: "RIO_DE_JANEIRO", unidadeNome: "Rio de Janeiro / Sede (EDIHB/CENPES)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.010", descricaoSecao: "EDISEN (Rio de Janeiro - RJ)", unidadeId: "RIO_DE_JANEIRO", unidadeNome: "Rio de Janeiro / Sede (EDIHB/CENPES)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.013", descricaoSecao: "FRONAPE (Rio de Janeiro - RJ)", unidadeId: "RIO_DE_JANEIRO", unidadeNome: "Rio de Janeiro / Sede (EDIHB/CENPES)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.017", descricaoSecao: "REDUC (Duque de Caxias - RJ)", unidadeId: "REDUC", unidadeNome: "Refinaria Duque de Caxias (REDUC)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.002", descricaoSecao: "BOAVENTURA (Itaboraí - RJ)", unidadeId: "BOAVENTURA", unidadeNome: "Complexo Boaventura (Itaboraí/RJ)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.018", descricaoSecao: "RNEST (Ipojuca - PE)", unidadeId: "RNEST", unidadeNome: "Refinaria Abreu e Lima (RNEST/PE)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.005", descricaoSecao: "EDIBRA (Brasília - DF)", unidadeId: "EDIBRA", unidadeNome: "Edifício Brasília (EDIBRA/DF)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.026", descricaoSecao: "REVAP (São José dos Campos - SP)", unidadeId: "REVAP", unidadeNome: "Refinaria Henrique Lage (REVAP/SP)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.027", descricaoSecao: "REGAP (Betim - MG)", unidadeId: "REGAP", unidadeNome: "Refinaria Gabriel Passos (REGAP/MG)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.024", descricaoSecao: "RECAP (Mauá - SP)", unidadeId: "RECAP", unidadeNome: "Refinaria de Capuava (RECAP/SP)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.016", descricaoSecao: "PITUBA (Salvador - BA)", unidadeId: "PITUBA", unidadeNome: "Salvador / Pituba / Taquipe (BA)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.001", descricaoSecao: "BASE TAQUIPE (São Sebastião do Passé - BA)", unidadeId: "PITUBA", unidadeNome: "Salvador / Pituba / Taquipe (BA)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.028", descricaoSecao: "REPAR (Araucária - PR)", unidadeId: "REPAR", unidadeNome: "Refinaria Pres. Getúlio Vargas (REPAR/PR)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.029", descricaoSecao: "REFAP (Canoas - RS)", unidadeId: "REFAP", unidadeNome: "Refinaria Alberto Pasqualini (REFAP/RS)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.030", descricaoSecao: "FAROL DE SAO TOME (Campos dos Goytacazes - RJ)", unidadeId: "FAROL_SAO_TOME", unidadeNome: "Farol de São Tomé (Campos/RJ)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.011", descricaoSecao: "EDISER (Aracajú - SE)", unidadeId: "NORDESTE", unidadeNome: "Bases Regionais Nordeste (CE/RN/SE)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.015", descricaoSecao: "LUBNOR (Fortaleza - CE)", unidadeId: "NORDESTE", unidadeNome: "Bases Regionais Nordeste (CE/RN/SE)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.008", descricaoSecao: "EDIRN (Natal - RN)", unidadeId: "NORDESTE", unidadeNome: "Bases Regionais Nordeste (CE/RN/SE)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.012", descricaoSecao: "EDIVIT (Vitória - ES)", unidadeId: "EDIVIT", unidadeNome: "Edifício Vitória (EDIVIT/ES)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
  { codigoSecao: "1.01.080.022", descricaoSecao: "REMAN (Manaus - AM)", unidadeId: "REMAN", unidadeNome: "Refinaria Isaac Sabbá (REMAN/AM)", sugeridoAutomaticamente: false, confirmado: true, atualizadoEm: "2026-09-17 10:00", atualizadoPor: "Administrador Premier" },
];

let horariosMemoria: HorarioRmItem[] = [
  {
    codigo: "001",
    descricao: "07:00 AS 16:48 - SEG/SEX",
    jornada: "44,0",
    primeiraOcorrenciaEm: "2026-09-17 10:00",
  },
  {
    codigo: "002",
    descricao: "06:00 AS 18:00 - ESCALA 12X36",
    jornada: "36,0",
    primeiraOcorrenciaEm: "2026-09-17 10:00",
  },
];

export function carregarMapeamentosSecao(): MapeamentoSecao[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_SECOES);
      if (salvo) {
        secoesMemoria = JSON.parse(salvo);
      }
    } catch {
      // fallback memória
    }
  }
  return secoesMemoria;
}

export function salvarMapeamentosSecao(lista: MapeamentoSecao[]) {
  secoesMemoria = lista;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_SECOES, JSON.stringify(lista));
      window.dispatchEvent(new CustomEvent("sgp-secoes-atualizadas", { detail: lista }));
    } catch {
      // storage ignorado
    }
  }
}

/**
 * Sugere base do SGP a partir da semelhança do texto da descrição da seção RM
 */
export function sugerirBasePorDescricao(descricao: string): { unidadeId: string; unidadeNome: string } | null {
  if (!descricao) return null;
  const normalizada = descricao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const base of BASES_SGP_SISTEMA) {
    for (const tag of base.tags) {
      const tagNorm = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (tagNorm.length <= 3) {
        const regex = new RegExp(`\\b${tagNorm}\\b`, "i");
        if (regex.test(normalizada)) {
          return { unidadeId: base.id, unidadeNome: base.nome };
        }
      } else if (normalizada.includes(tagNorm)) {
        return { unidadeId: base.id, unidadeNome: base.nome };
      }
    }
  }
  return null;
}

/**
 * Retorna a base vinculada à seção, ou "Não mapeada" caso não esteja vinculada
 */
export function obterBasePorCodigoSecao(codigoSecao: string): {
  unidadeId: string;
  unidadeNome: string;
  mapeada: boolean;
} {
  const lista = carregarMapeamentosSecao();
  const codigoLimpo = (codigoSecao || "").trim();
  const encontrado = lista.find((s) => s.codigoSecao === codigoLimpo);

  if (encontrado && encontrado.unidadeId && encontrado.unidadeId !== "NAO_MAPEADA") {
    return {
      unidadeId: encontrado.unidadeId,
      unidadeNome: encontrado.unidadeNome,
      mapeada: true,
    };
  }

  return {
    unidadeId: "NAO_MAPEADA",
    unidadeNome: "Não mapeada",
    mapeada: false,
  };
}

/**
 * Registra ou atualiza uma seção vinda de arquivo de importação.
 * Se for inédita, sugere automaticamente a base por similaridade, marcando como não confirmado.
 */
export function registrarSecaoImportada(
  codigoSecao: string,
  descricaoSecao: string,
  usuario: string = "Administrador Premier"
): MapeamentoSecao {
  const lista = carregarMapeamentosSecao();
  const codigoLimpo = (codigoSecao || "").trim();
  const descLimpa = (descricaoSecao || "").trim();

  const index = lista.findIndex((s) => s.codigoSecao === codigoLimpo);
  if (index >= 0) {
    return lista[index];
  }

  // Seção nova: sugere automaticamente
  const sugestao = sugerirBasePorDescricao(descLimpa);
  const novaSecao: MapeamentoSecao = {
    codigoSecao: codigoLimpo,
    descricaoSecao: descLimpa,
    unidadeId: sugestao ? sugestao.unidadeId : "NAO_MAPEADA",
    unidadeNome: sugestao ? sugestao.unidadeNome : "Não mapeada",
    sugeridoAutomaticamente: !!sugestao,
    confirmado: false, // Exige confirmação do administrador
    atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
    atualizadoPor: usuario,
  };

  const novaLista = [...lista, novaSecao];
  salvarMapeamentosSecao(novaLista);
  return novaSecao;
}

/**
 * Atualiza o vínculo da seção com uma base SGP
 */
export function vincularSecaoBase(
  codigoSecao: string,
  unidadeId: string,
  confirmado: boolean = true,
  usuario: string = "Administrador Premier"
) {
  const lista = carregarMapeamentosSecao();
  const base = BASES_SGP_SISTEMA.find((b) => b.id === unidadeId);

  const novaLista = lista.map((item) => {
    if (item.codigoSecao === codigoSecao) {
      return {
        ...item,
        unidadeId: base ? base.id : "NAO_MAPEADA",
        unidadeNome: base ? base.nome : "Não mapeada",
        confirmado,
        sugeridoAutomaticamente: false,
        atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
        atualizadoPor: usuario,
      };
    }
    return item;
  });

  salvarMapeamentosSecao(novaLista);
}

// -----------------------------------------------------------------------------
// CATÁLOGO DE HORÁRIOS
// -----------------------------------------------------------------------------

export function carregarCatalogoHorarios(): HorarioRmItem[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_HORARIOS);
      if (salvo) {
        horariosMemoria = JSON.parse(salvo);
      }
    } catch {
      // fallback memória
    }
  }
  return horariosMemoria;
}

export function salvarCatalogoHorarios(lista: HorarioRmItem[]) {
  horariosMemoria = lista;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_HORARIOS, JSON.stringify(lista));
      window.dispatchEvent(new CustomEvent("sgp-horarios-atualizados", { detail: lista }));
    } catch {
      // ignorado
    }
  }
}

export function registrarHorarioRm(
  codigo: string,
  descricao: string,
  jornada?: string
): HorarioRmItem {
  const lista = carregarCatalogoHorarios();
  const codLimpo = (codigo || "").trim();
  const descLimpa = (descricao || "").trim();

  const existente = lista.find((h) => h.codigo === codLimpo);
  if (existente) {
    return existente;
  }

  const novo: HorarioRmItem = {
    codigo: codLimpo,
    descricao: descLimpa,
    jornada: jornada ? jornada.trim() : undefined,
    primeiraOcorrenciaEm: new Date().toISOString().replace("T", " ").substring(0, 16),
  };

  const novaLista = [...lista, novo];
  salvarCatalogoHorarios(novaLista);
  return novo;
}
