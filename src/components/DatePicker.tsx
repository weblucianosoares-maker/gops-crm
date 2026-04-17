import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "./Icons";
import { cn } from "../lib/utils";

interface DatePickerProps {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  themeColor?: string; // Tailwind color class like "blue-600"
}

export const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = "DD/MM/AAAA", 
  className,
  themeColor = "blue-600"
}: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Internal state for calendar navigation
  const [viewDate, setViewDate] = useState(new Date());

  // Sync internal display value when external value changes
  useEffect(() => {
    // Only sync if field is NOT focused. If it IS focused, the user's typing
    // takes priority, and we don't want to reset it while they are in the middle of a date.
    if (!isFocused) {
      if (value) {
        const [y, m, d] = value.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          setDisplayValue(`${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`);
          setViewDate(new Date(y, m - 1, d));
        }
      } else {
        setDisplayValue("");
      }
    }
  }, [value, isFocused]);

  // Handle typing with mask
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 8) val = val.substring(0, 8);
    
    let formatted = val;
    if (val.length > 2) formatted = val.substring(0, 2) + "/" + val.substring(2);
    if (val.length > 4) formatted = formatted.substring(0, 5) + "/" + val.substring(4);
    
    setDisplayValue(formatted);

    // Immediate validation for full dates (8 digits) or 6 digits (short year)
    if (val.length === 8 || val.length === 6) {
      const d = val.substring(0, 2);
      const m = val.substring(2, 4);
      let y = val.substring(4);
      
      // Auto-convert YY to YYYY (assume 20YY if <= current year + 10, else 19YY)
      if (y.length === 2) {
        const yearNum = parseInt(y);
        const currentYearShort = new Date().getFullYear() % 100;
        y = yearNum <= currentYearShort + 2 ? `20${y}` : `19${y}`;
      }
      
      const iso = `${y}-${m}-${d}`;
      const parsed = Date.parse(iso);
      if (!isNaN(parsed)) {
        onChange(iso);
        setViewDate(new Date(parsed));
      }
    } else if (val.length === 0) {
      onChange(null as any); // Use null for DB compatibility
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // Final validation on blur
    const val = displayValue.replace(/\D/g, "");
    if (val.length === 8 || val.length === 6) {
      const d = val.substring(0, 2);
      const m = val.substring(2, 4);
      let y = val.substring(4);
      
      if (y.length === 2) {
        const yearNum = parseInt(y);
        const currentYearShort = new Date().getFullYear() % 100;
        y = yearNum <= currentYearShort + 2 ? `20${y}` : `19${y}`;
      }
      
      const iso = `${y}-${m}-${d}`;
      if (!isNaN(Date.parse(iso))) {
        onChange(iso);
      }
    } else if (val.length === 0) {
      onChange(null as any);
    }
  };

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    const iso = `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onChange(iso);
    setIsOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative group">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={cn(
            "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white transition-all pr-12",
            isOpen && `ring-2 ring-${themeColor}/20 border-${themeColor}`
          )}
        />
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors",
            isOpen ? `text-${themeColor} bg-${themeColor}/5` : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
        >
          <Icons.Calendar className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[300] top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-[280px]"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={prevMonth}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
              >
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                  className="px-2 py-1 hover:bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors"
                >
                  {months[viewDate.getMonth()]}
                </button>
                <button 
                  onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                  className="px-2 py-1 hover:bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors"
                >
                  {viewDate.getFullYear()}
                </button>
              </div>

              <button 
                onClick={nextMonth}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
              >
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {viewMode === 'days' && (
              <>
                {/* Week Days */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map(d => (
                    <div key={d} className="text-[8px] font-black text-slate-300 text-center py-1">{d}</div>
                  ))}
                </div>

                {/* Month Days */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear()) }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth(viewDate.getMonth(), viewDate.getFullYear()) }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = value === `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString();
                    
                    return (
                      <button
                        key={day}
                        onClick={() => handleDateSelect(day)}
                        className={cn(
                          "aspect-square text-[11px] font-bold rounded-lg flex items-center justify-center transition-all",
                          isSelected 
                            ? (themeColor === "blue-600" ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : `bg-${themeColor} text-white shadow-lg`) 
                            : (isToday ? "text-blue-500 bg-blue-50" : "text-slate-600 hover:bg-slate-50")
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {viewMode === 'months' && (
              <div className="grid grid-cols-3 gap-2 py-2">
                {months.map((month, idx) => (
                  <button
                    key={month}
                    onClick={() => {
                      setViewDate(new Date(viewDate.getFullYear(), idx, 1));
                      setViewMode('days');
                    }}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      viewDate.getMonth() === idx ? "bg-blue-600 text-white font-black" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {month.substring(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'years' && (
              <div className="grid grid-cols-4 gap-2 py-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <button
                    key={year}
                    onClick={() => {
                      setViewDate(new Date(year, viewDate.getMonth(), 1));
                      setViewMode('days');
                    }}
                    className={cn(
                      "py-2 rounded-lg text-[10px] font-black transition-all",
                      viewDate.getFullYear() === year ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
            
            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  onChange(today);
                  setIsOpen(false);
                }}
                className="py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-500 transition-all"
              >
                Hoje
              </button>
              <button 
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-500 transition-all"
              >
                Limpar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
