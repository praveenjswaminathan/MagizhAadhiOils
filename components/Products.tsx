
import React, { useState, useMemo } from 'react';
import { AppState, PriceHistory } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const Pricing: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    amount: 0 
  });

  const handleAddPrice = (productId: string) => {
    if (!isAdmin) return;
    if (newPrice.amount <= 0) return alert("Enter valid price");
    
    const existingIdx = state.priceHistory.findIndex(ph => ph.productId === productId && ph.effectiveDate === newPrice.date);
    const id = existingIdx >= 0 ? state.priceHistory[existingIdx].id : crypto.randomUUID();
    const ph: PriceHistory = {
      id,
      productId,
      effectiveDate: newPrice.date,
      unitPrice: newPrice.amount
    };
    
    updateState(prev => ({ 
      ...prev, 
      priceHistory: [...prev.priceHistory.filter(item => item.id !== id), ph] 
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
      const history = state.priceHistory
        .filter(ph => ph.productId === p.id)
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      
      const latest = history
        .filter(ph => ph.effectiveDate <= today)
        .sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
        
      return { 
        ...p, 
        price: latest?.unitPrice || 0, 
        date: latest?.effectiveDate,
        history 
      };
    });
  }, [state]);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const renderProductName = (fullName: string) => {
    const parts = fullName.split(' - ');
    if (parts.length < 2) return <span className="font-black text-slate-800">{fullName}</span>;
    return (
      <div className="flex flex-col">
        <span className="font-black text-slate-800 text-sm leading-tight tracking-tight">{parts[0]}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{parts[1]}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">Pricing Control</h1>
          <p className="text-slate-500 font-medium text-sm italic">Manage active rates and monitor historical price shifts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
        <div className="bg-white rounded-[32px] border shadow-premium overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="px-6 py-5">Product Details</th>
                <th className="px-6 py-5 text-right">Current Rate</th>
                <th className="px-6 py-5">Effective Date</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentPrices.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5">{renderProductName(p.name)}</td>
                    <td className="px-6 py-5 text-right font-black text-emerald-900 text-xl tracking-tighter">₹{p.price}</td>
                    <td className="px-6 py-5 font-bold text-slate-500 text-xs italic">{p.date || 'N/A'}</td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex justify-center gap-2">
                        {isAdmin && (
                          <button 
                            onClick={() => { setEditingProductId(editingProductId === p.id ? null : p.id); setViewHistoryId(null); }} 
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editingProductId === p.id ? 'bg-emerald-700 text-white shadow-lg' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                          >
                            Update
                          </button>
                        )}
                        <button 
                          onClick={() => { setViewHistoryId(viewHistoryId === p.id ? null : p.id); setEditingProductId(null); }} 
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewHistoryId === p.id ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {isAdmin && (editingProductId === p.id || viewHistoryId === p.id) && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="px-6 py-6 border-b border-slate-200">
                        {editingProductId === p.id && (
                          <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-xl max-w-2xl mx-auto animate-in slide-in-from-top-4 duration-300">
                            <p className="text-[10px] font-black uppercase text-emerald-800 mb-4 tracking-widest">Schedule New Rate Change</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">New Effective Date</label>
                                  <input type="date" className="w-full border rounded-xl px-4 py-2.5 text-sm font-bold bg-slate-50" value={newPrice.date} onChange={e => setNewPrice({...newPrice, date: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">New Price (₹)</label>
                                  <input type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm font-black bg-slate-50" value={newPrice.amount || ''} placeholder="₹ Value" onChange={e => setNewPrice({...newPrice, amount: parseFloat(e.target.value)})}/>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => handleAddPrice(p.id)} className="flex-grow bg-emerald-950 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest shadow-lg">Confirm Rate Update</button>
                                <button onClick={() => setEditingProductId(null)} className="px-6 border-2 border-slate-200 text-slate-400 font-black rounded-xl text-[10px] uppercase">Cancel</button>
                            </div>
                          </div>
                        )}

                        {viewHistoryId === p.id && (
                          <div className="max-w-2xl mx-auto space-y-2 animate-in fade-in duration-300">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Historical Price Timeline</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {[...p.history].reverse().map((entry, idx, arr) => {
                                const nextEntry = arr[idx-1]; 
                                const fromDate = entry.effectiveDate;
                                const toDate = nextEntry ? nextEntry.effectiveDate : 'Present';
                                return (
                                  <div key={entry.id} className="flex justify-between items-center text-[10px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-emerald-700 text-sm">₹{entry.unitPrice}</span>
                                        <span className="text-slate-400 font-bold tracking-tighter text-[9px]">{fromDate} <span className="mx-1 opacity-40">→</span> {toDate}</span>
                                    </div>
                                    {idx === 0 && <span className="text-[7px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded tracking-widest">ACTIVE</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  
                  {!isAdmin && viewHistoryId === p.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="px-6 py-6 border-b border-slate-200">
                        <div className="max-w-2xl mx-auto space-y-2 animate-in fade-in duration-300">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Historical Price Timeline</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[...p.history].reverse().map((entry, idx, arr) => {
                              const nextEntry = arr[idx-1]; 
                              const fromDate = entry.effectiveDate;
                              const toDate = nextEntry ? nextEntry.effectiveDate : 'Present';
                              return (
                                <div key={entry.id} className="flex justify-between items-center text-[10px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center gap-3">
                                      <span className="font-black text-emerald-700 text-sm">₹{entry.unitPrice}</span>
                                      <span className="text-slate-400 font-bold tracking-tighter text-[9px]">{fromDate} <span className="mx-1 opacity-40">→</span> {toDate}</span>
                                  </div>
                                  {idx === 0 && <span className="text-[7px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded tracking-widest">ACTIVE</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-emerald-950 p-10 rounded-[40px] shadow-2xl h-full flex flex-col border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5 text-9xl text-white">📉</div>
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-2">Pricing Trends</h2>
              <p className="text-2xl font-black italic text-white tracking-tighter leading-none">Market Rate Volatility Timeline</p>
            </div>
          </div>
          <div className="flex-grow min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} dy={10} stroke="#475569" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} dx={-10} tickFormatter={(v) => `₹${v}`} stroke="#475569" />
                <Tooltip 
                    contentStyle={{ 
                      fontSize: '11px', 
                      borderRadius: '20px', 
                      border: 'none', 
                      backgroundColor: '#022c22',
                      color: '#fff',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                      padding: '20px',
                      fontWeight: '800'
                    }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '30px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                {state.products.map((p, idx) => (
                    <Line 
                    key={p.id} 
                    type="stepAfter" 
                    dataKey={p.name} 
                    stroke={colors[idx % colors.length]} 
                    strokeWidth={4} 
                    dot={{ r: 4, strokeWidth: 2, fill: '#022c22' }} 
                    activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                ))}
                </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
