import React from "react";
import { AIGuidedLeadCreate } from "../components/AIGuidedLeadCreate";
import { Icons } from "../components/Icons";

export default function AIInterviewPage() {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="flex-1 relative overflow-hidden bg-white mx-4 my-4 rounded-3xl shadow-xl border border-slate-100 flex flex-col">
        {/* Header da Página */}
        <div className="px-8 py-6 border-b flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Icons.Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-blue-900 leading-tight">Entrevista Mágica</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Consultoria de Vendas com IA Gemini</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Status da IA</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs font-bold text-slate-700">Online & Pronta</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Mantendo a AIGuidedLeadCreate visível e aberta */}
        <div className="flex-1 relative overflow-hidden">
          <AIGuidedLeadCreate 
            isOpen={true} 
            onClose={() => {}} // Não fecha nesta página
            onSuccess={(id) => {
              // Poderia redirecionar para o lead, mas deixaremos na página para nova entrevista se desejar
              console.log("Lead criado com sucesso:", id);
            }}
          />
        </div>
      </div>
    </div>
  );
}
