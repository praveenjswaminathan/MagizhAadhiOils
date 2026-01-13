
import React, { useState, useMemo } from 'react';
import { AppState, Consignment, ConsignmentLine, ReturnRecord, ReturnType } from '../types';
import { getInventoryMetrics, getLatestPrice, getNextNo } from '../db';

const Inventory: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'consignments' | 'aging'>('stock');
  const [showAdd, setShowAdd] = useState(false);
  const [editingConsignment, setEditingConsignment] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    consignmentNo: getNextNo(state, 'CON'),
    receiveDate: new Date().toISOString().split('T')[0],
    toHubId: state.hubs[0]?.id || '',
    transportCost: 0,
    notes: '',
    lines: state.products.map(p => ({
      productId: p.id,
      qtyL: 0,
      unitPrice: getLatestPrice(state, p.id, new Date().toISOString().split('T')[0])
    }))
  });

  const metrics = useMemo(() => {
    return state.products.map(p => ({
      id: p.id,
      name: p.name,
      all: getInventoryMetrics(state, 'all', p.id),
      hubs: state.hubs.map(h => ({ hubId: h.id, hubName: h.name, ...getInventoryMetrics(state, h.id, p.id) }))
    }));
  }, [state]);

  const totalBusinessValuation = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.all.value, 0);
  }, [metrics]);

  const handleSaveConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    const activeLines = formData.lines.filter(l => l.qtyL > 0);
    if (activeLines.length === 0) return alert("Enter quantities.");

    const id = editingConsignment || crypto.randomUUID();
    const newC: Consignment = {
      id,
      consignmentNo: formData.consignmentNo,
      receiveDate: formData.receiveDate,
      toHubId: formData.toHubId,
      transportCost: formData.transportCost,
      notes: formData.notes,
      createdBy: state.currentUser
    };

    const newLines: ConsignmentLine[] = activeLines.map(l => ({
      id: crypto.randomUUID(),
      consignmentId: id,
      productId: l.productId,
      qtyL: l.qtyL,
      unitPrice: l.unitPrice
    }));

    updateState(prev => ({
      ...prev,
      consignments: [...prev.consignments.filter(c => c.id !== id), newC],
      consignmentLines: [...prev.consignmentLines.filter(l => l.consignmentId !== id), ...newLines]
    }));

    setShowAdd(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      consignmentNo: getNextNo(state, 'CON'),
      receiveDate: new Date().toISOString().split('T')[0],
      toHubId: state.hubs[0]?.id || '',
      transportCost: 0,
      notes: '',
      lines: state.products.map(p => ({
        productId: p.id,
        qtyL: 0,
        unitPrice: getLatestPrice(state, p.id, new Date().toISOString().split('T')[0])
      }))
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory & Hub Tracking</h1>
          <p className="text-slate-500 font-medium">Real-time wood-pressed oil levels.</p>
        </div>
        <div className="flex gap-2">
           <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
              <p className="text-[10px] font-black uppercase text-emerald-800 opacity-60">Total Valuation</p>
              <p className="text-xl font-black text-emerald-700">₹{totalBusinessValuation.toLocaleString()}</p>
           </div>
           <button 
              onClick={() => { setShowAdd(!showAdd); setEditingConsignment(null); if(!showAdd) resetForm(); }}
              className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-slate-700 transition-all"
            >
              {showAdd ? 'Cancel' : 'Receive Consignment'}
            </button>
        </div>
      </div>

      <div className="flex border-b text-xs font-black uppercase tracking-widest text-slate-400">
        <button className={`px-6 py-3 ${activeTab === 'stock' ? 'border-b-2 border-slate-800 text-slate-800' : ''}`} onClick={() => setActiveTab('stock')}>Live Stock Hub-wise</button>
        <button className={`px-6 py-3 ${activeTab === 'aging' ? 'border-b-2 border-slate-800 text-slate-800' : ''}`} onClick={() => setActiveTab('aging')}>Aging Analysis</button>
        <button className={`px-6 py-3 ${activeTab === 'consignments' ? 'border-b-2 border-slate-800 text-slate-800' : ''}`} onClick={() => setActiveTab('consignments')}>History</button>
      </div>

      {showAdd && (
        <form onSubmit={handleSaveConsignment} className="bg-white p-6 rounded-2xl border shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase">Batch No</label>
              <input type="text" className="w-full border rounded-lg px-3 py-2 bg-slate-50" value={formData.consignmentNo} readOnly />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase">Receive Date</label>
              <input type="date" required className="w-full border rounded-lg px-3 py-2" value={formData.receiveDate} onChange={e => setFormData({...formData, receiveDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase">Destination Hub</label>
              <select className="w-full border rounded-lg px-3 py-2" value={formData.toHubId} onChange={e => setFormData({...formData, toHubId: e.target.value})}>
                {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase">Transport Cost (₹)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2" value={formData.transportCost} onChange={e => setFormData({...formData, transportCost: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             {formData.lines.map((line, idx) => (
               <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-slate-50">
                  <span className="font-bold text-slate-700 text-xs">{state.products.find(p => p.id === line.productId)?.name}</span>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Liters" step="0.5" className="w-20 border rounded px-2 py-1 font-bold text-center" value={line.qtyL || ''} onChange={e => {
                      const l = [...formData.lines]; l[idx].qtyL = parseFloat(e.target.value) || 0; setFormData({...formData, lines: l});
                    }}/>
                    <input type="number" placeholder="Cost" className="w-20 border rounded px-2 py-1 text-slate-500 text-center" value={line.unitPrice} onChange={e => {
                      const l = [...formData.lines]; l[idx].unitPrice = parseFloat(e.target.value) || 0; setFormData({...formData, lines: l});
                    }}/>
                  </div>
               </div>
             ))}
          </div>
          <button type="submit" className="w-full bg-slate-800 text-white font-black py-4 rounded-xl uppercase tracking-widest hover:bg-black transition-all">Record Consignment & Update Hub Stock</button>
        </form>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Product</th>
                {state.hubs.map(h => <th key={h.id} className="px-6 py-4 text-center">{h.name}</th>)}
                <th className="px-6 py-4 text-right">Total Liters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{m.name}</td>
                  {m.hubs.map(h => (
                    <td key={h.hubId} className={`px-6 py-4 text-center font-black ${h.qty < 5 ? 'text-rose-500' : 'text-slate-600'}`}>
                      {h.qty} L
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right font-black text-emerald-700 text-lg">{m.all.qty} L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'aging' && (
         <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4 text-center">Avg Aging (Days)</th>
                  <th className="px-6 py-4 text-right">Valuation (Cost Basis)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.map(m => (
                  <tr key={m.id}>
                    <td className="px-6 py-4 font-bold text-slate-800">{m.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-black text-[10px] ${m.all.ageDays > 45 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.all.ageDays} DAYS OLD
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-700">₹{m.all.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      )}

      {activeTab === 'consignments' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4 text-right">Transport Cost</th>
                <th className="px-6 py-4 text-right">Total Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.consignments.sort((a,b) => b.receiveDate.localeCompare(a.receiveDate)).map(c => {
                 const qty = state.consignmentLines.filter(l => l.consignmentId === c.id).reduce((s,l) => s + l.qtyL, 0);
                 return (
                  <tr key={c.id}>
                    <td className="px-6 py-4">{c.receiveDate}</td>
                    <td className="px-6 py-4 font-bold">{c.consignmentNo}</td>
                    <td className="px-6 py-4">{state.hubs.find(h => h.id === c.toHubId)?.name}</td>
                    <td className="px-6 py-4 text-right text-slate-500">₹{c.transportCost}</td>
                    <td className="px-6 py-4 text-right font-black">{qty} L</td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Inventory;
