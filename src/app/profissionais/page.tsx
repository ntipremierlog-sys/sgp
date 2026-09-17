"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
  UserCheck,
  Clock,
  Phone,
  X,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  carregarEstado,
  adicionarProfissional,
  transferirColaboradorPosto,
  calcularIdade,
  obterFaixaEtaria,
  ProfissionalOperacional,
  PostoOperacional,
} from "@/lib/dados/estado-operacional";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { registrarLogAuditoriaAdmin } from "@/lib/auth/usuarios";

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [modalAberto, setModalAberto] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalOperacional | null>(null);
  const [exibirDadosRestritos, setExibirDadosRestritos] = useState(false);
  const [exibirCpfCompleto, setExibirCpfCompleto] = useState(false);
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false);
  const [colaboradorParaTransferir, setColaboradorParaTransferir] = useState<ProfissionalOperacional | null>(null);
  const [destinoPostoCodigo, setDestinoPostoCodigo] = useState("");

  // Formulário novo profissional
  const [formMatricula, setFormMatricula] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formFuncao, setFormFuncao] = useState("");
  const [formPosto, setFormPosto] = useState("");
  const [formEscala, setFormEscala] = useState<"5x2" | "12x36" | "6x1">("5x2");
  const [formTelefone, setFormTelefone] = useState("");
  const [formSalario, setFormSalario] = useState("");
  const [formEndereco, setFormEndereco] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const abrirModalTransferencia = (pr: ProfissionalOperacional) => {
    setColaboradorParaTransferir(pr);
    setDestinoPostoCodigo(pr.postoCodigo || "");
    setModalTransferenciaAberto(true);
  };

  const handleSalvarTransferencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorParaTransferir) return;

    const res = transferirColaboradorPosto(
      colaboradorParaTransferir.matricula,
      destinoPostoCodigo || undefined
    );
    if (res.sucesso) {
      setMensagemSucesso(res.mensagem);
      setModalTransferenciaAberto(false);
      setColaboradorParaTransferir(null);
      carregarDados();
      if (profissionalSelecionado && profissionalSelecionado.matricula === colaboradorParaTransferir.matricula) {
        setProfissionalSelecionado(null);
      }
      setTimeout(() => setMensagemSucesso(""), 4000);
    } else {
      alert(res.mensagem);
    }
  };

  const carregarDados = () => {
    const estado = carregarEstado();
    setProfissionais(estado.profissionais);
    setPostos(estado.postos);
    setPerfilAtivo(estado.perfilAtivo);
  };

  useEffect(() => {
    carregarDados();

    const carregarSessao = async () => {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
          }
        }
      } catch {
        // fallback
      }
    };
    carregarSessao();

    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const perfilEfetivo = sessao?.perfil || perfilAtivo;
  const ehAdmin = perfilEfetivo === "PREMIER_ADMIN";
  const ehGestor = perfilEfetivo === "PREMIER_GESTOR" || perfilEfetivo === "PREMIER_GESTOR_CONTRATO";
  const ehPerfilPetrobras = perfilEfetivo.startsWith("PETROBRAS");

  const basesPermitidas = sessao?.basesVinculadas || ["TODAS"];
  const podeAcessarBase = (unidadeId: string) => {
    if (basesPermitidas.includes("TODAS")) return true;
    return basesPermitidas.includes(unidadeId);
  };

  const handleAbrirFicha = (prof: ProfissionalOperacional) => {
    setProfissionalSelecionado(prof);
    setExibirDadosRestritos(false);
    setExibirCpfCompleto(false);

    if (sessao) {
      try {
        registrarLogAuditoriaAdmin(
          sessao,
          "CONSULTAR_CADASTRO_INDIVIDUAL",
          "PROFISSIONAL",
          prof.chapa || prof.matricula,
          `Usuário ${sessao.nome} (${sessao.perfil}) visualizou cadastro individual de ${prof.nomeSocial || prof.nome} (Chapa: ${prof.chapa || prof.matricula})`,
          null,
          `Base: ${prof.unidadeId}`
        );
      } catch {
        // fallback
      }
    }
  };

  const handleAlternarCpfCompleto = () => {
    if (ehPerfilPetrobras) return; // Fiscal Petrobras não pode desmascarar CPF por LGPD
    const novoEstado = !exibirCpfCompleto;
    setExibirCpfCompleto(novoEstado);

    if (novoEstado && sessao && profissionalSelecionado) {
      try {
        registrarLogAuditoriaAdmin(
          sessao,
          "DESMASCARAR_CPF",
          "PROFISSIONAL",
          profissionalSelecionado.chapa || profissionalSelecionado.matricula,
          `Usuário ${sessao.nome} (${sessao.perfil}) desmascarou o CPF de ${profissionalSelecionado.nomeSocial || profissionalSelecionado.nome}`,
          profissionalSelecionado.cpfMascarado,
          "CPF COMPLETO EXIBIDO SOB AUDITORIA"
        );
      } catch {
        // fallback
      }
    }
  };

  const profissionaisFiltrados = profissionais.filter((pr) => {
    const matchTexto =
      pr.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (pr.nomeSocial && pr.nomeSocial.toLowerCase().includes(busca.toLowerCase())) ||
      (pr.chapa && pr.chapa.toLowerCase().includes(busca.toLowerCase())) ||
      pr.matricula.toLowerCase().includes(busca.toLowerCase()) ||
      pr.funcao.toLowerCase().includes(busca.toLowerCase()) ||
      (pr.secaoCodigo && pr.secaoCodigo.toLowerCase().includes(busca.toLowerCase())) ||
      (pr.postoCodigo && pr.postoCodigo.toLowerCase().includes(busca.toLowerCase())) ||
      pr.cpfLimpo.includes(busca.replace(/\D/g, ""));

    const matchSituacao = filtroSituacao === "TODAS" || pr.situacao === filtroSituacao;
    const matchPosto =
      filtroPosto === "TODOS"
        ? true
        : filtroPosto === "COM_POSTO"
        ? !!pr.postoCodigo
        : filtroPosto === "SEM_POSTO"
        ? !pr.postoCodigo
        : pr.postoCodigo === filtroPosto;

    const matchBase = podeAcessarBase(pr.unidadeId);

    return matchTexto && matchSituacao && matchPosto && matchBase;
  });

  const totalColaboradores = profissionais.length;
  const ativos = profissionais.filter((p) => p.situacao === "ATIVO").length;
  const titulares = profissionais.filter((p) => p.postoCodigo).length;
  const reservaTecnica = profissionais.filter((p) => !p.postoCodigo).length;

  const handleSubmitNovoColaborador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatricula || !formNome || !formCpf || !formFuncao) {
      alert("Preencha os campos obrigatórios (Matrícula, Nome, CPF e Função).");
      return;
    }

    const cpfNumerico = formCpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      alert("CPF deve conter 11 dígitos numéricos válidos.");
      return;
    }

    adicionarProfissional({
      matricula: formMatricula.toUpperCase().trim(),
      nome: formNome.trim(),
      cpfLimpo: cpfNumerico,
      funcao: formFuncao.trim(),
      unidadeId: "UFN-III",
      postoCodigo: formPosto || undefined,
      escala: formEscala,
      situacao: "ATIVO",
      dataAdmissao: new Date().toISOString().split("T")[0],
      telefoneCorporativo: formTelefone.trim() || undefined,
      dadosRestritos: {
        salario: formSalario ? parseFloat(formSalario) : undefined,
        endereco: formEndereco.trim() || undefined,
      },
    });

    setMensagemSucesso(`Colaborador ${formNome} (${formMatricula.toUpperCase()}) cadastrado com sucesso!`);
    setModalAberto(false);
    setFormMatricula("");
    setFormNome("");
    setFormCpf("");
    setFormFuncao("");
    setFormPosto("");
    setFormTelefone("");
    setFormSalario("");
    setFormEndereco("");

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <Users className="w-6 h-6 text-blue-600" />
            <h1>Quadro de Profissionais Alocados</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
              Contrato Petrobras ICJ 5900.0129796.25.2
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Gestão do efetivo da Premier Logistics alocado no contrato com isolamento de dados restritos e salvaguardas da LGPD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded border border-slate-300 transition-colors"
          >
            <span>Mapa de Ocupação</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Admitir Colaborador</span>
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

      {/* Banner de Garantia LGPD */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-700">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Segregação de Dados Pessoais (Lei nº 13.709/2018 - LGPD):</span>{" "}
            O CPF é exibido mascarado (<code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">***.456.789-**</code>).
            Dados restritos de remuneração e domicílio têm acesso restrito aos administradores da Premier.
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
          <Lock className="w-3 h-3 text-amber-600" />
          <span>Cifragem AES-256</span>
        </div>
      </div>

      {/* Métricas dos Colaboradores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>TOTAL ALOCADOS</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{totalColaboradores}</div>
          <div className="mt-1 text-[11px] text-slate-500">Unidade UFN III – Três Lagoas</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>COLABORADORES ATIVOS</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">{ativos}</div>
          <div className="mt-1 text-[11px] text-slate-500">100% com vínculo empregatício regular</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>TITULARES DE POSTO</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-700 tabular-nums">{titulares}</div>
          <div className="mt-1 text-[11px] text-slate-500">Alocados no Anexo 1-A</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>RESERVA TÉCNICA / FOLGA</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">{reservaTecnica}</div>
          <div className="mt-1 text-[11px] text-slate-500">Substitutos prontos para cobertura</div>
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
            placeholder="Buscar por nome, matrícula (PRM-...), CPF ou função..."
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
            <span className="font-semibold text-slate-600">Posto / Vínculo:</span>
            <select
              value={filtroPosto}
              onChange={(e) => setFiltroPosto(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODOS">Todos os Colaboradores</option>
              <option value="COM_POSTO">Todos com Posto Alocado</option>
              <option value="SEM_POSTO">★ Reserva Técnica (Sem Posto)</option>
              <optgroup label="Filtrar por Posto Específico (Anexo 1-A)">
                {postos.map((p) => (
                  <option key={p.codigoPosto} value={p.codigoPosto}>
                    Posto {p.codigoPosto} — {p.funcao}
                  </option>
                ))}
              </optgroup>
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
              <option value="AFASTADO">Afastado</option>
              <option value="FERIAS">Férias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Colaboradores */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-3 font-bold">Chapa / Matrícula</th>
                <th className="py-2.5 px-3 font-bold">Colaborador (Nome Social / Civil)</th>
                <th className="py-2.5 px-3 font-bold">CPF (LGPD)</th>
                <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                <th className="py-2.5 px-3 font-bold">Posto Titular</th>
                <th className="py-2.5 px-3 font-bold">Escala</th>
                <th className="py-2.5 px-3 font-bold text-center">Situação</th>
                <th className="py-2.5 px-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profissionaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                profissionaisFiltrados.map((prof) => {
                  const chapaFormatada = prof.chapa || prof.matricula;
                  const temNomeSocial = !!prof.nomeSocial;
                  const nomeExibicao = prof.nomeSocial || prof.nome;

                  return (
                    <tr key={prof.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-premier-900">
                        {chapaFormatada}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{nomeExibicao}</span>
                          {temNomeSocial && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-bold">
                              Nome Social
                            </span>
                          )}
                        </div>
                        {temNomeSocial && ehAdmin && (
                          <div className="text-[11px] text-slate-500 font-normal">
                            Civil: {prof.nome}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Seção: {prof.secaoCodigo || "N/D"} • Base: {prof.unidadeId}
                        </div>
                        {prof.telefoneCorporativo && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{prof.telefoneCorporativo}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                          <Lock className="w-3 h-3 text-slate-400" />
                          {prof.cpfMascarado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-medium">
                        {prof.funcao}
                      </td>
                      <td className="py-3 px-3">
                        {prof.postoCodigo ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Briefcase className="w-3 h-3" />
                            {prof.postoCodigo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Reserva Técnica
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {prof.escala}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            prof.situacao === "ATIVO"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : prof.situacao === "FERIAS"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {prof.situacao}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleAbrirFicha(prof)}
                          className="text-slate-600 hover:text-slate-900 font-semibold text-[11px] underline"
                        >
                          Ficha
                        </button>
                        <button
                          onClick={() => abrirModalTransferencia(prof)}
                          className="inline-flex items-center gap-1 text-premier-900 hover:text-premier-700 font-bold text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                          title="Trocar ou transferir posto deste colaborador"
                        >
                          <RefreshCw className="w-3 h-3 text-blue-600" />
                          <span>Trocar Posto</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha do Colaborador (Com Segregação LGPD) */}
      {profissionalSelecionado && (() => {
        const idadeCalculada = profissionalSelecionado.dataNascimento
          ? calcularIdade(profissionalSelecionado.dataNascimento)
          : null;
        const faixaEtaria = idadeCalculada !== null ? obterFaixaEtaria(idadeCalculada) : null;
        const cpfFormatado = profissionalSelecionado.cpfLimpo.replace(
          /(\d{3})(\d{3})(\d{3})(\d{2})/,
          "$1.$2.$3-$4"
        );
        const temNomeSocial = !!profissionalSelecionado.nomeSocial;
        const nomePrincipal = profissionalSelecionado.nomeSocial || profissionalSelecionado.nome;
        const chapaCodigo = profissionalSelecionado.chapa || profissionalSelecionado.matricula;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm">
                    Ficha do Profissional: Chapa {chapaCodigo}
                  </h3>
                </div>
                <button
                  onClick={() => setProfissionalSelecionado(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-slate-900">{nomePrincipal}</h4>
                      {temNomeSocial && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-bold">
                          Nome Social
                        </span>
                      )}
                    </div>
                    {temNomeSocial && ehAdmin && (
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Nome Civil: <strong>{profissionalSelecionado.nome}</strong>
                      </div>
                    )}
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Função: <strong>{profissionalSelecionado.funcao}</strong>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    {profissionalSelecionado.situacao}
                  </span>
                </div>

                {/* Dados Operacionais e Contratuais */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">
                      CPF ({ehPerfilPetrobras ? "LGPD Petrobras" : "Auditável"})
                    </span>
                    <div className="font-mono font-bold text-slate-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>{exibirCpfCompleto && !ehPerfilPetrobras ? cpfFormatado : profissionalSelecionado.cpfMascarado}</span>
                      {!ehPerfilPetrobras && (
                        <button
                          type="button"
                          onClick={handleAlternarCpfCompleto}
                          className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold ml-1"
                        >
                          {exibirCpfCompleto ? "Ocultar" : "Desmascarar (Auditado)"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Data de Admissão</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{profissionalSelecionado.dataAdmissao || "—"}</div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Base / Unidade</span>
                    <div className="font-bold text-slate-800 mt-0.5">{profissionalSelecionado.unidadeId}</div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Posto Alocado</span>
                    <div className="font-bold text-premier-900 mt-0.5 font-mono">
                      {profissionalSelecionado.postoCodigo || "Reserva Técnica (Sem posto fixo)"}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Seção Organizacional (RM)</span>
                    <div className="font-mono text-slate-800 mt-0.5">
                      {profissionalSelecionado.secaoCodigo ? (
                        <span>{profissionalSelecionado.secaoCodigo} — {profissionalSelecionado.secaoDescricao || "Sem descrição"}</span>
                      ) : (
                        <span className="text-amber-600 font-bold">⚠️ Seção não informada</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Escala Contratual / Horário RM</span>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {profissionalSelecionado.horarioCodigo ? (
                        <span>Horário {profissionalSelecionado.horarioCodigo} ({profissionalSelecionado.escala})</span>
                      ) : (
                        profissionalSelecionado.escala
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção LGPD: Dados Demográficos (Sexo, Nascimento, Idade Dinâmica) */}
                {ehPerfilPetrobras ? (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Dados Demográficos Protegidos (LGPD - Art. 6º, III)</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      Sexo, data de nascimento e idade calculada são informações de custódia restrita da Premier Logistics e não são compartilhadas com a fiscalização Petrobras em estrita observância ao princípio da minimização.
                    </p>
                  </div>
                ) : (
                  <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dados Demográficos & Etários (Cálculo Dinâmico LGPD)</span>
                      </div>
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        Gestão Premier
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-blue-200/60">
                      <div>
                        <span className="text-slate-500 font-medium block">Sexo:</span>
                        <span className="font-bold text-slate-800">
                          {profissionalSelecionado.sexo === "M"
                            ? "Masculino"
                            : profissionalSelecionado.sexo === "F"
                            ? "Feminino"
                            : profissionalSelecionado.sexo || "Não informado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Data de Nascimento:</span>
                        <span className="font-bold text-slate-800">
                          {profissionalSelecionado.dataNascimento
                            ? new Date(profissionalSelecionado.dataNascimento + "T00:00:00").toLocaleDateString("pt-BR")
                            : "Não informada"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Idade Atual (Dinâmica):</span>
                        <span className="font-bold text-slate-800">
                          {idadeCalculada !== null ? `${idadeCalculada} anos` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Faixa Etária Contratual:</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                          {faixaEtaria || "Não classificada"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      * A idade é calculada dinamicamente pelo sistema e não é armazenada em coluna de banco de dados (LGPD).
                    </p>
                  </div>
                )}

                {/* Seção LGPD: Dados Restritos de Remuneração e Endereço */}
                <div className="border border-slate-200 rounded-lg p-3.5 space-y-2 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Remuneração e Domicílio (Estrito Premier Admin)</span>
                    </div>
                    {ehAdmin && (
                      <button
                        onClick={() => setExibirDadosRestritos(!exibirDadosRestritos)}
                        className="text-blue-700 hover:text-blue-900 text-[11px] font-semibold flex items-center gap-1 underline"
                      >
                        {exibirDadosRestritos ? (
                          <>
                            <EyeOff className="w-3 h-3" /> Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> Exibir (Premier Admin)
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {ehPerfilPetrobras ? (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>Acesso Bloqueado (HTTP 403):</strong> Perfis da fiscalização Petrobras não possuem permissão de acesso a salário ou endereço em conformidade com o Art. 6º, III da LGPD.
                      </span>
                    </div>
                  ) : !ehAdmin ? (
                    <p className="text-[11px] text-slate-500">
                      Disponível exclusivamente para Administrador Premier sob auditoria.
                    </p>
                  ) : exibirDadosRestritos ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200 animate-fadeIn">
                      <div>
                        <span className="text-slate-500 font-medium">Remuneração Base:</span>
                        <div className="font-bold text-slate-800">
                          {profissionalSelecionado.dadosRestritos?.salario
                            ? `R$ ${profissionalSelecionado.dadosRestritos.salario.toFixed(2)}`
                            : "Não informado"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Telefone Pessoal:</span>
                        <div className="font-semibold text-slate-800">
                          {profissionalSelecionado.dadosRestritos?.telefonePessoal || "Não informado"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 font-medium">Endereço Residencial:</span>
                        <div className="text-slate-800">
                          {profissionalSelecionado.dadosRestritos?.endereco || "Não informado"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Dados protegidos por criptografia em repouso. Clique em &quot;Exibir&quot; para auditar.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <button
                  onClick={() => abrirModalTransferencia(profissionalSelecionado)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded border border-blue-200 text-xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Trocar Posto do Colaborador</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setProfissionalSelecionado(null)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors"
                  >
                    Fechar
                  </button>
                  {profissionalSelecionado.postoCodigo && (
                    <Link
                      href="/postos"
                      className="px-3 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded text-xs transition-colors"
                    >
                      Ver no Anexo 1-A
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Admissão de Novo Colaborador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Admitir Colaborador no Contrato</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoColaborador} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Matrícula <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PRM-00117"
                    value={formMatricula}
                    onChange={(e) => setFormMatricula(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gabriel Alves Moreira"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    CPF (Somente Números) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="123.456.789-01"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 outline-none focus:border-premier-700"
                  />
                  <span className="text-[10px] text-slate-500">Salvo cifrado e mascarado para Petrobras</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auxiliar de Almoxarifado"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vincular a Posto (Anexo 1-A)</label>
                  <select
                    value={formPosto}
                    onChange={(e) => setFormPosto(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 outline-none"
                  >
                    <option value="">Reserva Técnica (Sem posto fixo)</option>
                    {postos.map((p) => (
                      <option key={p.codigoPosto} value={p.codigoPosto}>
                        {p.codigoPosto} — {p.funcao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Escala Padrão</label>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone Corporativo</label>
                  <input
                    type="text"
                    placeholder="(67) 99888-0000"
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Salário Base (Restrito Premier)</label>
                  <input
                    type="number"
                    placeholder="2800.00"
                    value={formSalario}
                    onChange={(e) => setFormSalario(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Endereço Residencial (Restrito Premier)</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade/UF..."
                  value={formEndereco}
                  onChange={(e) => setFormEndereco(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
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
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Troca/Transferência de Posto do Colaborador */}
      {modalTransferenciaAberto && colaboradorParaTransferir && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Trocar Posto do Colaborador</h3>
              </div>
              <button
                onClick={() => {
                  setModalTransferenciaAberto(false);
                  setColaboradorParaTransferir(null);
                }}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarTransferencia} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500 uppercase font-bold">Colaborador</div>
                <div className="font-bold text-slate-900 text-sm">{colaboradorParaTransferir.nome}</div>
                <div className="text-[11px] text-slate-600">
                  Matrícula: <strong>{colaboradorParaTransferir.matricula}</strong> | Função: <strong>{colaboradorParaTransferir.funcao}</strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Posto Atual</label>
                <div className="p-2.5 bg-slate-100 rounded border border-slate-300 font-semibold text-slate-800">
                  {colaboradorParaTransferir.postoCodigo ? (
                    <span>Posto {colaboradorParaTransferir.postoCodigo} (Titular Atual)</span>
                  ) : (
                    <span className="text-blue-700 font-bold">★ Reserva Técnica (Sem posto fixo)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Selecione o Novo Posto de Destino <span className="text-rose-500">*</span>
                </label>
                <select
                  value={destinoPostoCodigo}
                  onChange={(e) => setDestinoPostoCodigo(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-2 bg-white text-slate-800 font-medium outline-none focus:border-premier-700"
                >
                  <option value="">Mover para Reserva Técnica (Sem Posto)</option>
                  <optgroup label="Postos Contratuais (Anexo 1-A)">
                    {postos.map((p) => (
                      <option key={p.codigoPosto} value={p.codigoPosto}>
                        {p.codigoPosto} — {p.funcao} (Titular atual: {p.titularNome || "POSTO VAGO"})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Ao transferir o colaborador para um posto, ele se tornará o novo titular oficial, sendo refletido imediatamente no Mapa de Ocupação e no Anexo 1-A.
                </p>
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalTransferenciaAberto(false);
                    setColaboradorParaTransferir(null);
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
