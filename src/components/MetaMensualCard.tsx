"use client";

import { useState } from "react";
import { Activity, Edit2, Check, Loader2 } from "lucide-react";
import { actualizarMetaMensual } from "@/app/(dashboard)/actions";

export default function MetaMensualCard({ countFacturadosMes, initialMeta }: { countFacturadosMes: number, initialMeta: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [meta, setMeta] = useState(initialMeta);
  const [inputValue, setInputValue] = useState(initialMeta.toString());
  const [isLoading, setIsLoading] = useState(false);

  const percentMes = Math.round((countFacturadosMes / meta) * 100);

  const handleSave = async () => {
    const val = parseInt(inputValue, 10);
    if (isNaN(val) || val <= 0) {
      setInputValue(meta.toString());
      setIsEditing(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await actualizarMetaMensual(val);
      if (res.success) {
        setMeta(val);
      } else {
        setInputValue(meta.toString());
      }
    } catch (e) {
      setInputValue(meta.toString());
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className={`absolute right-4 top-4 rounded-xl p-3 bg-purple-50`}>
        <Activity className={`h-6 w-6 text-purple-500`} />
      </div>
      <p className="text-sm font-medium text-slate-500 pr-12">Facturados en el Mes</p>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{countFacturadosMes}</p>
      
      <div className="mt-2 flex items-center">
        {isEditing ? (
            <div className="flex items-center gap-2 bg-purple-50 ring-1 ring-purple-200 rounded-md px-2 py-1">
                <span className="text-xs font-semibold text-purple-600">Meta:</span>
                <input 
                    type="number" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-12 text-xs font-bold text-center border-none p-0 bg-transparent focus:ring-0 text-purple-700"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button onClick={handleSave} disabled={isLoading} className="text-purple-600 hover:text-purple-800 disabled:opacity-50">
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
            </div>
        ) : (
            <div 
                className="group flex items-center gap-1.5 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md cursor-pointer hover:bg-purple-100 transition-colors"
                onClick={() => setIsEditing(true)}
            >
                <span className="text-xs font-semibold text-purple-600">
                    Meta del mes: {meta} ({percentMes}%)
                </span>
                <Edit2 className="w-3 h-3 text-purple-400 group-hover:text-purple-600" />
            </div>
        )}
      </div>
    </div>
  );
}
