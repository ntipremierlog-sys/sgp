"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  LogOut,
  Camera,
  Upload,
  X,
  Check,
  Trash2,
  Settings,
  ChevronRight,
  Search,
  LayoutDashboard,
  CalendarCheck,
  UserCheck2,
  Users,
  Briefcase,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  History,
  AlertTriangle,
} from "lucide-react";
import { NOMES_PERFIS } from "@/lib/auth/permissoes";
import { PerfilUsuario, UsuarioSessao } from "@/lib/auth/tipos";

interface CabecalhoProps {
  perfilAtivo?: string;
  nomeUsuario?: string;
}

// Mapeamento contextual das páginas para breadcrumb dinâmico
const MAPA_PAGINAS: Record<
  string,
  { titulo: string; subtitulo: string; icone: React.ComponentType<{ className?: string }> }
> = {
  "/painel": { titulo: "Painel Executivo", subtitulo: "Ocupação e gestão contratual", icone: LayoutDashboard },
  "/mapa-ocupacao": { titulo: "Mapa de Ocupação", subtitulo: "Visualização mensal de postos", icone: CalendarCheck },
  "/descobertos": { titulo: "Postos Descobertos", subtitulo: "Ausências e coberturas pendentes", icone: AlertTriangle },
  "/presenca-diaria": { titulo: "Presença Diária", subtitulo: "Acompanhamento diário", icone: CalendarCheck },
  "/coberturas": { titulo: "Coberturas e Ocorrências", subtitulo: "Faltas, atestados e substitutos", icone: UserCheck2 },
  "/ocorrencias": { titulo: "Registro de Ocorrências", subtitulo: "Histórico operacional", icone: UserCheck2 },
  "/profissionais": { titulo: "Profissionais", subtitulo: "Alocação e quadro de colaboradores", icone: Users },
  "/postos": { titulo: "Estrutura de Postos", subtitulo: "Anexo 1-A e horários contratuais", icone: Briefcase },
  "/feristas": { titulo: "Gestão de Feristas", subtitulo: "Quadro e cobertura de férias", icone: Users },
  "/relatorios/coberturas": { titulo: "Relatório de Coberturas", subtitulo: "Consolidação por PPU e imóvel", icone: FileSpreadsheet },
  "/relatorios": { titulo: "Relatórios Oficiais", subtitulo: "Ocupação por posto e medição", icone: FileSpreadsheet },
  "/apontamentos": { titulo: "Apontamentos Petrobras", subtitulo: "Gestão de apontamentos fiscais", icone: MessageSquare },
  "/conformidade": { titulo: "Conformidade Contratual", subtitulo: "Fechamento e auditoria", icone: ShieldCheck },
  "/importacoes": { titulo: "Importações", subtitulo: "Cargas de planilhas RM e medição", icone: UploadCloud },
  "/conciliacao-sifac": { titulo: "Conciliação SIFAC", subtitulo: "Cruzamento de alocações", icone: FileCheck },
  "/auditoria": { titulo: "Trilha de Auditoria", subtitulo: "Rastreabilidade e logs", icone: History },
  "/admin": { titulo: "Administração", subtitulo: "Usuários, permissões e parâmetros", icone: Settings },
};

