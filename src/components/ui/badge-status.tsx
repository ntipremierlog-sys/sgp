import React from "react";
import { CheckCircle2, UserCheck, AlertCircle, MinusCircle, AlertTriangle, HelpCircle } from "lucide-react";

export type StatusOcupacao =
  | "TITULAR_PRESENTE"
  | "COBERTO"
  | "DESCOBERTO"
  | "NAO_EXIGIVEL"
  | "POSTO_VAGO"
  | "PENDENTE_APURACAO";

interface BadgeStatusProps {
  status: StatusOcupacao;
  detalhe?: string;
  tamanho?: "sm" | "md" | "lg";
}

const statusConfig: Record<
  StatusOcupacao,
  {
    rotulo: string;
    classes: string;
    icone: React.ComponentType<{ className?: string }>;
    descricao: string;
  }
> = {
  TITULAR_PRESENTE: {
    rotulo: "Titular Presente",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-300",
    icone: CheckCircle2,
    descricao: "Titular escalado presente na jornada",
  },
  COBERTO: {
    rotulo: "Coberto",
    classes: "bg-blue-50 text-blue-800 border-blue-300",
    icone: UserCheck,
    descricao: "Titular ausente, posto ocupado por substituto",
  },
  DESCOBERTO: {
    rotulo: "Descoberto",
    classes: "bg-rose-50 text-rose-800 border-rose-300 font-semibold",
    icone: AlertCircle,
    descricao: "Titular ausente sem cobertura (passível de glosa)",
  },
  NAO_EXIGIVEL: {
    rotulo: "Não Exigível",
    classes: "bg-slate-100 text-slate-700 border-slate-300",
    icone: MinusCircle,
    descricao: "Folga de escala, feriado ou dia fora de escala",
  },
  POSTO_VAGO: {
    rotulo: "Posto Vago",
    classes: "bg-orange-50 text-orange-800 border-orange-300",
    icone: AlertTriangle,
    descricao: "Posto do Anexo 1-A sem titular alocado",
  },
  PENDENTE_APURACAO: {
    rotulo: "Pendente Apuração",
    classes: "bg-amber-50 text-amber-800 border-amber-300",
    icone: HelpCircle,
    descricao: "Dados insuficientes, exige ação da Premier",
  },
};

export function BadgeStatus({ status, detalhe, tamanho = "md" }: BadgeStatusProps) {
  const config = statusConfig[status] || statusConfig.PENDENTE_APURACAO;
  const Icone = config.icone;

  const tamanhoClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-2.5 py-1.5 gap-2",
  }[tamanho];

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${config.classes} ${tamanhoClasses}`}
      title={detalhe || config.descricao}
    >
      <Icone className="w-3.5 h-3.5 shrink-0" />
      <span>{config.rotulo}</span>
    </span>
  );
}
