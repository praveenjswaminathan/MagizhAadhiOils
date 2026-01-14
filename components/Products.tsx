import React, { useState, useMemo } from 'react';
import { AppState, PriceHistory } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const Pricing: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    amount: 0 
  });

  const handleAddPrice = (productId: string) => {
    if (newPrice.amount <= 0) return alert("Enter valid price");
    const ph: PriceHistory = {
      id: crypto.randomUUID(),
      productId,
      effectiveDate: newPrice.date,
      unitPrice: newPrice.amount
    };
    
    // Crucial: Update state correctly to trigger saveState
    updateState(prev => ({ 
      ...prev, 
      priceHistory: [...prev.priceHistory, ph] 
    }));
    
    setEditingProductId(null);
    setNewPrice({ date: new Date().toISOString().split('T')[0], amount: 0 });
  };

  const chartData = useMemo(() => {
    const dates = Array.from(new Set(state.priceHistory.map(ph => ph.effectiveDate))).sort();
    return dates.map(date => {
      const point: any = { date };
      state.products.forEach(p => {
        const ph = state.priceHistory
          .filter(h => h.productId === p.id && h.effectiveDate <= date)
          .sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
        point[p.name] = ph ? ph.unitPrice : null;
      });
      return point;
    });
  }, [state]);

  const currentPrices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return state.products.map(p => {
      const latest = state.priceHistory
        .filter(ph => ph.productId === p.id && ph.effectiveDate <= today)
        .sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
      return { ...p, price: latest?.unitPrice || 0, date: latest?.effectiveDate };
    });
  }, [state]);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Market Pricing</h1>
        <p className="text-slate-500 font-medium text-sm italic">Manage active selling rates and analyze price trends.</p>
      </div>

      <div className="flex flex-col gap-10">
        <div className="bg-white rounded-[32px] border shadow-premium overflow-hidden">
          <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="font-black text-xs text-slate-400 uppercase tracking-widest">Active Rate List</h2>
            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Real-time Sync</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-8 py-5">Product Definition</th>
                  <th className="px-8 py-5 text-right">Selling Rate (₹/L)</th>
                  <th className="px-8 py-5 text-center">New Entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentPrices.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800 text-lg tracking-tight">{p.name.split(' (')[0]}</p>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 block italic">Effective: {p.date}</span>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-3xl text-emerald-700 italic tracking-tighter leading-none">₹{p.price}</td>
                    <td className="px-8 py-6 text-center">
                      {editingProductId === p.id ? (
                        <div className="flex flex-col gap-2 bg-slate-100 p-4 rounded-2xl animate-in zoom-in duration-200 border border-emerald-100">
                          <input type="date" className="w-full border rounded-xl px-3 py-2 text-xs font-bold" value={newPrice.date} onChange={e => setNewPrice({...newPrice, date: e.target.value})} />
                          <div className="flex gap-2">
                            <input type="number" className="flex-grow border rounded-xl px-3 text-sm font-black" value={newPrice.amount || ''} placeholder="₹ Value" onChange={e => setNewPrice({...newPrice, amount: parseFloat(e.target.value)})}/>
                            <button onClick={() => handleAddPrice(p.id)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Save</button>
                            <button onClick={() => setEditingProductId(null)} className="text-slate-400 hover:text-rose-500 text-[10px] font-black uppercase transition-colors">✖</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setEditingProductId(p.id)} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95">Update Rate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border shadow-premium h-[500px]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pricing Analytics</h2>
              <p className="text-xl font-black italic text-slate-800 tracking-tighter">Historical Market Trend</p>
            </div>
            <div className="flex gap-2 opacity-30">
               <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
               <div className="w-3 h-3 rounded-full bg-blue-500"></div>
               <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} dy={10} stroke="#94a3b8" />
              <YAxis fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} dx={-10} tickFormatter={(v) => `₹${v}`} stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  fontSize: '11px', 
                  borderRadius: '20px', 
                  border: 'none', 
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                  padding: '20px',
                  fontWeight: '800'
                }} 
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '30px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
              {state.products.map((p, idx) => (
                <Line 
                  key={p.id} 
                  type="stepAfter" 
                  dataKey={p.name} 
                  stroke={colors[idx % colors.length]} 
                  strokeWidth={4} 
                  dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Pricing;