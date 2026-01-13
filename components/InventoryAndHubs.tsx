
import React, { useState, useMemo } from 'react';
import { AppState, Consignment, ConsignmentLine, Hub } from '../types';
import { getInventoryMetrics, getLatestPrice, getNextNo } from '../db';

const InventoryAndHubs: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'hubs' | 'aging' | 'history'>('stock');
  const [showAddHub, setShowAddHub] = useState(false);
  const [showAddConsignment, setShowAddConsignment] = useState(false);
  const [editingHubId, setEditingHubId] = useState<string | null>(null);

  const [hubForm, setHubForm] = useState({ name: '', address: '' });
  const [consForm, setConsForm] = useState({
    consignmentNo: getNextNo(state, 'CON'),
    receiveDate: new Date().toISOString().split('T')[0],
    toHubId: state.hubs[0]?.id || '',
    transportCost: 0,
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

  const totals = useMemo(() => {
    return metrics.reduce((acc, m) => {
      acc.qty += m.all.qty;
      acc.value += m.all.value;
      return acc;
    }, { qty: 0, value: 0 });
  }, [metrics]);

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingHubId || crypto.randomUUID();
    const newHub: Hub = { id, name: hubForm.name, address: hubForm.address };
    updateState(prev => ({ ...prev, hubs: [...prev.hubs.filter(h => h.id !== id), newHub] }));
    setShowAddHub(false);
    setHubForm({ name: '', address: '' });
    setEditingHubId(null);
  };

  const handleSaveConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    const activeLines = consForm.lines.filter(l => l.qtyL > 0);
    if (activeLines.length === 0) return alert("Enter quantities.");

    const id = crypto.randomUUID();
    const newC: Consignment = {
      id,
      consignmentNo: consForm.consignmentNo,
      receiveDate: consForm.receiveDate,
      toHubId: consForm.toHubId,
      transportCost: consForm.transportCost,
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
      consignments: [...prev.consignments, newC],
      consignmentLines: [...prev.consignmentLines, ...newLines]
    }));
    setShowAddConsignment(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase">Resources & Stock</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowAddHub(true)} className="bg-white border px-3 py-1.5 rounded-xl text-[10px] font-black uppercase">Add Hub</button>
           <button onClick={() => setShowAddConsignment(true)} className="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg">+ Receive Stock</button>
        </div>
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
        <button className={`px-4 py-2 ${activeTab === 'stock' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('stock')}>Live Stock Hub-wise</button>
        <button className={`px-4 py-2 ${activeTab === 'hubs' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('hubs')}>Hub Locations</button>
        <button className={`px-4 py-2 ${activeTab === 'aging' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('aging')}>Aging</button>
        <button className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('history')}>History</button>
      </div>

      {showAddHub && (
        <form onSubmit={handleSaveHub} className="bg-white p-6 rounded-2xl border shadow-xl space-y-4">
          <input required placeholder="Hub Name" className="w-full border rounded-xl px-4 py-2 text-sm" value={hubForm.name} onChange={e => setHubForm({...hubForm, name: e.target.value})} />
          <button type="submit" className="w-full bg-emerald-600 text-white font-black py-2 rounded-xl text-xs">Save Hub</button>
        </form>
      )}

      {showAddConsignment && (
        <form onSubmit={handleSaveConsignment} className="bg-white p-6 rounded-2xl border shadow-xl space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="border rounded-xl px-3 py-2 text-xs" value={consForm.receiveDate} onChange={e => setConsForm({...consForm, receiveDate: e.target.value})} />
            <select className="border rounded-xl px-3 py-2 text-xs" value={consForm.toHubId} onChange={e => setConsForm({...consForm, toHubId: e.target.value})}>{state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </div>
          <div className="space-y-1">
             {consForm.lines.map((line, idx) => (
               <div key={idx} className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 text-[10px]">
                  <span className="font-bold">{state.products.find(p => p.id === line.productId)?.name}</span>
                  <div className="flex gap-2">
                    <input type="number" step="0.5" placeholder="L" className="w-16 border rounded px-2 py-1 text-center font-bold" value={line.qtyL || ''} onChange={e => { const l = [...consForm.lines]; l[idx].qtyL = parseFloat(e.target.value) || 0; setConsForm({...consForm, lines: l}); }}/>
                    <input type="number" placeholder="Cost" className="w-16 border rounded px-2 py-1 text-center" value={line.unitPrice} onChange={e => { const l = [...consForm.lines]; l[idx].unitPrice = parseFloat(e.target.value) || 0; setConsForm({...consForm, lines: l}); }}/>
                  </div>
               </div>
             ))}
          </div>
          <button type="submit" className="w-full bg-slate-800 text-white font-black py-3 rounded-xl text-xs">Update Hub Inventory</button>
        </form>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                {state.hubs.map(h => <th key={h.id} className="px-2 py-3 text-center">{h.name}</th>)}
                <th className="px-4 py-3 text-right">Total Qty</th>
                <th className="px-4 py-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold text-slate-700">{m.name}</td>
                  {m.hubs.map(h => (
                    <td key={h.hubId} className="px-2 py-2 text-center">
                      <span className={`font-black ${h.qty < 5 ? 'text-rose-500' : 'text-slate-600'}`}>{h.qty} L</span>
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-black text-emerald-700">{m.all.qty} L</td>
                  <td className="px-4 py-2 text-right font-black text-slate-800">₹{m.all.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-black border-t-2">
              <tr>
                <td className="px-4 py-3 text-slate-500">GRAND TOTAL</td>
                {state.hubs.map(h => <td key={h.id}></td>)}
                <td className="px-4 py-3 text-right text-emerald-800">{totals.qty} L</td>
                <td className="px-4 py-3 text-right text-slate-900">₹{totals.value.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'hubs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {state.hubs.map(hub => (
            <div key={hub.id} className="bg-white p-4 rounded-2xl border shadow-sm relative group">
              <h3 className="font-black text-slate-800 text-sm">{hub.name}</h3>
              <p className="text-[10px] text-slate-400 mt-1">{hub.address || 'Standard Location'}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'aging' && (
         <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-center">Aging</th>
                  <th className="px-4 py-3 text-right">Value (Asset)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-bold">{m.name}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${m.all.ageDays > 45 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.all.ageDays} DAYS
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-black">₹{m.all.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      )}
    </div>
  );
};

export default InventoryAndHubs;