export function Cabecalho({
  perfilAtivo: propPerfil,
  nomeUsuario: propNome,
}: CabecalhoProps) {
  const pathname = usePathname() || "/painel";
  const router = useRouter();

  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [modalFotoAberta, setModalFotoAberta] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>("");
  const [mensagemErro, setMensagemErro] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buscaRef = useRef<HTMLDivElement>(null);

  const carregarSessao = async () => {
    try {
      const res = await fetch("/api/auth");
      if (res.ok) {
        const data = await res.json();
        if (data.autenticado && data.usuario) {
          setSessao(data.usuario);
          return;
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    carregarSessao();

    const handleAtualizacao = () => {
      carregarSessao();
    };

    window.addEventListener("sgp-sessao-alterada", handleAtualizacao);
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => {
      window.removeEventListener("sgp-sessao-alterada", handleAtualizacao);
      window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
    };
  }, []);

  // Atalho de teclado Ctrl + K para focar na busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("input-busca-sgp");
        input?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fecha popup de busca ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaAberta(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const perfil = (sessao?.perfil || propPerfil || "PREMIER_ADMIN") as PerfilUsuario;
  const nome = sessao?.nome || propNome || "Administrador Premier";
  const nomePerfilLegivel = NOMES_PERFIS[perfil] || perfil;

  const isFiscal = perfil.startsWith("PETROBRAS");
  const isAdmin = perfil === "PREMIER_ADMIN";

  // Obter iniciais do nome
  const partesNome = nome.trim().split(/\s+/);
  const iniciais =
    partesNome.length === 1
      ? partesNome[0].slice(0, 2).toUpperCase()
      : (partesNome[0][0] + partesNome[partesNome.length - 1][0]).toUpperCase();

  // Dados da página atual
  const infoPagina = useMemo(() => {
    const rotaExata = MAPA_PAGINAS[pathname];
    if (rotaExata) return rotaExata;

    const chave = Object.keys(MAPA_PAGINAS).find((k) => k !== "/" && pathname.startsWith(k));
    if (chave) return MAPA_PAGINAS[chave];

    return {
      titulo: "Gestão Operacional",
      subtitulo: "Sistema de Gestão de Postos",
      icone: LayoutDashboard,
    };
  }, [pathname]);

  const IconePagina = infoPagina.icone;

  // Sugestões de navegação rápida pela busca
  const itensNavegacaoSugeridos = useMemo(() => {
    if (!termoBusca.trim()) return [];
    const t = termoBusca.toLowerCase().trim();
    return Object.entries(MAPA_PAGINAS)
      .filter(([_, info]) => info.titulo.toLowerCase().includes(t) || info.subtitulo.toLowerCase().includes(t))
      .slice(0, 5);
  }, [termoBusca]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const temAvatarPersonalizado = Boolean(
    sessao?.avatarUrl &&
      sessao.avatarUrl.trim() !== "" &&
      sessao.avatarUrl !== "/marca/premier-simbolo.png"
  );

  const handleAbrirModalFoto = () => {
    setFotoPreview(temAvatarPersonalizado ? sessao?.avatarUrl || "" : "");
    setMensagemSucesso("");
    setMensagemErro("");
    setModalFotoAberta(true);
  };

  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMensagemErro("Selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMensagemErro("A imagem selecionada deve ter no máximo 2MB.");
      return;
    }

    setMensagemErro("");
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setFotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarFoto = async () => {
    setSalvandoFoto(true);
    setMensagemErro("");
    setMensagemSucesso("");

    try {
      const res = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: fotoPreview || undefined }),
      });

      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        throw new Error(data.erro || "Falha ao atualizar foto de perfil.");
      }

      setMensagemSucesso("Foto de perfil atualizada com sucesso!");
      await carregarSessao();
      window.dispatchEvent(new CustomEvent("sgp-sessao-alterada"));

      setTimeout(() => {
        setModalFotoAberta(false);
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar foto.";
      setMensagemErro(msg);
    } finally {
      setSalvandoFoto(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full h-16 bg-white border-b border-[#E3E6EB] shadow-xs select-none">
        <div className="h-full flex items-center justify-between">
          {/* BLOCO ESQUERDA: 240px perfeitamente alinhado com a largura do Menu Lateral */}
          <div className="w-[240px] shrink-0 h-full px-4 sm:px-5 flex items-center justify-between border-r border-[#E3E6EB] bg-slate-50/50 max-[860px]:w-auto max-[860px]:border-r-0">
            <Link href="/painel" className="flex items-center gap-2.5 group" title="Ir para o Painel SGP">
              <div className="w-8 h-8 rounded-lg bg-[#0D1B2E] flex items-center justify-center p-1.5 shadow-2xs group-hover:bg-[#1F4FD1] transition-colors shrink-0">
                <img
                  src="/marca/premier-simbolo.png"
                  alt="Premier SGP"
                  className="w-full h-auto object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm text-[#0F1E36] tracking-tight group-hover:text-[#1F4FD1] transition-colors">
                    SGP
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100/70 text-[#1F4FD1] border border-blue-200/80">
                    PREMIER
                  </span>
                </div>
                <span className="text-[10px] text-[#5B6474] font-medium tracking-wide">
                  Gestão de Postos
                </span>
              </div>
            </Link>
          </div>

          {/* BLOCO CENTRAL: Breadcrumb Contextual + Busca Rápida (Preenche o espaço com equilíbrio) */}
          <div className="flex-1 px-4 sm:px-6 flex items-center justify-between gap-4 min-w-0">
            {/* Breadcrumb contextual do módulo ativo */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1F4FD1] shrink-0 shadow-2xs">
                <IconePagina className="w-4 h-4" />
              </div>
              <div className="truncate leading-tight">
                <div className="flex items-center gap-1.5 text-xs text-[#5B6474]">
                  <Link href="/painel" className="hover:text-[#1F4FD1] transition-colors font-medium">
                    SGP
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="font-bold text-[#1A2230] truncate">{infoPagina.titulo}</span>
                </div>
                <span className="text-[11px] text-[#5B6474] font-normal hidden lg:block truncate mt-0.5">
                  {infoPagina.subtitulo}
                </span>
              </div>
            </div>

            {/* Barra de Pesquisa Rápida Global (Centralizada e Harmoniosa) */}
            <div ref={buscaRef} className="relative hidden md:flex items-center flex-1 max-w-xs lg:max-w-sm mx-2">
              <Search className="w-3.5 h-3.5 absolute left-3 text-[#98A2B3] pointer-events-none" />
              <input
                id="input-busca-sgp"
                type="text"
                placeholder="Buscar módulo ou tela... (Ctrl+K)"
                value={termoBusca}
                onChange={(e) => {
                  setTermoBusca(e.target.value);
                  setBuscaAberta(true);
                }}
                onFocus={() => setBuscaAberta(true)}
                className="w-full pl-9 pr-12 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-[#F8F9FC] text-[#1A2230] placeholder-[#98A2B3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4FD1] focus:border-transparent transition-all shadow-2xs"
              />
              <kbd className="absolute right-2.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white text-[#5B6474] border border-[#D0D5DD] shadow-2xs pointer-events-none">
                ⌘K
              </kbd>

              {/* Popup de resultados rápidos da busca */}
              {buscaAberta && termoBusca.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-[#D0D5DD] shadow-xl p-2 z-50 space-y-1 animate-in fade-in duration-100">
                  <div className="px-2 py-1 text-[10px] font-bold text-[#7F90AA] uppercase tracking-wider">
                    Módulos Encontrados
                  </div>
                  {itensNavegacaoSugeridos.length > 0 ? (
                    itensNavegacaoSugeridos.map(([rota, item]) => {
                      const ItemIcone = item.icone;
                      return (
                        <button
                          key={rota}
                          type="button"
                          onClick={() => {
                            router.push(rota);
                            setBuscaAberta(false);
                            setTermoBusca("");
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors cursor-pointer group"
                        >
                          <ItemIcone className="w-4 h-4 text-[#1F4FD1] shrink-0" />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-[#1A2230] group-hover:text-[#1F4FD1]">
                              {item.titulo}
                            </div>
                            <div className="text-[11px] text-[#5B6474] truncate">
                              {item.subtitulo}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-[#5B6474]">
                      Nenhum módulo encontrado para &quot;{termoBusca}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BLOCO DIREITA: Status Online + Usuário + Foto + Ações */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Badge sutil de status online */}
              <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online</span>
              </div>

              {/* Bloco do Perfil com Avatar interativo */}
              <div
                onClick={handleAbrirModalFoto}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                title="Clique para gerenciar a foto do seu perfil"
              >
                {/* Avatar do Usuário com botão de câmera ao passar o mouse */}
                <div className="relative shrink-0">
                  {temAvatarPersonalizado ? (
                    <img
                      src={sessao!.avatarUrl}
                      alt={nome}
                      className="w-8 h-8 rounded-full object-cover border border-[#D0D5DD] shadow-2xs bg-white"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${
                        isAdmin
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : isFiscal
                          ? "bg-[#E7F6EE] text-[#0F7B4F] border border-[#A7F3D0]"
                          : "bg-[#E8EEFD] text-[#1F4FD1] border border-[#BFDBFE]"
                      }`}
                    >
                      {iniciais}
                    </div>
                  )}

                  {/* Ícone de câmera no hover */}
                  <div className="absolute inset-0 rounded-full bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-left hidden sm:block leading-tight">
                  <span className="font-semibold text-xs text-[#1A2230] group-hover:text-[#1F4FD1] transition-colors block">
                    {nome}
                  </span>
                  <span className="text-[11px] text-[#5B6474] flex items-center gap-1 font-medium">
                    <Shield
                      className={`w-2.5 h-2.5 ${
                        isAdmin
                          ? "text-purple-600"
                          : isFiscal
                          ? "text-[#0F7B4F]"
                          : "text-[#1F4FD1]"
                      }`}
                    />
                    <span>{nomePerfilLegivel}</span>
                  </span>
                </div>
              </div>

              <div className="h-6 w-px bg-[#E3E6EB] hidden sm:block" />

              {/* Ações: Atalho Admin (se for admin) + Alterar senha + Logout */}
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-[#5B6474] hover:text-[#1F4FD1] px-2 py-1 rounded hover:bg-[#F2F4F7] transition-colors"
                    title="Abrir painel de Administração"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Administração</span>
                  </Link>
                )}

                <Link
                  href="/login/trocar-senha"
                  className="text-[11px] font-medium text-[#5B6474] hover:text-[#1F4FD1] px-2 py-1 rounded hover:bg-[#F2F4F7] transition-colors"
                  title="Alterar a senha da sua conta local"
                >
                  Alterar senha
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[#5B6474] hover:text-[#B42318] p-1.5 rounded-lg hover:bg-[#FEF3F2] transition-colors cursor-pointer"
                  title="Encerrar sessão"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MODAL: ADICIONAR / ALTERAR FOTO DE PERFIL */}
      {modalFotoAberta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#E3E6EB] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1F4FD1] flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1A2230]">Foto de Perfil</h3>
                  <p className="text-[11px] text-[#5B6474]">Personalize sua imagem de usuário</p>
                </div>
              </div>
              <button
                onClick={() => setModalFotoAberta(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagens de feedback */}
            {mensagemSucesso && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{mensagemSucesso}</span>
              </div>
            )}
            {mensagemErro && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {mensagemErro}
              </div>
            )}

            {/* Área de Prévia e Upload */}
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative group">
                {fotoPreview ? (
                  <img
                    src={fotoPreview}
                    alt="Prévia da foto"
                    className="w-24 h-24 rounded-full object-cover border-3 border-[#1F4FD1] shadow-md bg-white"
                  />
                ) : (
                  <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-2xl shadow-md ${
                      isAdmin
                        ? "bg-purple-100 text-purple-800 border-2 border-purple-300"
                        : isFiscal
                        ? "bg-[#E7F6EE] text-[#0F7B4F] border-2 border-[#A7F3D0]"
                        : "bg-[#E8EEFD] text-[#1F4FD1] border-2 border-[#BFDBFE]"
                    }`}
                  >
                    {iniciais}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#1F4FD1] hover:bg-[#163CA8] text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                  title="Selecionar imagem"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#1A2230]">{nome}</div>
                <div className="text-[11px] text-[#5B6474]">{sessao?.email || ""}</div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleArquivoSelecionado}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white hover:border-[#1F4FD1] hover:text-[#1F4FD1] text-xs font-semibold text-[#344054] shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Escolher Imagem</span>
                </button>

                {fotoPreview && (
                  <button
                    type="button"
                    onClick={() => setFotoPreview("")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
                    title="Remover foto e restaurar iniciais padrão"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-[#5B6474] max-w-xs">
                Formatos aceitos: JPG, PNG ou WEBP. Tamanho máximo de 2MB.
              </p>
            </div>

            {/* Botões do Rodapé do Modal */}
            <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalFotoAberta(false)}
                disabled={salvandoFoto}
                className="h-8 px-3.5 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarFoto}
                disabled={salvandoFoto}
                className="h-8 px-4 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {salvandoFoto ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
