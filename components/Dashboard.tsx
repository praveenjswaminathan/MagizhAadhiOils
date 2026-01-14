import React, { useMemo, useState } from 'react';
import { AppState } from '../types';
import { getInventoryMetrics, calculateOutstanding } from '../db';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [selectedHubId, setSelectedHubId] = useState<'all' | string>('all');

  const stats = useMemo(() => {
    // Total Revenue (Sales)
    const totalRevenue = state.saleLines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
    
    // Total Production / Consignment Value (Total Worth of batches)
    const totalProductionValue = state.consignmentLines.reduce((sum, cl) => sum + (cl.qtyL * cl.unitPrice), 0);
    const totalConsignments = state.consignments.length;

    // Current Dues
    const totalReceivable = state.customers.reduce((sum, c) => {
      const out = calculateOutstanding(state, c.id);
      return sum + (out > 0 ? out : 0);
    }, 0);

    // Current Inventory Assets
    const inventory = state.products.map(p => getInventoryMetrics(state, selectedHubId, p.id));
    const totalStockValue = inventory.reduce((sum, i) => sum + i.value, 0);

    const salesByDate: { [date: string]: number } = {};
    state.sales.forEach(s => {
      const amount = state.saleLines.filter(sl => sl.saleId === s.id).reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
      salesByDate[s.saleDate] = (salesByDate[s.saleDate] || 0) + amount;
    });
    const chartData = Object.keys(salesByDate).sort().map(date => ({ date, amount: salesByDate[date] }));

    return { totalRevenue, totalReceivable, totalStockValue, totalProductionValue, totalConsignments, totalCustomers: state.customers.length, chartData };
  }, [state, selectedHubId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Enterprise Overview</h1>
          <p className="text-slate-500 font-medium text-xs italic leading-none">Live Business Performance Metrics</p>
        </div>
        <select 
          className="bg-white border border-emerald-100 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm outline-none"
          value={selectedHubId}
          onChange={(e) => setSelectedHubId(e.target.value)}
        >
          <option value="all">Consolidated Hubs</option>
          {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon="📈" color="emerald" />
        <StatCard title="Production Value" value={`₹${stats.totalProductionValue.toLocaleString()}`} icon="🏗️" color="blue" subtitle={`${stats.totalConsignments} Batches Received`} />
        <StatCard title="Asset Value" value={`₹${stats.totalStockValue.toLocaleString()}`} icon="📦" color="amber" />
        <StatCard title="Total Dues" value={`₹${stats.totalReceivable.toLocaleString()}`} icon="📉" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[24px] border shadow-premium p-6 space-y-4">
           <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Growth Curve</h2>
           <div className="h-[220px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-emerald-950 rounded-[24px] p-6 text-white relative overflow-hidden shadow-xl">
           <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🌿</div>
           <h2 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-4">System Status</h2>
           <div className="space-y-4">
              <div className="border-l-2 border-emerald-500 pl-3">
                 <p className="text-[8px] font-bold text-slate-400 uppercase">Cloud Link</p>
                 <p className="text-base font-black italic tracking-tighter">Active Sync</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-3">
                 <p className="text-[8px] font-bold text-slate-400 uppercase">Production</p>
                 <p className="text-base font-black italic tracking-tighter">{stats.totalConsignments} Batches Done</p>
              </div>
              <div className="pt-4 border-t border-white/5">
                 <p className="text-lg font-black italic tracking-tighter leading-none">Magizh Aadhi Oils</p>
                 <p className="text-[8px] text-emerald-500 uppercase font-black mt-1">Enterprise Portal v5.0</p>
              </div>
           </div>
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
    <div className={`p-5 rounded-[24px] border shadow-sm ${themes[color]} transition-transform hover:scale-[1.01]`}>
      <div className="flex justify-between items-center mb-3">
         <span className="text-2xl">{icon}</span>
         <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.1em]">{title}</p>
      </div>
      <p className="text-xl font-black tracking-tighter italic leading-none">{value}</p>
      {subtitle && <p className="text-[8px] font-black uppercase mt-1 opacity-60 tracking-widest">{subtitle}</p>}
    </div>
  );
};

export default Dashboard;