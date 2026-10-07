import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

let cacheMarcacoes: any[] | null = null;
let cacheDiasFolga: string[] | null = null;
const cacheLotesPonto: unknown[] = [];

function obterCaminhosArquivos() {
  const marcacoesPath = path.resolve(process.cwd(), "src/lib/dados/marcacoes-reais.json");
  const diasFolgaPath = path.resolve(process.cwd(), "src/lib/dados/dias-folga-reais.json");
  return { marcacoesPath, diasFolgaPath };
}

function carregarDadosIniciaisServidor() {
  if (cacheMarcacoes && cacheMarcacoes.length > 0 && cacheDiasFolga) {
    return { marcacoes: cacheMarcacoes, diasFolga: cacheDiasFolga };
  }

  const { marcacoesPath, diasFolgaPath } = obterCaminhosArquivos();

  try {
    if (fs.existsSync(marcacoesPath)) {
      const rawM = fs.readFileSync(marcacoesPath, "utf-8");
      cacheMarcacoes = JSON.parse(rawM);
    } else {
      cacheMarcacoes = [];
    }
  } catch (err) {
    console.error("Erro ao ler marcacoes-reais.json:", err);
    cacheMarcacoes = [];
  }

  try {
    if (fs.existsSync(diasFolgaPath)) {
      const rawF = fs.readFileSync(diasFolgaPath, "utf-8");
      cacheDiasFolga = JSON.parse(rawF);
    } else {
      cacheDiasFolga = [];
    }
  } catch (err) {
    console.error("Erro ao ler dias-folga-reais.json:", err);
    cacheDiasFolga = [];
  }

  return { marcacoes: cacheMarcacoes || [], diasFolga: cacheDiasFolga || [] };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataFiltro = searchParams.get("data");

    const dados = carregarDadosIniciaisServidor();
    let listaMarcacoes = dados.marcacoes;

    if (dataFiltro) {
      listaMarcacoes = listaMarcacoes.filter((m: any) => m.dataLocal === dataFiltro);
    }

    return NextResponse.json({
      sucesso: true,
      total: listaMarcacoes.length,
      marcacoes: listaMarcacoes,
      diasFolgaRm: dados.diasFolga,
      dataReferencia: listaMarcacoes.length > 0 ? "2026-09-15 23:59" : null,
      lotes: cacheLotesPonto,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno ao obter dados de ponto.";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lote, marcacoes, diasFolgaRm } = body;

    const dadosAtuais = carregarDadosIniciaisServidor();

    // Evita duplicidades
    const setExistentes = new Set(
      dadosAtuais.marcacoes.map((m: any) => `${m.colaboradorId}_${m.dataHoraUtc}_${m.nsr || "S_NSR"}`)
    );

    const novasValidas = (marcacoes || []).filter(
      (m: any) => !setExistentes.has(`${m.colaboradorId}_${m.dataHoraUtc}_${m.nsr || "S_NSR"}`)
    );

    cacheMarcacoes = [...dadosAtuais.marcacoes, ...novasValidas];

    const setFolgas = new Set([...dadosAtuais.diasFolga, ...(diasFolgaRm || [])]);
    cacheDiasFolga = Array.from(setFolgas);

    if (lote) {
      cacheLotesPonto.push(lote);
    }

    // Persiste assincronamente em disco para preservar após restart
    try {
      const { marcacoesPath, diasFolgaPath } = obterCaminhosArquivos();
      fs.writeFileSync(marcacoesPath, JSON.stringify(cacheMarcacoes));
      fs.writeFileSync(diasFolgaPath, JSON.stringify(cacheDiasFolga));
    } catch (persistErr) {
      console.warn("Aviso: Falha ao persistir em arquivo JSON local:", persistErr);
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `${novasValidas.length} novas marcações gravadas com sucesso no servidor.`,
      totalAcumulado: cacheMarcacoes.length,
      totalFolgas: cacheDiasFolga.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar marcações no servidor.";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}
