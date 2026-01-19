
import React, { useMemo, useState } from 'react';
import { AppState, ReturnType } from '../types';
import { getInventoryMetrics, calculateOutstanding } from '../db';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const [selectedHubId, setSelectedHubId] = useState<'all' | string>('all');

  const stats = useMemo(() => {
    const totalRevenue = state.saleLines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
    const totalProductionValue = state.consignmentLines.reduce((sum, cl) => sum + (cl.qtyL * cl.unitPrice), 0);
    const totalConsignments = state.consignments.length;

    const totalReceivable = state.customers.reduce((sum, c) => {
      const out = calculateOutstanding(state, c.id);
      return sum + (out > 0 ? out : 0);
    }, 0);

    const inventory = state.products.map(p => ({
      ...p,
      metrics: getInventoryMetrics(state, selectedHubId, p.id)
    }));
    const totalStockValue = inventory.reduce((sum, i) => sum + i.metrics.value, 0);

    const stockAlerts: { product: string; hub: string; qty: number }[] = [];
    state.products.forEach(p => {
       state.hubs.forEach(h => {
          const m = getInventoryMetrics(state, h.id, p.id);
          if (m.qty < 10) {
            stockAlerts.push({ product: p.name, hub: h.name, qty: m.qty });
          }
       });
    });

    const salesSummary = state.products.map(p => {
      const volume = state.saleLines
        .filter(sl => sl.productId === p.id)
        .reduce((sum, sl) => sum + sl.qtyL, 0);
      return { name: p.name.split(' - ')[0], volume };
    }).sort((a,b) => b.volume - a.volume);

    const salesByDate: { [date: string]: number } = {};
    state.sales.forEach(s => {
      const amount = state.saleLines.filter(sl => sl.saleId === s.id).reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
      salesByDate[s.saleDate] = (salesByDate[s.saleDate] || 0) + amount;
    });
    const chartData = Object.keys(salesByDate).sort().map(date => ({ date, amount: salesByDate[date] }));

    const recentActivity = [
      ...state.sales.slice(-3).map(s => ({ type: 'Sale', text: `Invoice ${s.saleNo} generated`, date: s.saleDate, icon: '💰' })),
      ...state.payments.slice(-3).map(p => ({ type: 'Payment', text: `Credit of ₹${p.amount} received`, date: p.paymentDate, icon: '💳' })),
      ...state.consignments.slice(-3).map(c => ({ type: 'Batch', text: `Batch ${c.consignmentNo} received`, date: c.receiveDate, icon: '📦' }))
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return { totalRevenue, totalReceivable, totalStockValue, totalProductionValue, totalConsignments, totalCustomers: state.customers.length, chartData, stockAlerts, salesSummary, recentActivity };
  }, [state, selectedHubId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase italic">Magizh Vitals</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] italic">Real-Time Enterprise Intelligence</p>
        </div>
        <select 
          className="bg-white border-2 border-slate-100 rounded-2xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest shadow-sm outline-none cursor-pointer focus:border-emerald-500 transition-all"
          value={selectedHubId}
          onChange={(e) => setSelectedHubId(e.target.value)}
        >
          <option value="all">Consolidated Hubs</option>
          {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon="📈" color="emerald" />
        <StatCard title="Stock Asset" value={`₹${stats.totalStockValue.toLocaleString()}`} icon="📦" color="amber" />
        <StatCard title="Active Dues" value={`₹${stats.totalReceivable.toLocaleString()}`} icon="📉" color="rose" />
        <StatCard title="Production" value={`₹${stats.totalProductionValue.toLocaleString()}`} icon="🏗️" color="blue" subtitle={`${stats.totalConsignments} Batches`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-[40px] border shadow-premium p-8 lg:p-10 space-y-6">
           <div className="flex justify-between items-center">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none italic">Sales Traction Velocity</h2>
             <div className="flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">Live Engine Feed</span>
             </div>
           </div>
           <div className="h-[280px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="date" fontSize={9} fontWeight={900} axisLine={false} tickLine={false} dy={10} stroke="#94a3b8" />
                  <YAxis fontSize={9} fontWeight={900} axisLine={false} tickLine={false} dx={-10} stroke="#94a3b8" tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', 
                        padding: '20px',
                        fontSize: '11px',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                    }} 
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorAmount)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
            <div className="bg-emerald-950 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-10 opacity-5 text-9xl">🌿</div>
                <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">Top Performers</h2>
                <div className="space-y-4">
                    {stats.salesSummary.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div>
                                <p className="text-xs font-black tracking-tight leading-none mb-1">{item.name}</p>
                                <p className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest italic">{item.volume} Liters Sold</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${idx === 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-emerald-800/50 text-emerald-400'}`}>
                                  {idx === 0 ? 'Winner' : `#${idx+1}`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/5">
                  <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">Recent Activity</h2>
                  <div className="space-y-3">
                    {stats.recentActivity.map((act, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm">{act.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-white truncate leading-none mb-1">{act.text}</p>
                          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest italic">{act.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>

            {stats.stockAlerts.length > 0 && (
                <div className="bg-rose-50 border-2 border-rose-100 rounded-[32px] p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🚨</span>
                        <h2 className="text-[9px] font-black text-rose-800 uppercase tracking-[0.2em]">Low Stock Warning</h2>
                    </div>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                        {stats.stockAlerts.map((alert, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-2xl border border-rose-100 flex justify-between items-center">
                                <div className="min-w-0 pr-2">
                                    <p className="text-[10px] font-black text-slate-800 truncate leading-none mb-1">{alert.product.split(' - ')[0]}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{alert.hub.split(' ')[0]}</p>
                                </div>
                                <span className="text-xs font-black text-rose-600 shrink-0">{alert.qty}L</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: string; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => {
  const themes: any = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700'
  };
  return (
    <div className={`p-6 rounded-[32px] border-2 shadow-sm ${themes[color]} transition-all hover:scale-[1.02] hover:shadow-xl`}>
      <div className="flex justify-between items-center mb-4">
         <span className="text-3xl filter drop-shadow-md">{icon}</span>
         <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em]">{title}</p>
      </div>
      <p className="text-2xl font-black tracking-tighter italic leading-none mb-1">{value}</p>
      {subtitle && <p className="text-[9px] font-black uppercase mt-1 opacity-50 tracking-widest">{subtitle}</p>}
    </div>
  );
};

export default Dashboard;
