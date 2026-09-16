import React from "react";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, ArrowUpRight, Lock, EyeOff } from "lucide-react";

export default function ConformidadePage() {
  const matrizRequisitos = [
    {
      id: "R1",
      literal:
        "Aplicar solução tecnológica que otimize e facilite a gestão e fiscalização da execução dos serviços pela contratante",
      comoAtende: "Painéis, consultas analíticas e relatórios operacionais de execução diária e mensal.",
      linkHref: "/mapa-ocupacao",
      linkTexto: "Acessar Mapa e Painéis",
      status: "CONFORME",
    },
    {
      id: "R2",
      literal:
        "Possibilitar acesso ao representante da contratante por aplicação web e/ou mobile, com dados, documentos e informações operacionais e de cumprimento das obrigações contratuais",
      comoAtende:
        "Perfil dedicado 'PETROBRAS_FISCAL' e 'PETROBRAS_GESTOR', interface web responsiva, acesso estritamente somente leitura com registro de apontamentos.",
      linkHref: "/mapa-ocupacao",
      linkTexto: "Visão da Fiscalização",
      status: "CONFORME",
    },
    {
      id: "R3",
      literal:
        "Cadastro, registro e armazenamento de dados dos empregados e das ocorrências havidas durante a execução contratual",
      comoAtende:
        "Módulos centralizados de Profissionais, Postos, Ocorrências, Coberturas e Documentos comprobatórios no banco Neon em São Paulo.",
      linkHref: "/postos",
      linkTexto: "Ver Módulos Cadastrais",
      status: "CONFORME",
    },
    {
      id: "R4",
      literal:
        "Possibilitar consultas e emissão de relatórios que otimizem a gestão e fiscalização",
      comoAtende:
        "Consultas por posto, profissional, unidade e período + relatórios exportáveis em XLSX e PDF (Espelho de Ocupação e Base de Apoio à MC).",
      linkHref: "/relatorios",
      linkTexto: "Central de Relatórios",
      status: "CONFORME",
    },
    {
      id: "R5",
      literal:
        "Apurar e evidenciar a alocação dos empregados na efetiva execução dos serviços previstos no Anexo 1-A",
      comoAtende:
        "Mapa de Ocupação Diária do Posto + Espelho de Ocupação por período com rastreabilidade dia a dia.",
      linkHref: "/mapa-ocupacao",
      linkTexto: "Mapa de Ocupação Diária",
      status: "CONFORME",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho da Página */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <h1>Matriz de Conformidade Contratual & LGPD</h1>
        </div>
        <p className="text-xs md:text-sm text-slate-600 mt-1">
          Rastreabilidade formal dos requisitos do Item 11.3 do Contrato Petrobras ICJ{" "}
          <strong>5900.0129796.25.2</strong> e salvaguardas da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
      </div>

      {/* Matriz Contratual */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs md:text-sm font-bold text-slate-800 uppercase tracking-wide">
            Matriz de Requisitos Contratuais (Item 11.3)
          </h2>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
            100% de Aderência Projetada
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-4 font-bold w-16 text-center">ID</th>
                <th className="py-2.5 px-4 font-bold w-1/3">Requisito Literal do Contrato</th>
                <th className="py-2.5 px-4 font-bold">Como a Aplicação SGP Atende</th>
                <th className="py-2.5 px-4 font-bold w-36 text-center">Telas / Módulo</th>
                <th className="py-2.5 px-4 font-bold w-24 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrizRequisitos.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-premier-900 text-center">{item.id}</td>
                  <td className="py-3 px-4 text-slate-800 leading-relaxed">{item.literal}</td>
                  <td className="py-3 px-4 text-slate-600 leading-relaxed">{item.comoAtende}</td>
                  <td className="py-3 px-4 text-center">
                    <Link
                      href={item.linkHref}
                      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-[11px] underline"
                    >
                      <span>{item.linkTexto}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção LGPD: Matriz Perfil x Dado Acessível */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-premier-800" />
            <h2 className="text-sm font-bold text-slate-900">
              Matriz LGPD de Acesso e Minimização de Dados (Lei nº 13.709/2018)
            </h2>
          </div>
          <span className="text-xs text-slate-500">Validação Estrita no Servidor (HTTP 403)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <EyeOff className="w-4 h-4 text-rose-600" />
              <span>Perfil Petrobras (Fiscal / Gestor)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li><strong className="text-slate-800">Dado Sensível de Saúde (CID/diagnóstico):</strong> Bloqueado 100% no servidor (403 Forbidden).</li>
              <li><strong className="text-slate-800">CPF:</strong> Mascarado na exibição (***.456.789-**). Identificador é a Matrícula.</li>
              <li><strong className="text-slate-800">Motivo de Ausência:</strong> Apenas rótulo público generalizado (ex: Ausência justificada).</li>
              <li><strong className="text-slate-800">Dados Pessoais Restritos:</strong> Endereço, telefone pessoal, salário e dependentes inacessíveis.</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Trilha de Auditoria e Soberania Territorial</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li><strong className="text-slate-800">Localização do Banco:</strong> Neon PostgreSQL em São Paulo (aws-sa-east-1).</li>
              <li><strong className="text-slate-800">Logs Imutáveis:</strong> Todo acesso, consulta da Petrobras e alteração são auditados.</li>
              <li><strong className="text-slate-800">Arquivos e Documentos:</strong> Armazenados diretamente em bytea no banco (máx 10 MB).</li>
              <li><strong className="text-slate-800">Zero Serviços Externos:</strong> Sem dependências em provedores fora de Vercel/Neon.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
