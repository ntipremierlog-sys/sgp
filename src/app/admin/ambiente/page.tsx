"use client";

import React from "react";
import Link from "next/link";
import {
  Server,
  Database,
  ShieldCheck,
  Lock,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export default function AmbienteAdminPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <Link href="/admin" className="hover:text-slate-800 transition-colors">
              Administração
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Ambiente e infraestrutura</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ambiente de hospedagem e governança LGPD
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Topologia de nuvem, banco de dados isolado e diretrizes de conformidade do contrato ICJ 5900.0129796.25.2.
          </p>
        </div>

        <Link
          href="/admin"
          className="h-8 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#D0D5DD] rounded-lg shadow-2xs transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para administração</span>
        </Link>
      </div>

      {/* Cards de Infraestrutura Principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Banco Neon PostgreSQL */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shadow-2xs">
              <Database className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-emerald-700 border border-slate-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Operacional
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Neon PostgreSQL</h3>
            <p className="text-xs text-slate-500 mt-0.5">Banco de dados relacional serverless</p>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Região de hospedagem:</span>
              <span className="font-mono font-medium text-slate-800">aws-sa-east-1 (São Paulo)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Engine e versão:</span>
              <span className="font-mono text-slate-800">PostgreSQL 16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ORM de acesso:</span>
              <span className="font-mono text-slate-800">Prisma Client v6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Connection pooling:</span>
              <span className="text-emerald-700 font-medium">Ativo (pgBouncer integrado)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Hospedagem Vercel Edge */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-[#1F4FD1] flex items-center justify-center shadow-2xs">
              <Server className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F4FD1]" />
              Vercel Pro
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Vercel Pro Platform</h3>
            <p className="text-xs text-slate-500 mt-0.5">Execução serverless e CDN distribuída</p>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Região de execução primária:</span>
              <span className="font-mono font-medium text-slate-800">gru1 (São Paulo, Brasil)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Framework:</span>
              <span className="font-mono text-slate-800">Next.js 14 (App Router)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Certificado SSL/TLS:</span>
              <span className="text-emerald-700 font-medium">TLS 1.3 criptografado</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Deploy automatizado:</span>
              <span className="text-slate-800 font-medium">CI/CD via Git</span>
            </div>
          </div>
        </div>

        {/* Card 3: Governança LGPD */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-slate-800 border border-slate-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              Conforme
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Governança LGPD / RBAC</h3>
            <p className="text-xs text-slate-500 mt-0.5">Segregação de dados e sigilo médico</p>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Residência de dados:</span>
              <span className="font-medium text-slate-800">100% Brasil (LGPD Art. 33)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Segregação médica:</span>
              <span className="text-emerald-700 font-medium">CID-10 isolado em tabela restrita</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Perfil Petrobras:</span>
              <span className="text-slate-800 font-medium">Visualização sem dados sensíveis</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Trilha de auditoria:</span>
              <span className="text-emerald-700 font-medium">Logs imutáveis em log_auditoria</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento de Conformidade e Políticas */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <h2 className="text-base font-bold text-slate-900">
          Diretrizes de Segurança e Isolamento por Perfil (RBAC)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Perfil Fiscalização Petrobras (PETROBRAS_FISCAL)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Tem acesso aos dados de postos, presença, coberturas e apontamentos necessários para a fiscalização
              do Item 11.3 do contrato. Não tem acesso a dados financeiros internos (glosa estimada) nem diagnósticos
              médicos (CID-10, CRM ou prontuário).
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Perfil Gestão Contratual Premier (PREMIER_GESTOR)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Acesso irrestrito a medição, memória de cálculo, parametrização contratual, valores do Anexo 1-A e
              simulação preventiva de glosa. Dados de atestado médico são tratados estritamente pelo SESMT e RH.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs">
          <Lock className="w-4 h-4 text-slate-700 shrink-0" />
          <span>
            Todas as transações, consultas analíticas e modificações de titularidade são registradas de forma
            auditável com IP, perfil e identificador do usuário responsável.
          </span>
        </div>
      </div>
    </div>
  );
}
