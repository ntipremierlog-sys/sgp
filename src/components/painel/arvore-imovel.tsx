"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Briefcase,
  Users,
  AlertTriangle,
  Flame,
  CheckCircle2,
  UserX,
  ShieldAlert,
  Clock,
  UserCheck,
} from "lucide-react";
import {
  ImovelArvore,
  ItemPPUArvore,
  PostoArvore,
  PosicaoArvore,
  obterArvoreEstruturalImovel,
} from "@/lib/dados/painel-calculo";

interface ArvoreImovelProps {
  imovelNomeOuId: string;
  termoBusca?: string;
  forcarExpandirTodos?: boolean;
}

export function ArvoreImovel({
  imovelNomeOuId,
  termoBusca = "",
  forcarExpandirTodos,
}: ArvoreImovelProps) {
  const dadosArvore = useMemo<ImovelArvore | null>(() => {
    return obterArvoreEstruturalImovel(imovelNomeOuId);
  }, [imovelNomeOuId]);

  // Função auxiliar de normalização
  const normalizar = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const termoNormalizado = normalizar(termoBusca.trim());

  // Destaque visual do item encontrado pela busca
  const bate = (...valores: Array<string | null | undefined>) =>
    Boolean(termoNormalizado) &&
    valores.some((v) => v && normalizar(String(v)).includes(termoNormalizado));
  const DESTAQUE = "ring-2 ring-[#1F4FD1]/60 ring-offset-1";

  // Itens PPU expandidos (set de códigos de PPU)
  const [itensExpandidos, setItensExpandidos] = useState<Set<string>>(() => {
    if (!dadosArvore) return new Set();
    // Regra: abre automaticamente quando o imóvel tem até 3 itens PPU
    if (dadosArvore.total_itens_ppu <= 3) {
      return new Set(dadosArvore.itens_ppu.map((it) => it.codigo));
    }
    return new Set();
  });

  // Atualiza abertura quando forçarExpandirTodos ou termoBusca mudar
  useEffect(() => {
    if (!dadosArvore) return;

    if (forcarExpandirTodos !== undefined) {
      if (forcarExpandirTodos) {
        setItensExpandidos(new Set(dadosArvore.itens_ppu.map((it) => it.codigo)));
      } else {
        // Se fechar todos, respeita a regra padrão (abre se <= 3 itens)
        if (dadosArvore.total_itens_ppu <= 3) {
          setItensExpandidos(new Set(dadosArvore.itens_ppu.map((it) => it.codigo)));
        } else {
          setItensExpandidos(new Set());
        }
      }
      return;
    }

    // Regra: Se a busca encontrar um termo dentro da árvore, abre automaticamente o item PPU encontrado
    if (termoNormalizado) {
      const novosExpandidos = new Set<string>();
      for (const item of dadosArvore.itens_ppu) {
        let encontrouNoItem = false;

        // Código ou descrição do item PPU
        if (
          normalizar(item.codigo).includes(termoNormalizado) ||
          normalizar(item.descricao).includes(termoNormalizado) ||
          normalizar(item.regime).includes(termoNormalizado)
        ) {
          encontrouNoItem = true;
        }

        // Postos e posições
        if (!encontrouNoItem) {
          for (const posto of item.postos) {
            if (
              normalizar(posto.posto_id).includes(termoNormalizado) ||
              normalizar(posto.regime).includes(termoNormalizado)
            ) {
              encontrouNoItem = true;
              break;
            }

            for (const pos of posto.posicoes) {
              if (
                (pos.titular_nome && normalizar(pos.titular_nome).includes(termoNormalizado)) ||
                (pos.titular_chapa && normalizar(pos.titular_chapa).includes(termoNormalizado)) ||
                normalizar(pos.codigo_estrutural).includes(termoNormalizado) ||
                (pos.situacao_rm && normalizar(pos.situacao_rm).includes(termoNormalizado))
              ) {
                encontrouNoItem = true;
                break;
              }
            }

            if (encontrouNoItem) break;

            for (const fer of posto.feristas) {
              if (
                normalizar(fer.nome).includes(termoNormalizado) ||
                normalizar(fer.chapa).includes(termoNormalizado)
              ) {
                encontrouNoItem = true;
                break;
              }
            }

            if (encontrouNoItem) break;
          }
        }

        if (encontrouNoItem) {
          novosExpandidos.add(item.codigo);
        }
      }

      if (novosExpandidos.size > 0) {
        setItensExpandidos(novosExpandidos);
      }
    }
  }, [forcarExpandirTodos, termoNormalizado, dadosArvore]);

  const toggleItemPPU = (codigo: string) => {
    setItensExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  };

  if (!dadosArvore) {
    return (
      <div className="p-4 text-xs text-slate-500 italic bg-slate-50 border-t border-[#E5E7EB]">
        Estrutura de postos do imóvel não localizada.
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-4 sm:px-6 space-y-3 text-xs text-slate-700">
      {/* ——— CABEÇALHO DO IMÓVEL EXPANDIDO ——— */}
      {/* IMÓVEL — cabeçalho: gerência · preposto · nº itens PPU · nº postos · nº posições */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs text-slate-500 min-w-0">
          <span className="truncate max-w-md" title={dadosArvore.gerencia}>
            {dadosArvore.gerencia}
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Preposto <span className="text-slate-800 font-medium">{dadosArvore.preposto}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 tabular-nums">
          <span>
            <span className="text-slate-800 font-medium">{dadosArvore.total_itens_ppu}</span>{" "}
            {dadosArvore.total_itens_ppu === 1 ? "item PPU" : "itens PPU"}
          </span>
          <span>
            <span className="text-slate-800 font-medium">{dadosArvore.total_postos}</span>{" "}
            {dadosArvore.total_postos === 1 ? "posto" : "postos"}
          </span>
          <span>
            <span className="text-slate-800 font-medium">{dadosArvore.total_posicoes}</span>{" "}
            {dadosArvore.total_posicoes === 1 ? "posição" : "posições"}
          </span>
          {dadosArvore.total_vagas > 0 && (
            <span className="text-rose-600 font-medium">
              {dadosArvore.total_vagas} {dadosArvore.total_vagas === 1 ? "vaga" : "vagas"}
            </span>
          )}
        </div>
      </div>

      {/* ——— ÁRVORE HIERÁRQUICA: ITEM PPU → POSTO → POSIÇÃO / FERISTA ——— */}
      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {dadosArvore.itens_ppu.map((item) => {
          const estaAberto = itensExpandidos.has(item.codigo);
          const temVagas = item.vagas_count > 0;

          return (
            <div key={item.codigo}>
              {/* └─ ITEM PPU [código]  descrição do catálogo · regime · "X/Y postos ocupados" · "N vagas" */}
              <button
                type="button"
                onClick={() => toggleItemPPU(item.codigo)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                aria-expanded={estaAberto}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                      estaAberto ? "rotate-90 text-slate-700" : ""
                    }`}
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">Item PPU</span>
                  <span className="font-mono font-semibold text-slate-900 shrink-0">{item.codigo}</span>
                  <div className="truncate">
                    <span className="text-slate-700">{item.descricao}</span>
                    <span className="text-slate-300 mx-1.5">·</span>
                    <span className="text-slate-500">{item.regime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500 tabular-nums">
                  <span>
                    {item.postos_ocupados}/{item.total_postos} postos ocupados
                  </span>
                  {temVagas ? (
                    <span className="text-rose-600 font-medium">
                      {item.vagas_count} {item.vagas_count === 1 ? "vaga" : "vagas"}
                    </span>
                  ) : (
                    <span className="text-slate-400">0 vagas</span>
                  )}
                </div>
              </button>

              {/* LISTA DE POSTOS DENTRO DO ITEM PPU (RECOLHÍVEL) */}
              {estaAberto && (
                <div className="pb-2">
                  {item.postos.map((posto) => (
                    <div key={posto.posto_id} className="ml-9 mr-3 mt-1 mb-2">
                      {/* └─ POSTO [Posto_ID_SGP] · regime · nº posições · selo "Periculosidade" (se SIM) · fator de medição */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-400">Posto</span>
                          <span
                            className={`font-mono font-medium text-slate-900 rounded px-0.5 ${
                              bate(posto.posto_id) ? DESTAQUE : ""
                            }`}
                          >
                            {posto.posto_id}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-600">{posto.regime}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">
                            {posto.qtd_posicoes} {posto.qtd_posicoes === 1 ? "posição" : "posições"}
                          </span>

                          {/* Selo Periculosidade se SIM */}
                          {posto.tem_periculosidade && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                              <Flame className="w-3 h-3" />
                              Periculosidade
                            </span>
                          )}

                          {/* Fator de medição 1,0 ou 0,8 (informativo) */}
                          <span
                            className="text-[11px] text-slate-400"
                            title="Fator de medição (informativo)"
                          >
                            Fator {posto.fator_medicao.toFixed(1).replace(".", ",")}
                          </span>
                        </div>

                        {/* Status de preenchimento do posto */}
                        {posto.ocupado ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                            <UserX className="w-3 h-3" />
                            {posto.vagas_count} {posto.vagas_count === 1 ? "vaga" : "vagas"}
                          </span>
                        )}
                      </div>

                      {/* POSIÇÕES DO POSTO */}
                      <div className="rounded-md border border-slate-100 divide-y divide-slate-100">
                        {posto.posicoes.map((pos) => {
                          if (pos.eh_vaga) {
                            // ├─ Posição [código] · "Vaga em aberto" (fundo vermelho claro) + motivo: "Sem titular na MC" ou "<nome> (MC) não está no RM"
                            return (
                              <div
                                key={pos.posicao_id}
                                className={`bg-rose-50/70 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                                  bate(pos.codigo_estrutural, pos.motivo_vaga) ? DESTAQUE : ""
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-slate-500 w-16 shrink-0">
                                    {pos.codigo_estrutural}
                                  </span>
                                  <span className="font-medium text-rose-700 inline-flex items-center gap-1">
                                    <UserX className="w-3.5 h-3.5 shrink-0" />
                                    Vaga em aberto
                                  </span>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-slate-600">{pos.motivo_vaga}</span>
                                </div>
                              </div>
                            );
                          }

                          // ├─ Posição [código] · Titular · Chapa · Horário/escala do RM · situação RM
                          // Situação RM: Ativo (verde), Férias (roxo), Licença/Afastado/Aviso (âmbar) — cor no indicador
                          const pontoSituacao =
                            pos.categoria_situacao === "ferias"
                              ? "bg-purple-500"
                              : pos.categoria_situacao === "afastado"
                              ? "bg-amber-500"
                              : "bg-emerald-500";
                          const textoSituacao =
                            pos.categoria_situacao === "ferias"
                              ? "text-purple-700"
                              : pos.categoria_situacao === "afastado"
                              ? "text-amber-700"
                              : "text-slate-500";

                          return (
                            <div
                              key={pos.posicao_id}
                              className={`px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-slate-50/60 transition-colors ${
                                bate(pos.titular_nome, pos.titular_chapa, pos.codigo_estrutural) ? DESTAQUE : ""
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-slate-500 w-16 shrink-0">
                                  {pos.codigo_estrutural}
                                </span>
                                <span className="font-medium text-slate-900">{pos.titular_nome}</span>
                                <span className="font-mono text-slate-400 tabular-nums">
                                  {pos.titular_chapa}
                                </span>

                                {pos.horario_rm && (
                                  <span className="text-slate-500 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {pos.horario_rm}
                                  </span>
                                )}

                                {/* Aviso de escala cíclica com escala_pendente = true */}
                                {pos.escala_pendente && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-700"
                                    title="Escala cíclica sem fase/data-base"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    fase/data-base a validar
                                  </span>
                                )}
                              </div>

                              {/* Situação RM */}
                              <span className={`inline-flex items-center gap-1.5 text-[11px] shrink-0 ${textoSituacao}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${pontoSituacao}`} />
                                {pos.situacao_rm || "Ativo"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* └─ Ferista de cobertura: nome · chapa (quando houver) */}
                      {posto.feristas && posto.feristas.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {posto.feristas.map((fer, idx) => (
                            <div
                              key={`${fer.chapa}-${idx}`}
                              className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 rounded px-0.5 ${
                                bate(fer.nome, fer.chapa) ? DESTAQUE : ""
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Ferista de cobertura:</span>
                              <span className="font-medium text-slate-800">{fer.nome}</span>
                              <span className="font-mono text-slate-400">{fer.chapa}</span>
                              {fer.situacao_rm && <span className="text-slate-400">· {fer.situacao_rm}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
