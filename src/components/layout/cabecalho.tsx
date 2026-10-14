"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Shield, LogOut, Camera, Upload, X, Check, Trash2, Settings } from "lucide-react";
import { NOMES_PERFIS } from "@/lib/auth/permissoes";
import { PerfilUsuario, UsuarioSessao } from "@/lib/auth/tipos";

interface CabecalhoProps {
  perfilAtivo?: string;
  nomeUsuario?: string;
}

export function Cabecalho({
  perfilAtivo: propPerfil,
  nomeUsuario: propNome,
}: CabecalhoProps) {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [modalFotoAberta, setModalFotoAberta] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>("");
  const [mensagemErro, setMensagemErro] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Esquerda: Espaço limpo e desobstruído (itens de contrato e ponto removidos conforme solicitação) */}
          <div className="flex items-center gap-2" />

          {/* Direita: Foto/Perfil do Usuário + Ações */}
          <div className="flex items-center gap-3 sm:gap-4">
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
