
import React, { useMemo, useState, useRef } from 'react';
import { AppState } from '../types';
import { getInventoryMetrics, calculateOutstanding } from '../db';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [selectedHubId, setSelectedHubId] = useState<'all' | string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    // Total Business Volume (Inception to now)
    const totalVolume = state.saleLines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
    
    // Total Outstanding
    const totalReceivable = state.customers.reduce((sum, c) => {
      const out = calculateOutstanding(state, c.id);
      return sum + (out > 0 ? out : 0);
    }, 0);
    
    // Inventory Valuation
    const inventory = state.products.map(p => getInventoryMetrics(state, selectedHubId, p.id));
    const totalStockValue = inventory.reduce((sum, i) => sum + i.value, 0);

    // Sales Chart Data
    const salesByDate: { [date: string]: number } = {};
    state.sales.forEach(s => {
      const amount = state.saleLines.filter(sl => sl.saleId === s.id).reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
      salesByDate[s.saleDate] = (salesByDate[s.saleDate] || 0) + amount;
    });
    const chartData = Object.keys(salesByDate).sort().map(date => ({ date, amount: salesByDate[date] }));

    return { 
      totalVolume, 
      totalReceivable, 
      totalStockValue, 
      totalCustomers: state.customers.length,
      chartData 
    };
  }, [state, selectedHubId]);

  const handleBackup = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Magizh_Oils_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm("Restore this backup? This will overwrite ALL current data.")) {
          updateState(() => json);
          alert("Restore successful!");
        }
      } catch (err) { alert("Invalid backup file."); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Business Overview</h1>
          <p className="text-slate-500 font-medium text-sm">Automated Performance Summary</p>
        </div>
        <select 
          className="bg-white border-2 border-emerald-100 rounded-xl px-4 py-2 text-sm font-bold outline-none shadow-sm"
          value={selectedHubId}
          onChange={(e) => setSelectedHubId(e.target.value)}
        >
          <option value="all">Consolidated Views</option>
          {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Sales Volume" value={`₹${stats.totalVolume.toLocaleString()}`} icon="📈" color="emerald" desc="Lifetime revenue" />
        <StatCard title="Active Stock" value={`₹${stats.totalStockValue.toLocaleString()}`} icon="📦" color="blue" desc="Current hub value" />
        <StatCard title="Dues" value={`₹${stats.totalReceivable.toLocaleString()}`} icon="📉" color="rose" desc="Customer outstanding" />
        <StatCard title="Clients" value={stats.totalCustomers.toString()} icon="👥" color="amber" desc="Total registered" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm p-8 space-y-8">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Revenue Performance</h2>
           <div className="h-[300px] w-full">
             {stats.chartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-300 font-bold italic uppercase text-xs">No sales recorded in the system</div>
             )}
           </div>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">System Events</h2>
           <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
             {[...state.sales, ...state.consignments, ...state.payments, ...state.returns]
               .sort((a: any, b: any) => {
                 const dateA = a.saleDate || a.receiveDate || a.paymentDate || a.date || '';
                 const dateB = b.saleDate || b.receiveDate || b.paymentDate || b.date || '';
                 return dateB.localeCompare(dateA);
               })
               .slice(0, 10)
               .map((item: any) => (
                 <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-hover hover:border-emerald-200">
                    <div className="flex items-center gap-3">
                       <span className="text-lg bg-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                          {item.saleNo ? '💰' : item.consignmentNo ? '📦' : item.amount ? '💳' : '🔄'}
                       </span>
                       <div>
                          <p className="font-black text-slate-800 text-[10px] uppercase">{item.saleNo ? 'Sale' : item.consignmentNo ? 'Batch' : item.amount ? 'Credit' : 'Return'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.saleDate || item.receiveDate || item.paymentDate || item.date}</p>
                       </div>
                    </div>
                    <p className="font-black text-slate-700 text-xs">
                       {item.amount ? `₹${item.amount.toLocaleString()}` : ''}
                       {item.saleNo ? state.customers.find(c => c.id === item.customerId)?.name : ''}
                    </p>
                 </div>
               ))
             }
           </div>
        </div>
      </div>

      <footer className="pt-12 border-t border-slate-200">
        <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🌿</div>
           <div className="relative z-10 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="space-y-4">
                    <h3 className="text-xl font-black uppercase tracking-tight text-emerald-400 italic">Enterprise Cloud Link</h3>
                    <p className="text-slate-400 text-sm font-medium">Your data is secured with Supabase Cloud Auth. All changes are encrypted and synchronized instantly.</p>
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-300 italic">Maintenance</h3>
                    <p className="text-slate-400 text-sm font-medium">Local backup and restore options for redundant security.</p>
                    <div className="flex gap-4">
                       <button onClick={handleBackup} className="bg-slate-800 hover:bg-slate-700 px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-colors tracking-widest">Download .JSON</button>
                       <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-colors tracking-widest">Upload .JSON</button>
                       <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />
                    </div>
                 </div>
              </div>
              <div className="pt-8 border-t border-slate-800 flex justify-between items-end">
                 <div>
                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em] mb-1">Business Engine</p>
                    <h4 className="text-3xl font-black italic uppercase tracking-tighter">Magizh Aadhi Oils</h4>
                 </div>
                 <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Supabase Cloud Edition v3.5</p>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: string; color: string; desc: string }> = ({ title, value, icon, color, desc }) => {
  const themes: any = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700'
  };
  return (
    <div className={`p-8 rounded-[32px] border shadow-sm ${themes[color]}`}>
      <div className="flex justify-between items-start mb-4">
         <span className="text-3xl bg-white/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm">{icon}</span>
      </div>
      <div>
         <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.1em] mb-1">{title}</p>
         <p className="text-3xl font-black tracking-tighter mb-1">{value}</p>
         <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{desc}</p>
      </div>
    </div>
  );
};

export default Dashboard;
