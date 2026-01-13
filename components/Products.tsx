
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
    updateState(prev => ({ ...prev, priceHistory: [...prev.priceHistory, ph] }));
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-black text-slate-800 uppercase">Product Pricing</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compact Price List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b font-black text-[10px] text-slate-400 uppercase tracking-widest">Active Selling Rates</div>
          <table className="w-full text-left text-[11px]">
            <tbody className="divide-y divide-slate-100">
              {currentPrices.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-bold text-slate-700">
                    {p.name.split(' (')[0]}
                    <span className="block text-[8px] font-medium text-slate-400">Effective: {p.date}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-black text-emerald-700">₹{p.price}</td>
                  <td className="px-4 py-2 text-center">
                    {editingProductId === p.id ? (
                      <div className="space-y-1">
                        <input type="date" className="w-full border rounded px-1 py-0.5 text-[10px]" value={newPrice.date} onChange={e => setNewPrice({...newPrice, date: e.target.value})} />
                        <div className="flex gap-1">
                          <input type="number" className="w-14 border rounded px-1 text-[10px]" value={newPrice.amount} onChange={e => setNewPrice({...newPrice, amount: parseFloat(e.target.value)})}/>
                          <button onClick={() => handleAddPrice(p.id)} className="bg-emerald-600 text-white px-2 rounded text-[9px] font-bold">Save</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditingProductId(p.id)} className="text-blue-600 font-bold hover:underline text-[9px]">Update</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Improved Chart */}
        <div className="lg:col-span-2 bg-white p-4 rounded-2xl border shadow-sm h-[300px]">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Price History Visualization</h2>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={8} axisLine={false} tickLine={false} />
              <YAxis fontSize={8} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: '9px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '8px', paddingTop: '10px' }} />
              {state.products.map((p, idx) => (
                <Line key={p.id} type="stepAfter" dataKey={p.name} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
