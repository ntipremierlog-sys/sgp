"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface ItemRequisito {
  id: string;
  literal: string;
  comoAtende: string;
  linkHref: string;
  linkTexto: string;
  status: "CONFORME";
}

export default function ConformidadePage() {
  const matrizRequisitos: ItemRequisito[] = [
    {
      id: "R1",
      literal:
        "Cadastro consolidado de postos e colaboradores com identificação unívoca por Identificador do Posto e Matrícula",
      comoAtende:
        "Unicidade garantida por chave composta, validação de duplicidades no cadastro e reconciliação automática com a base RM/TOTVS.",
      linkHref: "/postos",
      linkTexto: "Postos de Trabalho",
      status: "CONFORME",
    },
    {
      id: "R2",
      literal:
        "Notificação formal de ausência/inconformidade em até 2 horas do início do turno pelo fiscal Petrobras com prazo de resposta de 2 horas",
      comoAtende:
        "Módulo de Apontamentos Petrobras com formulário padronizado, contador de prazo regressivo, anexação de comprovantes e encerramento rastreado.",
      linkHref: "/apontamentos",
      linkTexto: "Apontamentos",
      status: "CONFORME",
    },
    {
      id: "R3",
      literal:
        "Substituição imediata de posto descoberto por profissional do pool de feristas sem solução de continuidade",
      comoAtende:
        "Algoritmo de recomendação de feristas livres na base, conferência de compatibilidade de escala/função e alocação com termo de aceite.",
      linkHref: "/feristas",
      linkTexto: "Painel de Feristas",
      status: "CONFORME",
    },
    {
      id: "R4",
      literal:
        "Rastreabilidade completa de todas as alocações, substituições e edições manuais (Quem, Quando, O quê, Por quê)",
      comoAtende:
        "Trilha de Auditoria operacional registrando autor, data/hora, IP, motivo justificado e snapshot dos valores anterior e novo.",
      linkHref: "/auditoria",
      linkTexto: "Auditoria",
      status: "CONFORME",
    },
    {
      id: "R5",
      literal:
        "Comprovação documental diária da prestação de serviço por posto de trabalho para fins de faturamento",
      comoAtende:
        "Mapa de Cobertura Diária do Posto + Espelho de Ocupação mensal com apuração de presenças reais, abonos e folgas do sistema RM.",
      linkHref: "/mapa-ocupacao",
      linkTexto: "Mapa de Cobertura Diária",
      status: "CONFORME",
    },
    {
      id: "R6",
      literal:
        "Congelamento mensal da apuração operacional com snapshot imutável, carimbo SHA-256 e homologação da Fiscalização Petrobras",
      comoAtende:
        "Módulo de Fechamento Mensal com bloqueio de edições retroativas em competências congeladas, atesto formal com matrícula do Fiscal Técnico e reabertura emergencial auditada.",
      linkHref: "/fechamento",
      linkTexto: "Fechamento Mensal",
      status: "CONFORME",
    },
    {
      id: "R7",
      literal:
        "Memória de cálculo de faturamento e apuração de glosas contratuais com meta de SLA (>= 95,0%)",
      comoAtende:
        "Dedução financeira na base estrita de 30 avos por diária descoberta, comparação com a meta contratual de 95% e demonstrativo consolidado por base operacional.",
      linkHref: "/relatorios",
      linkTexto: "Memória de Cálculo (11.3)",
      status: "CONFORME",
    },
    {
      id: "R8",
      literal:
        "Conformidade trabalhista com intervalo interjornada mínimo de 11 horas consecutivas (CLT Art. 66 e Súmula 110/TST)",
      comoAtende:
        "Auditoria em tempo real no cadastro de coberturas com bloqueio e cálculo de adicional indenizatório de 50% em substituições emergenciais com termo de ciência.",
      linkHref: "/coberturas",
      linkTexto: "Módulo de Coberturas",
      status: "CONFORME",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho da Página */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Conformidade</h1>
      </div>

      {/* Matriz Contratual */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
            Matriz de Requisitos Contratuais (Item 11.3)
          </h2>
          <span className="text-xs text-slate-500">
            8 requisitos atendidos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-medium w-16 text-center">ID</th>
                <th className="py-2.5 px-4 font-medium w-1/3">Requisito Literal do Contrato</th>
                <th className="py-2.5 px-4 font-medium">Como a Aplicação SGP Atende</th>
                <th className="py-2.5 px-4 font-medium w-36 text-center">Módulo</th>
                <th className="py-2.5 px-4 font-medium w-24 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrizRequisitos.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-700 text-center">{item.id}</td>
                  <td className="py-3 px-4 text-slate-800 leading-relaxed">{item.literal}</td>
                  <td className="py-3 px-4 text-slate-600 leading-relaxed">{item.comoAtende}</td>
                  <td className="py-3 px-4 text-center">
                    <Link
                      href={item.linkHref}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline font-medium text-xs"
                    >
                      <span>{item.linkTexto}</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">
                    Conforme
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção LGPD: Matriz Perfil x Dado Acessível */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Diretrizes LGPD de Acesso e Minimização de Dados (Lei nº 13.709/2018)
          </h2>
          <span className="text-xs text-slate-500">Validação Estrita no Servidor (HTTP 403)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="text-slate-900 font-semibold">
              Perfil Petrobras (Fiscal / Gestor)
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs">
              <li><strong className="text-slate-700">Dado Sensível de Saúde (CID/diagnóstico):</strong> Bloqueado 100% no servidor (403 Forbidden).</li>
              <li><strong className="text-slate-700">CPF:</strong> Mascarado na exibição (***.456.789-**). Identificador é a Matrícula.</li>
              <li><strong className="text-slate-700">Motivo de Ausência:</strong> Apenas rótulo público generalizado (ex: Ausência justificada).</li>
              <li><strong className="text-slate-700">Dados Pessoais Restritos:</strong> Endereço, telefone pessoal, salário e dependentes inacessíveis.</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="text-slate-900 font-semibold">
              Trilha de Auditoria e Soberania Territorial
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs">
              <li><strong className="text-slate-700">Aviso de Finalidade (LGPD):</strong> Informações disponibilizadas exclusivamente para finalidades de execução, fiscalização e medição do Contrato ICJ 5900.0129796.25.2 (Lei nº 13.709/2018).</li>
              <li><strong className="text-slate-700">Localização do Banco:</strong> Neon PostgreSQL em São Paulo (aws-sa-east-1).</li>
              <li><strong className="text-slate-700">Hospedagem & Infraestrutura:</strong> Vercel (gru1 · São Paulo) com zero dependências externas.</li>
              <li><strong className="text-slate-700">Logs Imutáveis:</strong> Todo acesso, consulta da Petrobras e alteração são auditados.</li>
              <li><strong className="text-slate-700">Arquivos e Documentos:</strong> Armazenados diretamente em bytea no banco (máx 10 MB).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
