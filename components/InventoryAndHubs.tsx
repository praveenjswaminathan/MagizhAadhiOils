
import React, { useState, useMemo } from 'react';
import { AppState, Consignment, ConsignmentLine, Hub } from '../types';
import { getInventoryMetrics, getLatestPrice, getNextNo, deleteConsignment } from '../db';

const InventoryAndHubs: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'hubs' | 'history'>('stock');
  const [showAddHub, setShowAddHub] = useState(false);
  const [showAddConsignment, setShowAddConsignment] = useState(false);
  const [editingConsId, setEditingConsId] = useState<string | null>(null);
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

  const resetConsForm = () => {
    setEditingConsId(null);
    setConsForm({
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
  };

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const id = editingHubId || crypto.randomUUID();
    const newHub: Hub = { id, name: hubForm.name, address: hubForm.address };
    updateState(prev => ({ ...prev, hubs: [...prev.hubs.filter(h => h.id !== id), newHub] }));
    setShowAddHub(false);
    setEditingHubId(null);
    setHubForm({ name: '', address: '' });
  };

  const handleEditHub = (hub: Hub) => {
    setEditingHubId(hub.id);
    setHubForm({ name: hub.name, address: hub.address || '' });
    setShowAddHub(true);
    setShowAddConsignment(false);
  };

  const handleEditConsignment = (con: Consignment) => {
    if (!isAdmin) return;
    const lines = state.consignmentLines.filter(l => l.consignmentId === con.id);
    setEditingConsId(con.id);
    setConsForm({
      consignmentNo: con.consignmentNo,
      receiveDate: con.receiveDate,
      toHubId: con.toHubId,
      transportCost: con.transportCost,
      lines: state.products.map(p => {
        const line = lines.find(l => l.productId === p.id);
        return {
          productId: p.id,
          qtyL: line ? line.qtyL : 0,
          unitPrice: line ? line.unitPrice : getLatestPrice(state, p.id, con.receiveDate)
        };
      })
    });
    setShowAddConsignment(true);
    setShowAddHub(false);
  };

  const handleDeleteConsignment = async (id: string) => {
    if (!isAdmin) return;
    const con = state.consignments.find(c => c.id === id);
    if (!window.confirm(`⚠️ CAUTION: Delete Batch ${con?.consignmentNo}?`)) return;
    try {
      const newState = await deleteConsignment(id, state);
      updateState(() => newState);
    } catch (err) {
      alert("Error deleting batch.");
    }
  };

  const handleSaveConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const id = editingConsId || crypto.randomUUID();
    
    const activeLines = consForm.lines.filter(l => l.qtyL > 0);
    if (activeLines.length === 0) return alert("Please enter at least one quantity.");

    const newC: Consignment = {
      id,
      consignmentNo: consForm.consignmentNo,
      receiveDate: consForm.receiveDate,
      toHubId: consForm.toHubId,
      transportCost: Math.max(0, consForm.transportCost),
      createdBy: state.currentUser
    };
    
    const newLines: ConsignmentLine[] = activeLines.map(l => ({
        id: `${id}_${l.productId}`, 
        consignmentId: id,
        productId: l.productId,
        qtyL: l.qtyL,
        unitPrice: Math.max(0, l.unitPrice)
      }));

    updateState(prev => ({
        ...prev,
        consignments: [...prev.consignments.filter(c => c.id !== id), newC],
        consignmentLines: [...prev.consignmentLines.filter(l => l.consignmentId !== id), ...newLines]
    }));
    setShowAddConsignment(false);
    resetConsForm();
    setActiveTab('history');
  };

  // Safe sorting: creates a copy using [...] before sorting to avoid mutating state
  const sortedConsignments = useMemo(() => {
    return [...state.consignments].sort((a, b) => (b.receiveDate || '').localeCompare(a.receiveDate || ''));
  }, [state.consignments]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Stock Logistics</h1><p className="text-slate-500 text-[10px] uppercase tracking-widest italic leading-none">Hub Inventory Management</p></div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setShowAddHub(!showAddHub); setShowAddConsignment(false); if(!showAddHub) {setEditingHubId(null); setHubForm({name:'', address:''});} }} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm tracking-widest transition-all ${showAddHub ? 'bg-emerald-100 text-emerald-800' : 'bg-white border text-emerald-900'}`}>
              {showAddHub ? 'Cancel Hub' : '+ New Hub'}
            </button>
            <button onClick={() => { setShowAddConsignment(!showAddConsignment); setShowAddHub(false); if(!showAddConsignment) resetConsForm(); }} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg tracking-widest transition-all ${showAddConsignment ? 'bg-slate-800 text-white' : 'bg-emerald-950 text-white'}`}>
              {showAddConsignment ? 'Discard Batch' : editingConsId ? 'Editing Batch' : '+ Receive Batch'}
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
        <button className={`px-4 py-2 ${activeTab === 'stock' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('stock')}>Live Stock</button>
        <button className={`px-4 py-2 ${activeTab === 'hubs' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('hubs')}>Manage Hubs</button>
        <button className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('history')}>Batch History</button>
      </div>

      {isAdmin && showAddHub && (
        <form onSubmit={handleSaveHub} className="bg-white p-6 rounded-[24px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
           <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 italic">{editingHubId ? 'Update Hub Location' : 'Register New Hub'}</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Hub Name" className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={hubForm.name} onChange={e => setHubForm({...hubForm, name: e.target.value})} />
              <input placeholder="Address" className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={hubForm.address} onChange={e => setHubForm({...hubForm, address: e.target.value})} />
           </div>
           <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-widest">{editingHubId ? 'Update Hub' : 'Initialize Hub'}</button>
        </form>
      )}

      {isAdmin && showAddConsignment && (
        <form onSubmit={handleSaveConsignment} className="bg-white p-6 rounded-[24px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 italic">{editingConsId ? 'Edit Received Batch' : 'Record Received Batch'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold" value={consForm.receiveDate} onChange={e => setConsForm({...consForm, receiveDate: e.target.value})} />
              <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold" value={consForm.toHubId} onChange={e => setConsForm({...consForm, toHubId: e.target.value})}>{state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <input type="number" min="0" placeholder="Transport Cost" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 font-black text-sm" value={consForm.transportCost || ''} onChange={e => setConsForm({...consForm, transportCost: Math.max(0, parseFloat(e.target.value) || 0)})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            {consForm.lines.map((line, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white transition-colors">
                <span className="font-black text-slate-800 text-xs">{state.products.find(p => p.id === line.productId)?.name.split(' (')[0]}</span>
                <div className="flex gap-1.5 shrink-0">
                    <input type="number" step="0.5" className="w-16 border rounded-lg px-2 py-1.5 text-center font-black text-emerald-700 text-xs" placeholder="0" value={line.qtyL || ''} onChange={e => { const l = [...consForm.lines]; l[idx].qtyL = Math.max(0, parseFloat(e.target.value) || 0); setConsForm({...consForm, lines: l}); }} />
                    <input type="number" className="w-16 border rounded-lg px-2 py-1.5 text-center font-bold text-slate-400 text-[10px]" value={line.unitPrice} onChange={e => { const l = [...consForm.lines]; l[idx].unitPrice = Math.max(0, parseFloat(e.target.value) || 0); setConsForm({...consForm, lines: l}); }} />
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-emerald-950 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-widest">{editingConsId ? 'Resync Batch History' : 'Commit Batch To Inventory'}</button>
        </form>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-[24px] shadow-premium border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Product</th>{state.hubs.map(h => <th key={h.id} className="px-4 py-4 text-center">{h.name.split(' ')[0]}</th>)}<th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-right">Asset Val</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{metrics.map(m => (<tr key={m.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4 font-black text-slate-800 text-xs">{m.name.split(' - ')[0]}</td>{m.hubs.map(h => (<td key={h.hubId} className={`px-4 py-4 text-center font-black text-sm ${h.qty < 5 ? 'text-rose-500' : 'text-slate-700'}`}>{h.qty}L</td>))}<td className="px-6 py-4 text-right font-black text-lg text-emerald-700 italic tracking-tighter">{m.all.qty}L</td><td className="px-6 py-4 text-right font-black text-xs text-slate-800 tracking-tight">₹{m.all.value.toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      )}

      {activeTab === 'hubs' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Hub Identity</th><th className="px-6 py-4">Location</th><th className="px-6 py-4 text-center">Manage</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{state.hubs.map(hub => (<tr key={hub.id} className="hover:bg-slate-50 group transition-colors"><td className="px-6 py-4 font-black text-slate-800">{hub.name}</td><td className="px-6 py-4 font-bold text-slate-400 italic text-xs">{hub.address || 'No Address'}</td><td className="px-6 py-4 text-center"><button onClick={() => handleEditHub(hub)} className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg active:scale-95 transition-all">Edit</button></td></tr>))}</tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Hub</th><th className="px-6 py-4 text-center">Volume</th><th className="px-6 py-4 text-center">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{sortedConsignments.map(con => (
                <tr key={con.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-400 italic text-xs">{con.receiveDate}</td>
                    <td className="px-6 py-4 font-black">{con.consignmentNo}</td>
                    <td className="px-6 py-4 font-black text-slate-700">{state.hubs.find(h => h.id === con.toHubId)?.name.split(' ')[0] || 'N/A'}</td>
                    <td className="px-6 py-4 text-center font-black text-emerald-700">{state.consignmentLines.filter(l => l.consignmentId === con.id).reduce((sum, l) => sum + l.qtyL, 0)}L</td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                            {isAdmin && <button onClick={() => handleEditConsignment(con)} className="bg-white border text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-lg">Edit</button>}
                            {isAdmin && <button onClick={() => handleDeleteConsignment(con.id)} className="bg-rose-50 text-rose-700 text-[10px] font-black px-3 py-1.5 rounded-lg">Del</button>}
                        </div>
                    </td>
                </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryAndHubs;
