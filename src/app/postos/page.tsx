"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  Search,
  Plus,
  UserCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  carregarEstado,
  adicionarPosto,
  trocarTitularPosto,
  obterMarcacoesPonto,
  PostoOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import { validarInterjornadaClt } from "@/lib/servicos/validacao-interjornada";

export default function PostosPage() {
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroEscala, setFiltroEscala] = useState("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [modalAberto, setModalAberto] = useState(false);
  const [postoSelecionado, setPostoSelecionado] = useState<PostoOperacional | null>(null);
  const [modalTrocaAberto, setModalTrocaAberto] = useState(false);
  const [postoParaTroca, setPostoParaTroca] = useState<PostoOperacional | null>(null);
  const [novoTitularMatricula, setNovoTitularMatricula] = useState("");
  const [cienteInterjornadaTroca, setCienciaInterjornadaTroca] = useState(false);

  // Formulário do novo posto
  const [formCodigo, setFormCodigo] = useState("");
  const [formFuncao, setFormFuncao] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formEscala, setFormEscala] = useState<"5x2" | "12x36" | "6x1">("5x2");
  const [formJornada, setFormJornada] = useState(44);
  const [formInicio, setFormInicio] = useState("07:00");
  const [formFim, setFormFim] = useState("16:48");
  const [formTitular, setFormTitular] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const abrirModalTroca = (posto: PostoOperacional) => {
    setPostoParaTroca(posto);
    setNovoTitularMatricula(posto.titularMatricula || "");
    setCienciaInterjornadaTroca(false);
    setModalTrocaAberto(true);
  };

  const handleSalvarTrocaTitular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postoParaTroca) return;

    if (alertaInterjornadaTroca && !alertaInterjornadaTroca.atende && !cienteInterjornadaTroca) {
      alert(
        `ALERTA CLT ART. 66 (Interjornada):\n\nO colaborador possui apenas ${alertaInterjornadaTroca.horasDescansoFormatado} de descanso entre turnos (abaixo de 11h).\n\nPara confirmar a troca em caráter excepcional, marque a ciência no formulário.`
      );
      return;
    }

    const res = trocarTitularPosto(postoParaTroca.codigoPosto, novoTitularMatricula || undefined);
    if (res.sucesso) {
      setMensagemSucesso(res.mensagem);
      setModalTrocaAberto(false);
      setPostoParaTroca(null);
      setCienciaInterjornadaTroca(false);
      carregarDados();
      if (postoSelecionado && postoSelecionado.codigoPosto === postoParaTroca.codigoPosto) {
        setPostoSelecionado(null);
      }
      setTimeout(() => setMensagemSucesso(""), 4000);
    } else {
      alert(res.mensagem);
    }
  };

  const carregarDados = () => {
    const estado = carregarEstado();
    setPostos(estado.postos);
    setProfissionais(estado.profissionais);
    setMarcacoesPonto(obterMarcacoesPonto());
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Alerta de interjornada reativo na troca de titular do posto
  const alertaInterjornadaTroca = useMemo(() => {
    if (!novoTitularMatricula || !postoParaTroca) return null;
    return validarInterjornadaClt({
      matricula: novoTitularMatricula,
      dataInicio: new Date().toISOString().substring(0, 10),
      postoDestinoCodigo: postoParaTroca.codigoPosto,
      postos,
      profissionais,
      marcacoesPonto,
    });
  }, [novoTitularMatricula, postoParaTroca, postos, profissionais, marcacoesPonto]);

  const postosFiltrados = postos.filter((p) => {
    const matchTexto =
      p.codigoPosto.toLowerCase().includes(busca.toLowerCase()) ||
      p.funcao.toLowerCase().includes(busca.toLowerCase()) ||
      (p.titularNome && p.titularNome.toLowerCase().includes(busca.toLowerCase())) ||
      (p.titularMatricula && p.titularMatricula.toLowerCase().includes(busca.toLowerCase()));

    const matchEscala = filtroEscala === "TODAS" || p.escala === filtroEscala;
    const matchSituacao = filtroSituacao === "TODAS" || p.situacao === filtroSituacao;

    return matchTexto && matchEscala && matchSituacao;
  });

  const totalPostos = postos.length;
  const postosOcupados = postos.filter((p) => p.titularMatricula).length;
  const postosVagos = postos.filter((p) => !p.titularMatricula).length;

  const handleSubmitNovoPosto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCodigo || !formFuncao) {
      alert("Por favor, preencha o código do posto e a função contratual.");
      return;
    }

    const titularObj = profissionais.find((pr) => pr.matricula === formTitular);

    adicionarPosto({
      codigoPosto: formCodigo.toUpperCase().trim(),
      funcao: formFuncao.trim(),
      descricao: formDescricao.trim() || undefined,
      unidadeId: "UFN-III",
      unidadeNome: "UFN III – Três Lagoas/MS",
      escala: formEscala,
      jornadaSemanalHoras: Number(formJornada),
      horarioInicio: formInicio,
      horarioFim: formFim,
      titularMatricula: titularObj?.matricula,
      titularNome: titularObj?.nome,
      situacao: "ATIVO",
      dataInicioVigencia: new Date().toISOString().split("T")[0],
    });

    setMensagemSucesso(`Posto ${formCodigo.toUpperCase()} cadastrado com sucesso!`);
    setModalAberto(false);
    setFormCodigo("");
    setFormFuncao("");
    setFormDescricao("");
    setFormTitular("");

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            <h1>Postos de Serviço (Anexo 1-A)</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
              Contrato ICJ 5900.0129796.25.2
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Cadastro oficial de postos contratuais, funções, escalas de trabalho (5x2, 12x36, 6x1), jornadas e alocação de titulares.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded border border-slate-300 transition-colors"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Novo Posto Contratual</span>
          </button>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Métricas dos Postos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>TOTAL DE POSTOS</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{totalPostos}</div>
          <div className="mt-1 text-[11px] text-slate-500">Unidade UFN III – Três Lagoas</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>POSTOS COM TITULAR</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">{postosOcupados}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {totalPostos > 0 ? `${Math.round((postosOcupados / totalPostos) * 100)}% de taxa de ocupação` : "-"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>POSTOS VAGOS (ATENÇÃO)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">{postosVagos}</div>
          <div className="mt-1 text-[11px] text-slate-500">Exige alocação ou recrutamento</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ESCALAS CONTRATUAIS</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800">5x2, 12x36 e 6x1</div>
          <div className="mt-1 text-[11px] text-slate-500">Conforme Anexo 1-A</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por código do posto, função ou titular..."
            className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Escala:</span>
            <select
              value={filtroEscala}
              onChange={(e) => setFiltroEscala(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODAS">Todas as Escalas</option>
              <option value="5x2">5x2 (Adm / Almoxarifado)</option>
              <option value="12x36">12x36 (Operacional Contínuo)</option>
              <option value="6x1">6x1 (Conferência)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Situação:</span>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODAS">Todas</option>
              <option value="ATIVO">Ativo</option>
              <option value="SUSPENSO">Suspenso</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Postos */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-3 font-bold">Código do Posto</th>
                <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                <th className="py-2.5 px-3 font-bold">Escala & Jornada</th>
                <th className="py-2.5 px-3 font-bold">Horário de Turno</th>
                <th className="py-2.5 px-3 font-bold">Titular Alocado</th>
                <th className="py-2.5 px-3 font-bold text-center">Situação</th>
                <th className="py-2.5 px-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {postosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum posto encontrado para os critérios de busca selecionados.
                  </td>
                </tr>
              ) : (
                postosFiltrados.map((posto) => (
                  <tr key={posto.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-premier-900">
                      {posto.codigoPosto}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      <div>{posto.funcao}</div>
                      {posto.descricao && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs" title={posto.descricao}>
                          {posto.descricao}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          posto.escala === "5x2"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : posto.escala === "12x36"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {posto.escala} • {posto.jornadaSemanalHoras}h/sem
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                      {posto.horarioInicio} às {posto.horarioFim}
                    </td>
                    <td className="py-3 px-3">
                      {posto.titularMatricula ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-semibold text-slate-800">{posto.titularNome}</span>
                          <span className="text-[10px] font-mono text-slate-500">({posto.titularMatricula})</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600">
                          <AlertTriangle className="w-3 h-3" />
                          POSTO VAGO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {posto.situacao}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setPostoSelecionado(posto)}
                        className="text-slate-600 hover:text-slate-900 font-semibold text-[11px] underline"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirModalTroca(posto)}
                        className="inline-flex items-center gap-1 text-premier-900 hover:text-premier-700 font-bold text-[11px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors"
                        title="Trocar ou desocupar titular deste posto"
                      >
                        <RefreshCw className="w-3 h-3 text-indigo-600" />
                        <span>Trocar Titular</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Posto */}
      {postoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Ficha do Posto: {postoSelecionado.codigoPosto}</h3>
              </div>
              <button
                onClick={() => setPostoSelecionado(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Função Contratual</span>
                  <div className="font-semibold text-slate-900 text-sm mt-0.5">{postoSelecionado.funcao}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Unidade de Execução</span>
                  <div className="font-semibold text-slate-800 mt-0.5">{postoSelecionado.unidadeNome}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Escala</span>
                  <div className="font-bold text-slate-800 mt-0.5">{postoSelecionado.escala}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Jornada Semanal</span>
                  <div className="font-bold text-slate-800 mt-0.5">{postoSelecionado.jornadaSemanalHoras} horas</div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Horário do Turno</span>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {postoSelecionado.horarioInicio} - {postoSelecionado.horarioFim}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px]">Titular Atual Alocado</span>
                {postoSelecionado.titularMatricula ? (
                  <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-200 mt-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-emerald-900">{postoSelecionado.titularNome}</div>
                        <div className="text-[11px] text-emerald-700 font-mono">
                          Matrícula: {postoSelecionado.titularMatricula}
                        </div>
                      </div>
                      <Link
                        href="/profissionais"
                        className="text-emerald-800 hover:text-emerald-950 font-semibold underline text-[11px]"
                      >
                        Ver Colaborador →
                      </Link>
                    </div>
                    <button
                      onClick={() => abrirModalTroca(postoSelecionado)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold rounded border border-indigo-200 text-xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Trocar Titular Deste Posto</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-amber-50 border border-amber-200 mt-1 text-amber-900 space-y-2">
                    <div>
                      Nenhum titular alocado. Posto classificado como <strong>POSTO VAGO</strong> no Mapa de Ocupação.
                    </div>
                    <button
                      onClick={() => abrirModalTroca(postoSelecionado)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-bold rounded text-xs transition-colors shadow"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Alocar Colaborador no Posto</span>
                    </button>
                  </div>
                )}
              </div>

              {postoSelecionado.descricao && (
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Descrição das Atividades</span>
                  <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2 rounded border border-slate-200">
                    {postoSelecionado.descricao}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setPostoSelecionado(null)}
                className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors"
              >
                Fechar
              </button>
              <Link
                href="/mapa-ocupacao"
                className="px-3 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded text-xs transition-colors"
              >
                Localizar no Mapa de Ocupação
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro de Novo Posto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Cadastrar Posto no Anexo 1-A</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoPosto} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Código do Posto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PST-LOG-016"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auxiliar de Recebimento"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Escala</label>
                  <select
                    value={formEscala}
                    onChange={(e) => setFormEscala(e.target.value as "5x2" | "12x36" | "6x1")}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 outline-none"
                  >
                    <option value="5x2">5x2</option>
                    <option value="12x36">12x36</option>
                    <option value="6x1">6x1</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jornada Semanal</label>
                  <input
                    type="number"
                    value={formJornada}
                    onChange={(e) => setFormJornada(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Horário Início/Fim</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="07:00"
                      value={formInicio}
                      onChange={(e) => setFormInicio(e.target.value)}
                      className="w-1/2 border border-slate-300 rounded px-1.5 py-1.5 text-center font-mono text-slate-800 text-xs"
                    />
                    <span>-</span>
                    <input
                      type="text"
                      placeholder="16:48"
                      value={formFim}
                      onChange={(e) => setFormFim(e.target.value)}
                      className="w-1/2 border border-slate-300 rounded px-1.5 py-1.5 text-center font-mono text-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Titular Inicial (Opcional)
                </label>
                <select
                  value={formTitular}
                  onChange={(e) => setFormTitular(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 outline-none"
                >
                  <option value="">Nenhum titular (Cadastrar como Posto Vago)</option>
                  {profissionais
                    .filter((pr) => pr.situacao === "ATIVO")
                    .map((pr) => (
                      <option key={pr.matricula} value={pr.matricula}>
                        {pr.nome} ({pr.matricula}) — {pr.funcao}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descrição / Objeto</label>
                <textarea
                  rows={2}
                  placeholder="Escopo resumido do posto e local de atuação na UFN III..."
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded shadow transition-colors"
                >
                  Salvar Posto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Troca de Titular */}
      {modalTrocaAberto && postoParaTroca && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Trocar Titular do Posto: {postoParaTroca.codigoPosto}</h3>
              </div>
              <button
                onClick={() => {
                  setModalTrocaAberto(false);
                  setPostoParaTroca(null);
                }}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarTrocaTitular} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500 uppercase font-bold">Função Contratual</div>
                <div className="font-semibold text-slate-900 text-sm">{postoParaTroca.funcao}</div>
                <div className="text-[11px] text-slate-600">
                  Escala: <strong>{postoParaTroca.escala}</strong> | Jornada: <strong>{postoParaTroca.jornadaSemanalHoras}h/sem</strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Titular Atual no Contrato</label>
                <div className="p-2.5 bg-slate-100 rounded border border-slate-300 font-semibold text-slate-800">
                  {postoParaTroca.titularNome ? (
                    <span>{postoParaTroca.titularNome} ({postoParaTroca.titularMatricula})</span>
                  ) : (
                    <span className="text-amber-700 font-bold">POSTO VAGO (Sem titular alocado)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Selecione o Novo Titular Contratual <span className="text-rose-500">*</span>
                </label>
                <select
                  value={novoTitularMatricula}
                  onChange={(e) => setNovoTitularMatricula(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-2 bg-white text-slate-800 font-medium outline-none focus:border-premier-700"
                >
                  <option value="">Deixar como Posto Vago (Sem Titular)</option>
                  <optgroup label="Colaboradores na Reserva Técnica (Recomendados)">
                    {profissionais
                      .filter((pr) => pr.situacao === "ATIVO" && !pr.postoCodigo)
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          ★ {pr.nome} ({pr.matricula}) — {pr.funcao} [Reserva Técnica]
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Colaboradores Ativos (Titulares de Outros Postos)">
                    {profissionais
                      .filter((pr) => pr.situacao === "ATIVO" && pr.postoCodigo)
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          {pr.nome} ({pr.matricula}) — Atual no posto {pr.postoCodigo}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Ao selecionar um novo colaborador, o sistema atualiza automaticamente o registro no cadastro de Profissionais e no Mapa de Ocupação.
                </p>
              </div>

              {/* Alerta de Interjornada CLT Art. 66 */}
              {alertaInterjornadaTroca && !alertaInterjornadaTroca.atende && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Alerta CLT Art. 66 (Interjornada &lt; 11h)</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    O descanso apurado entre jornadas é de <strong>{alertaInterjornadaTroca.horasDescansoFormatado}</strong> (déficit de {alertaInterjornadaTroca.deficitFormatado} em relação às 11h mínimas legais).
                  </p>
                  <div className="p-2 bg-white rounded border border-rose-200 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="checkCienciaTroca"
                      checked={cienteInterjornadaTroca}
                      onChange={(e) => setCienciaInterjornadaTroca(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 text-rose-600 rounded cursor-pointer"
                    />
                    <label htmlFor="checkCienciaTroca" className="text-[10px] text-rose-950 font-semibold cursor-pointer">
                      Declaro ciência da não observância do repouso de 11h e autorizo a troca em caráter excepcional.
                    </label>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-100 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalTrocaAberto(false);
                    setPostoParaTroca(null);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded shadow transition-colors"
                >
                  Confirmar Troca de Posto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
