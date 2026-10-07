import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  processarEPreVisualizarArquivoRm,
} from "@/lib/importadores/processador-rm-totvs";

export async function GET(request: NextRequest) {
  try {
    const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
    const existe = fs.existsSync(caminhoXls);
    let tamanho = 0;
    if (existe) {
      const stats = fs.statSync(caminhoXls);
      tamanho = stats.size;
    }

    return NextResponse.json({
      existeArquivoPadrao: existe,
      nomeArquivoPadrao: "FUNCIONÁRIOS PETROBRAS.XLS",
      tamanhoBytes: tamanho,
    });
  } catch (error: any) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const usarArquivoServidor = formData.get("usarArquivoServidor") === "true";
    const dataReferencia = (formData.get("dataReferencia") as string) || "2026-09-17";

    let buffer: Buffer;
    let nomeArquivo: string;

    if (usarArquivoServidor) {
      const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
      if (!fs.existsSync(caminhoXls)) {
        return NextResponse.json(
          { erro: "Arquivo FUNCIONÁRIOS PETROBRAS.XLS não encontrado no servidor." },
          { status: 404 }
        );
      }
      buffer = fs.readFileSync(caminhoXls);
      nomeArquivo = "FUNCIONÁRIOS PETROBRAS.XLS";
    } else {
      const arquivo = formData.get("arquivo") as File | null;
      if (!arquivo) {
        return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
      }
      const arrayBuffer = await arquivo.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      nomeArquivo = arquivo.name;
    }

    const previa = await processarEPreVisualizarArquivoRm(buffer, nomeArquivo, dataReferencia);
    return NextResponse.json(previa);
  } catch (error: any) {
    console.error("Erro ao processar arquivo RM:", error);
    return NextResponse.json(
      { erro: error.message || "Erro desconhecido ao processar arquivo RM." },
      { status: 400 }
    );
  }
}
