import React, { useState, useMemo } from 'react';
import { AppState, Consignment, ConsignmentLine, Hub } from '../types';
import { getInventoryMetrics, getLatestPrice, getNextNo } from '../db';
import { supabase } from '../supabase';

const InventoryAndHubs: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'hubs' | 'history'>('stock');
  const [showAddHub, setShowAddHub] = useState(false);
  const [showAddConsignment, setShowAddConsignment] = useState(false);
  const [editingConsId, setEditingConsId] = useState<string | null>(null);

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

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    const newHub: Hub = { id, name: hubForm.name, address: hubForm.address };
    updateState(prev => ({ ...prev, hubs: [...prev.hubs, newHub] }));
    setShowAddHub(false);
    setHubForm({ name: '', address: '' });
  };

  const handleSaveConsignment = (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingConsId || crypto.randomUUID();
    const newC: Consignment = {
      id,
      consignmentNo: consForm.consignmentNo,
      receiveDate: consForm.receiveDate,
      toHubId: consForm.toHubId,
      transportCost: consForm.transportCost,
      createdBy: state.currentUser
    };
    
    const newLines: ConsignmentLine[] = consForm.lines
      .filter(l => l.qtyL > 0)
      .map(l => ({
        id: `${id}-${l.productId}`, 
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
    setShowAddConsignment(false);
    setEditingConsId(null);
  };

  const handleDeleteConsignment = async (id: string) => {
    if (!confirm("Are you sure? This will remove this batch permanently.")) return;
    await supabase.from('consignment_lines').delete().eq('consignment_id', id);
    await supabase.from('consignments').delete().eq('id', id);
    updateState(prev => ({
      ...prev,
      consignments: prev.consignments.filter(c => c.id !== id),
      consignmentLines: prev.consignmentLines.filter(cl => cl.consignmentId !== id)
    }));
  };

  const handleEditConsignment = (c: Consignment) => {
    const lines = state.consignmentLines.filter(cl => cl.consignmentId === c.id);
    const populatedLines = state.products.map(p => {
      const existingLine = lines.find(l => l.productId === p.id);
      return {
        productId: p.id,
        qtyL: existingLine ? existingLine.qtyL : 0,
        unitPrice: existingLine ? existingLine.unitPrice : getLatestPrice(state, p.id, c.receiveDate)
      };
    });
    setConsForm({
      consignmentNo: c.consignmentNo,
      receiveDate: c.receiveDate,
      toHubId: c.toHubId,
      transportCost: c.transportCost,
      lines: populatedLines
    });
    setEditingConsId(c.id);
    setShowAddConsignment(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBatchSummary = (consId: string) => {
    const lines = state.consignmentLines.filter(cl => cl.consignmentId === consId && cl.qtyL > 0);
    return lines.map(l => {
      const p = state.products.find(prod => prod.id === l.productId);
      return `${p?.name.split(' ')[0]}: ${l.qtyL}L`;
    }).join(', ') || 'No items';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Stock Logistics</h1><p className="text-slate-500 text-[10px] uppercase tracking-widest italic leading-none">Hub Inventory Management</p></div>
        <div className="flex gap-2">
           <button onClick={() => { setShowAddHub(!showAddHub); setShowAddConsignment(false); }} className="bg-white border text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm">Hubs</button>
           <button onClick={() => { setShowAddConsignment(!showAddConsignment); setShowAddHub(false); setEditingConsId(null); }} className="bg-emerald-950 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest active:scale-95">
             {showAddConsignment ? 'Discard' : '+ Receive Batch'}
           </button>
        </div>
      </div>
      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
        <button className={`px-4 py-2 ${activeTab === 'stock' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('stock')}>Live Stock</button>
        <button className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('history')}>Batch History</button>
        <button className={`px-4 py-2 ${activeTab === 'hubs' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('hubs')}>Manage Hubs</button>
      </div>
      {(showAddHub || showAddConsignment) && (
        <div className="bg-white p-6 rounded-[24px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
           {showAddHub && (
             <form onSubmit={handleSaveHub} className="space-y-4"><h2 className="text-[10px] font-black text-emerald-800 uppercase italic">Add Hub</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input required placeholder="Hub Name" className="border bg-slate-50 rounded-xl px-4 py-3 font-bold text-sm" value={hubForm.name} onChange={e => setHubForm({...hubForm, name: e.target.value})} /><input placeholder="Address" className="border bg-slate-50 rounded-xl px-4 py-3 font-bold text-sm" value={hubForm.address} onChange={e => setHubForm({...hubForm, address: e.target.value})} /></div><div className="flex gap-2"><button type="submit" className="flex-grow bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] uppercase shadow-lg">Register</button><button type="button" onClick={() => setShowAddHub(false)} className="px-10 border rounded-xl text-[10px] font-black uppercase">Cancel</button></div></form>
           )}
           {showAddConsignment && (
             <form onSubmit={handleSaveConsignment} className="space-y-4"><h2 className="text-[11px] font-black text-emerald-800 uppercase italic">Consignment Batch</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</label><input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold" value={consForm.receiveDate} onChange={e => setConsForm({...consForm, receiveDate: e.target.value})} /></div><div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hub</label><select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold" value={consForm.toHubId} onChange={e => setConsForm({...consForm, toHubId: e.target.value})}>{state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div><div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cost (₹)</label><input type="number" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 font-black text-sm" value={consForm.transportCost || ''} onChange={e => setConsForm({...consForm, transportCost: parseFloat(e.target.value) || 0})} /></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">{consForm.lines.map((line, idx) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-slate-50/50"><span className="font-bold text-slate-700 text-xs">{state.products.find(p => p.id === line.productId)?.name.split(' (')[0]}</span><div className="flex gap-1.5"><input type="number" step="0.5" className="w-16 border rounded-lg px-2 py-1.5 text-center font-black text-emerald-700 text-xs" value={line.qtyL || ''} onChange={e => { const l = [...consForm.lines]; l[idx].qtyL = parseFloat(e.target.value) || 0; setConsForm({...consForm, lines: l}); }} /><input type="number" className="w-16 border rounded-lg px-2 py-1.5 text-center font-bold text-slate-400 text-[10px]" value={line.unitPrice} onChange={e => { const l = [...consForm.lines]; l[idx].unitPrice = parseFloat(e.target.value) || 0; setConsForm({...consForm, lines: l}); }} /></div></div>))}</div><div className="flex gap-3 pt-3"><button type="submit" className="flex-grow bg-emerald-950 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-widest active:scale-[0.98]">Commit Batch</button><button type="button" onClick={() => { setShowAddConsignment(false); setEditingConsId(null); }} className="px-12 border rounded-xl text-[10px] font-black uppercase">Cancel</button></div></form>
           )}
        </div>
      )}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-[24px] shadow-premium border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Product</th>{state.hubs.map(h => <th key={h.id} className="px-4 py-4 text-center">{h.name.split(' ')[0]}</th>)}<th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-right">Value</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{metrics.map(m => (<tr key={m.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4"><p className="font-black text-slate-800 text-sm leading-none">{m.name.split(' (')[0]}</p></td>{m.hubs.map(h => (<td key={h.hubId} className={`px-4 py-4 text-center font-black text-sm ${h.qty < 5 ? 'text-rose-500 animate-pulse' : 'text-slate-700'}`}>{h.qty}L</td>))}<td className="px-6 py-4 text-right font-black text-lg text-emerald-700 italic">{m.all.qty}L</td><td className="px-6 py-4 text-right font-black text-xs text-slate-800">₹{m.all.value.toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {activeTab === 'history' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Batch ID</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Mix Summary</th><th className="px-6 py-4 text-right">Volume</th><th className="px-6 py-4 text-center">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{state.consignments.sort((a,b) => b.receiveDate.localeCompare(a.receiveDate)).map(c => { const lines = state.consignmentLines.filter(l => l.consignmentId === c.id); const totalQty = lines.reduce((s,l) => s + l.qtyL, 0); return (<tr key={c.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4 font-black italic">{c.consignmentNo}</td><td className="px-6 py-4 font-bold text-slate-400 text-xs">{c.receiveDate}</td><td className="px-6 py-4 text-[10px] font-bold text-slate-400 italic truncate max-w-xs">{getBatchSummary(c.id)}</td><td className="px-6 py-4 text-right font-black text-emerald-800">{totalQty}L</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEditConsignment(c)} className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-4 py-2 rounded-xl active:scale-95">Edit</button><button onClick={() => handleDeleteConsignment(c.id)} className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-4 py-2 rounded-xl active:scale-95">Del</button></div></td></tr>); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryAndHubs;