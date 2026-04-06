import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const success = (msg: string) => toast(msg, 'success');
  const error = (msg: string) => toast(msg, 'error');

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[320px] max-w-md bg-white backdrop-blur-xl",
                t.type === 'success' ? "border-emerald-100 ring-4 ring-emerald-500/5" :
                t.type === 'error' ? "border-rose-100 ring-4 ring-rose-500/5" :
                "border-blue-100 ring-4 ring-blue-500/5"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                t.type === 'success' ? "bg-emerald-50 text-emerald-600" :
                t.type === 'error' ? "bg-rose-50 text-rose-600" :
                "bg-blue-50 text-blue-600"
              )}>
                {t.type === 'success' ? <Icons.CheckCircle className="w-5 h-5" /> :
                 t.type === 'error' ? <Icons.AlertCircle className="w-5 h-5" /> :
                 <Icons.Info className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                  {t.type === 'success' ? "Sucesso" : t.type === 'error' ? "Erro" : "Aviso"}
                </p>
                <p className="text-sm font-bold text-slate-800 leading-tight">
                  {t.message}
                </p>
              </div>
              <button 
                onClick={() => removeToast(t.id)}
                className="p-1 px-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
