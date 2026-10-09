"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, RefreshCw, LogOut } from "lucide-react";
import { TIMEOUT_INATIVIDADE_MS } from "@/lib/auth/tipos";

// Aviso exibido quando faltar 2 minutos para expirar por inatividade
const AVISO_ANTECEDENCIA_MS = 2 * 60 * 1000;
// Intervalo mínimo entre renovações da sessão no servidor durante atividade
const RENOVACAO_SERVIDOR_MS = 4 * 60 * 1000;

export function MonitorInatividade() {
  const router = useRouter();
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState<number | null>(null);
  const [exibirModalAviso, setExibirModalAviso] = useState<boolean>(false);
  const ultimaAtividadeRef = useRef<number>(Date.now());
  const ultimaRenovacaoRef = useRef<number>(Date.now());

  const renovarNoServidor = useCallback((forcar = false) => {
    if (!forcar && Date.now() - ultimaRenovacaoRef.current < RENOVACAO_SERVIDOR_MS) return;
    ultimaRenovacaoRef.current = Date.now();
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.autenticado === false) router.push("/login?expirado=inatividade");
      })
      .catch(() => {
        // rede indisponível: tenta novamente na próxima atividade
      });
  }, [router]);

  const registrarAtividade = useCallback(() => {
    ultimaAtividadeRef.current = Date.now();
    renovarNoServidor();
    if (exibirModalAviso) {
      setExibirModalAviso(false);
      setTempoRestanteSegundos(null);
    }
  }, [exibirModalAviso, renovarNoServidor]);

  useEffect(() => {
    const eventos: (keyof WindowEventMap)[] = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handler = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          registrarAtividade();
          throttleTimeout = null;
        }, 1000);
      }
    };

    eventos.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));

    // Verificador periódico a cada 5 segundos
    const intervalo = setInterval(() => {
      const decorrido = Date.now() - ultimaAtividadeRef.current;
      const restante = TIMEOUT_INATIVIDADE_MS - decorrido;

      if (restante <= 0) {
        // Expirou
        clearInterval(intervalo);
        setExibirModalAviso(false);
        try {
          // Dispara evento para limpar estado se necessário
          window.dispatchEvent(new CustomEvent("sgp-sessao-expirada"));
        } catch {
          // ignore
        }
        fetch("/api/auth", { method: "DELETE" }).finally(() => {
          router.push("/login?expirado=inatividade");
        });
      } else if (restante <= AVISO_ANTECEDENCIA_MS) {
        // Entrou na janela de aviso
        setExibirModalAviso(true);
        setTempoRestanteSegundos(Math.max(1, Math.floor(restante / 1000)));
      } else {
        if (exibirModalAviso) {
          setExibirModalAviso(false);
        }
      }
    }, 5000);

    return () => {
      eventos.forEach((evt) => window.removeEventListener(evt, handler));
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(intervalo);
    };
  }, [registrarAtividade, router, exibirModalAviso]);

  const continuarSessao = () => {
    ultimaAtividadeRef.current = Date.now();
    renovarNoServidor(true);
    setExibirModalAviso(false);
    setTempoRestanteSegundos(null);
  };

  const sairAgora = () => {
    setExibirModalAviso(false);
    fetch("/api/auth", { method: "DELETE" }).finally(() => {
      router.push("/login");
    });
  };

  if (!exibirModalAviso) return null;

  const minutos = tempoRestanteSegundos !== null ? Math.floor(tempoRestanteSegundos / 60) : 0;
  const segundos = tempoRestanteSegundos !== null ? tempoRestanteSegundos % 60 : 0;
  const textoTempo = `${minutos}:${segundos.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-amber-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-amber-500 px-6 py-4 flex items-center gap-3 text-white">
          <Clock className="w-6 h-6 animate-pulse" />
          <h2 className="text-base font-bold">Aviso de Inatividade de Sessão</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 leading-relaxed">
              Por razões de segurança e conformidade LGPD com a Petrobras, sua sessão será
              automaticamente encerrada por inatividade em:
            </div>
          </div>

          <div className="text-center py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-3xl font-mono font-bold text-amber-900 tabular-nums">
              {textoTempo}
            </span>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Clique em &ldquo;Permanecer Conectado&rdquo; para renovar sua sessão imediatamente.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={sairAgora}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair Agora
            </button>
            <button
              onClick={continuarSessao}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Permanecer Conectado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
