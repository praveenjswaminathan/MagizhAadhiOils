
import React, { useState, useMemo } from 'react';
import { AppState, Sale, SaleLine, ReturnRecord, ReturnType } from '../types';
import { getLatestPrice, getNextNo } from '../db';
import { supabase } from '../supabase';

const Sales: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddReturn, setShowAddReturn] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  const [saleForm, setSaleForm] = useState({
    saleNo: getNextNo(state, 'S'),
    saleDate: new Date().toISOString().split('T')[0],
    customerId: '',
    hubId: state.hubs[0]?.id || '',
    reimbursement: 0,
    lines: state.products.map(p => ({
      productId: p.id,
      qtyL: 0,
      unitPrice: getLatestPrice(state, p.id, new Date().toISOString().split('T')[0])
    }))
  });

  const [returnForm, setReturnForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: ReturnType.CUSTOMER,
    hubId: state.hubs[0]?.id || '',
    customerId: '',
    selectedSaleId: '',
    productId: '',
    qty: 0,
    notes: ''
  });

  const customerSales = useMemo(() => {
    if (!returnForm.customerId) return [];
    return state.sales.filter(s => s.customerId === returnForm.customerId).sort((a,b) => b.saleDate.localeCompare(a.saleDate));
  }, [state.sales, returnForm.customerId]);

  const saleProducts = useMemo(() => {
    if (!returnForm.selectedSaleId) return [];
    return state.saleLines
      .filter(sl => sl.saleId === returnForm.selectedSaleId && sl.qtyL > 0)
      .map(sl => ({
        productId: sl.productId,
        name: state.products.find(p => p.id === sl.productId)?.name || 'Unknown',
        price: sl.unitPrice,
        maxQty: sl.qtyL,
        saleLineId: sl.id
      }));
  }, [state.saleLines, state.products, returnForm.selectedSaleId]);

  const handlePostSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.customerId) return alert("Select a customer.");

    const id = editingSaleId || crypto.randomUUID();
    const newSale: Sale = {
      id,
      saleNo: saleForm.saleNo,
      saleDate: saleForm.saleDate,
      hubId: saleForm.hubId,
      customerId: saleForm.customerId,
      reimbursementAmount: saleForm.reimbursement,
      createdBy: state.currentUser
    };

    // Use unique UUIDs for lines to avoid format errors in Postgres
    const newLines: SaleLine[] = saleForm.lines
      .filter(l => l.qtyL > 0)
      .map(l => ({
        id: crypto.randomUUID(), 
        saleId: id,
        productId: l.productId,
        qtyL: l.qtyL,
        unitPrice: l.unitPrice
      }));

    updateState(prev => ({
      ...prev,
      sales: [...prev.sales.filter(s => s.id !== id), newSale],
      saleLines: [...prev.saleLines.filter(sl => sl.saleId !== id), ...newLines]
    }));

    setShowAddSale(false);
    setEditingSaleId(null);
    setActiveTab('sales');
    resetSaleForm();
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm("Are you sure? This will delete the sale and all line items permanently.")) return;
    await supabase.from('sale_lines').delete().eq('sale_id', id);
    await supabase.from('sales').delete().eq('id', id);
    updateState(prev => ({
      ...prev,
      sales: prev.sales.filter(s => s.id !== id),
      saleLines: prev.saleLines.filter(sl => sl.saleId !== id)
    }));
  };

  const handlePostReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnForm.qty <= 0) return alert("Quantity must be greater than zero.");
    
    let unitPrice = 0;
    let saleLineId: string | undefined = undefined;

    if (returnForm.type === ReturnType.CUSTOMER) {
      const selected = saleProducts.find(p => p.productId === returnForm.productId);
      if (!selected) return alert("Product selection invalid.");
      unitPrice = selected.price;
      saleLineId = selected.saleLineId;
    } else {
      unitPrice = getLatestPrice(state, returnForm.productId, returnForm.date);
    }

    const id = editingReturnId || crypto.randomUUID();
    const newReturn: ReturnRecord = {
      id,
      date: returnForm.date,
      type: returnForm.type,
      hubId: returnForm.hubId,
      customerId: returnForm.type === ReturnType.CUSTOMER ? returnForm.customerId : undefined,
      productId: returnForm.productId,
      saleLineId: saleLineId,
      qty: returnForm.qty,
      unitPriceAtReturn: unitPrice,
      notes: returnForm.notes,
      createdBy: state.currentUser
    };

    updateState(prev => ({ 
      ...prev, 
      returns: [...prev.returns.filter(r => r.id !== id), newReturn] 
    }));

    setShowAddReturn(false);
    setEditingReturnId(null);
    setActiveTab('returns');
    setReturnForm({ ...returnForm, qty: 0, notes: '', selectedSaleId: '', productId: '' });
  };

  const handleDeleteReturn = async (id: string) => {
    if (!confirm("Are you sure you want to delete this return record?")) return;
    
    const { error } = await supabase.from('returns').delete().eq('id', id);
    
    if (error) {
      console.error("Deletion error:", error);
      return alert("Cloud sync failed. Record might be missing or connection is down.");
    }

    updateState(prev => ({
      ...prev,
      returns: prev.returns.filter(r => r.id !== id)
    }));
  };

  const handleEditReturn = (r: ReturnRecord) => {
    setEditingReturnId(r.id);
    const foundLine = state.saleLines.find(sl => sl.id === r.saleLineId);
    const saleId = foundLine ? foundLine.saleId : '';
    
    setReturnForm({
      date: r.date,
      type: r.type,
      hubId: r.hubId,
      customerId: r.customerId || '',
      selectedSaleId: saleId,
      productId: r.productId,
      qty: r.qty,
      notes: r.notes || ''
    });
    
    setShowAddReturn(true);
    setShowAddSale(false);
    setActiveTab('returns');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetSaleForm = () => {
    setSaleForm({
      saleNo: getNextNo(state, 'S'),
      saleDate: new Date().toISOString().split('T')[0],
      customerId: '',
      hubId: state.hubs[0]?.id || '',
      reimbursement: 0,
      lines: state.products.map(p => ({
        productId: p.id,
        qtyL: 0,
        unitPrice: getLatestPrice(state, p.id, new Date().toISOString().split('T')[0])
      }))
    });
  };

  const handleEditSale = (sale: Sale) => {
    const lines = state.saleLines.filter(sl => sl.saleId === sale.id);
    const populatedLines = state.products.map(p => {
      const existingLine = lines.find(l => l.productId === p.id);
      return {
        productId: p.id,
        qtyL: existingLine ? existingLine.qtyL : 0,
        unitPrice: existingLine ? existingLine.unitPrice : getLatestPrice(state, p.id, sale.saleDate)
      };
    });
    setSaleForm({
      saleNo: sale.saleNo,
      saleDate: sale.saleDate,
      customerId: sale.customerId,
      hubId: sale.hubId,
      reimbursement: sale.reimbursementAmount,
      lines: populatedLines
    });
    setEditingSaleId(sale.id);
    setShowAddSale(true);
    setShowAddReturn(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (invoiceSale) return <InvoiceView sale={invoiceSale} state={state} onBack={() => setInvoiceSale(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Sales & Returns</h1>
          <p className="text-slate-500 font-medium text-[10px] uppercase tracking-widest italic leading-none">Commerce Center</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAddReturn(!showAddReturn); setShowAddSale(false); setEditingReturnId(null); }} className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-sm tracking-widest active:scale-95 border border-rose-100 hover:bg-rose-100 transition-colors">
            {showAddReturn ? 'Cancel' : 'Log Return'}
          </button>
          <button onClick={() => { setShowAddSale(!showAddSale); setShowAddReturn(false); setEditingSaleId(null); resetSaleForm(); }} className="bg-emerald-950 text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg tracking-widest active:scale-95">
            {showAddSale ? 'Discard Form' : '+ Record Sale'}
          </button>
        </div>
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
        <button className={`px-4 py-2 ${activeTab === 'sales' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('sales')}>Sales History</button>
        <button className={`px-4 py-2 ${activeTab === 'returns' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('returns')}>Returns Log</button>
      </div>

      {showAddReturn && (
        <form onSubmit={handlePostReturn} className="bg-white p-6 rounded-[24px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
           <h2 className="text-[11px] font-black text-rose-800 uppercase italic">{editingReturnId ? 'Update Return Record' : 'Log Return Transaction'}</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Return Modality</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.type} onChange={e => setReturnForm({...returnForm, type: e.target.value as ReturnType, customerId: '', selectedSaleId: '', productId: ''})}>
                  <option value={ReturnType.CUSTOMER}>Customer Return (Direct to Manufacturer)</option>
                  <option value={ReturnType.SUPPLIER}>Supplier Return (Hub Stock to Manufacturer)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Hub Location</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.hubId} onChange={e => setReturnForm({...returnForm, hubId: e.target.value})}>
                  {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Date</label>
                <input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.date} onChange={e => setReturnForm({...returnForm, date: e.target.value})} />
              </div>
           </div>
           {returnForm.type === ReturnType.CUSTOMER ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">1. Select Customer</label>
                  <select required className="w-full border bg-white rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.customerId} onChange={e => setReturnForm({...returnForm, customerId: e.target.value, selectedSaleId: '', productId: ''})}>
                    <option value="">-- Choose Client --</option>
                    {state.customers.map(c => <option key={c.id} value={c.id}>{c.salutation} {c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">2. Past Sales</label>
                  <select required disabled={!returnForm.customerId} className="w-full border bg-white rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.selectedSaleId} onChange={e => setReturnForm({...returnForm, selectedSaleId: e.target.value, productId: ''})}>
                    <option value="">-- Choose Invoice --</option>
                    {customerSales.map(s => <option key={s.id} value={s.id}>{s.saleNo} ({s.saleDate})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">3. Select Oil & Qty</label>
                  <div className="flex gap-2">
                    <select required disabled={!returnForm.selectedSaleId} className="flex-grow border bg-white rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.productId} onChange={e => setReturnForm({...returnForm, productId: e.target.value})}>
                      <option value="">-- Choose Item --</option>
                      {saleProducts.map(p => <option key={p.productId} value={p.productId}>{p.name.split(' ')[0]} (₹{p.price})</option>)}
                    </select>
                    <input type="number" step="0.5" className="w-24 border bg-white rounded-xl px-4 py-3 text-sm font-black" value={returnForm.qty || ''} onChange={e => setReturnForm({...returnForm, qty: parseFloat(e.target.value) || 0})} placeholder="L" />
                  </div>
                </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Select Product</label>
                 <select className="w-full border bg-white rounded-xl px-4 py-3 text-sm font-bold" value={returnForm.productId} onChange={e => setReturnForm({...returnForm, productId: e.target.value})}>
                   {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Qty to Deduct (L)</label>
                 <input type="number" step="0.5" className="w-full border bg-white rounded-xl px-4 py-3 text-sm font-black" value={returnForm.qty || ''} onChange={e => setReturnForm({...returnForm, qty: parseFloat(e.target.value) || 0})} placeholder="0.0" />
               </div>
             </div>
           )}
           <div className="flex gap-3 pt-3">
             <button type="submit" className="flex-grow bg-rose-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-[10px] tracking-widest active:scale-[0.98] transition-all">
               {editingReturnId ? 'Update Return Transaction' : 'Record Return Transaction'}
             </button>
             <button type="button" onClick={() => { setShowAddReturn(false); setEditingReturnId(null); }} className="px-12 border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Cancel</button>
           </div>
        </form>
      )}

      {showAddSale && (
        <form onSubmit={handlePostSale} className="bg-white p-6 rounded-[24px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Transaction Date</label>
              <input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={saleForm.saleDate} onChange={e => setSaleForm({...saleForm, saleDate: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Select Client</label>
              <select className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={saleForm.customerId} onChange={e => setSaleForm({...saleForm, customerId: e.target.value})}>
                <option value="">-- Choose Customer --</option>
                {state.customers.map(c => <option key={c.id} value={c.id}>{c.salutation} {c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Inventory Hub</label>
              <select className="w-full border bg-slate-50 rounded-xl px-4 py-3 text-sm font-bold" value={saleForm.hubId} onChange={e => setSaleForm({...saleForm, hubId: e.target.value})}>
                {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
             {saleForm.lines.map((line, idx) => (
               <div key={idx} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white transition-colors">
                  <span className="font-bold text-slate-800 text-xs truncate pr-2 leading-none">{state.products.find(p => p.id === line.productId)?.name.split(' (')[0]}</span>
                  <div className="flex gap-1.5">
                    <input type="number" step="0.5" className="w-16 border rounded-lg px-2 py-1.5 text-center font-black text-emerald-700 text-xs" placeholder="L" value={line.qtyL || ''} onChange={e => { const l = [...saleForm.lines]; l[idx].qtyL = parseFloat(e.target.value) || 0; setSaleForm({...saleForm, lines: l}); }}/>
                    <input type="number" className="w-16 border rounded-lg px-2 py-1.5 text-center font-bold text-slate-400 text-[10px]" placeholder="Rate" value={line.unitPrice} onChange={e => { const l = [...saleForm.lines]; l[idx].unitPrice = parseFloat(e.target.value) || 0; setSaleForm({...saleForm, lines: l}); }}/>
                  </div>
               </div>
             ))}
          </div>
          <div className="flex gap-3 pt-3">
            <button type="submit" className="flex-grow bg-emerald-950 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-widest active:scale-[0.98] transition-all">Commit Sale Entry</button>
            <button type="button" onClick={() => { setShowAddSale(false); setEditingSaleId(null); }} className="px-12 border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Mix Composition</th>
                <th className="px-6 py-4 text-right">Invoice Total</th>
                <th className="px-6 py-4 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sales.sort((a,b) => b.saleDate.localeCompare(a.saleDate)).map(s => {
                const saleLines = state.saleLines.filter(sl => sl.saleId === s.id && sl.qtyL > 0);
                const total = saleLines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
                const cust = state.customers.find(c => c.id === s.customerId);
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 italic">{s.saleDate}</td>
                    <td className="px-6 py-4 font-black text-slate-900 tracking-tighter text-base italic leading-none">{s.saleNo}</td>
                    <td className="px-6 py-4">
                        <span className="font-black text-slate-800 text-sm tracking-tight">
                            {cust ? cust.name : (s.customerId ? `ID: ${s.customerId.slice(0,8)}...` : 'N/A')}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-1">
                          {saleLines.map((sl, i) => (
                            <span key={i} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-emerald-100">
                              {state.products.find(p => p.id === sl.productId)?.name.split(' ')[0]}: {sl.qtyL}L
                            </span>
                          ))}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-lg text-slate-800 tracking-tighter italic leading-none">₹{total.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setInvoiceSale(s)} className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-emerald-200 uppercase active:scale-95">Inv</button>
                        <button onClick={() => handleEditSale(s)} className="bg-slate-100 text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-slate-200 uppercase active:scale-95">Edit</button>
                        <button onClick={() => handleDeleteSale(s.id)} className="bg-rose-100 text-rose-700 text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-rose-200 uppercase active:scale-95">Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4 text-right">Volume</th>
                <th className="px-6 py-4 text-right">Value</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.returns.sort((a,b) => b.date.localeCompare(a.date)).map(r => {
                const cust = state.customers.find(c => c.id === r.customerId);
                const hub = state.hubs.find(h => h.id === r.hubId);
                const prod = state.products.find(p => p.id === r.productId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-400 text-xs italic">{r.date}</td>
                    <td className="px-6 py-4">
                       <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${r.type === ReturnType.CUSTOMER ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                         {r.type === ReturnType.CUSTOMER ? 'CUST' : 'SUPP'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-800 text-xs tracking-tight">
                        {cust ? cust.name : (r.customerId ? `ID: ${r.customerId.slice(0,8)}` : 'Hub Logic')}
                      </p>
                      <p className="text-[9px] text-slate-400 font-black">{hub?.name}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-xs">{prod?.name.split(' (')[0]}</td>
                    <td className="px-6 py-4 text-right font-black">{r.qty}L</td>
                    <td className="px-6 py-4 text-right font-black text-rose-600">₹{(r.qty * r.unitPriceAtReturn).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditReturn(r)} className="bg-slate-100 text-slate-600 text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-slate-200 uppercase active:scale-95">Edit</button>
                        <button onClick={() => handleDeleteReturn(r.id)} className="bg-rose-100 text-rose-700 text-[9px] font-black px-3 py-1.5 rounded-xl hover:bg-rose-200 uppercase active:scale-95">Del</button>
                      </div>
                    </td>
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

const InvoiceView: React.FC<{ sale: Sale; state: AppState; onBack: () => void }> = ({ sale, state, onBack }) => {
  const customer = state.customers.find(c => c.id === sale.customerId);
  const hub = state.hubs.find(h => h.id === sale.hubId);
  const lines = state.saleLines.filter(sl => sl.saleId === sale.id && sl.qtyL > 0);
  const subtotal = lines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center print:hidden px-2">
        <button onClick={onBack} className="text-emerald-700 font-black uppercase text-[10px] tracking-widest hover:underline">← Back</button>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-black text-xs shadow-lg active:scale-95">Print Invoice</button>
      </div>
      <div className="bg-white p-12 rounded-[40px] border shadow-premium print:p-0 print:border-0">
        <div className="flex justify-between items-start mb-10 border-b-4 border-emerald-950 pb-8">
           <div><h1 className="text-4xl font-black text-emerald-900 uppercase italic leading-none">Magizh Aadhi</h1><p className="text-emerald-600 font-black text-[10px] uppercase tracking-[0.4em] mt-3">Authentic Wood-Pressed Wellness</p></div>
           <div className="text-right"><h2 className="text-3xl font-black text-slate-200 uppercase leading-none">Invoice</h2><p className="font-black text-emerald-950 text-lg mt-2 leading-none">{sale.saleNo}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-10 mb-10">
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer</p><p className="font-black text-emerald-950 text-2xl tracking-tight leading-none mb-1">{customer?.salutation} {customer?.name}</p><p className="text-slate-500 font-bold text-base">{customer?.phone}</p></div>
          <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</p><p className="text-emerald-950 font-black text-2xl italic">{sale.saleDate}</p></div>
        </div>
        <table className="w-full text-left mb-10">
          <thead className="border-b-2 border-emerald-950 text-[10px] font-black uppercase text-slate-500"><tr><th className="py-5 px-2">Description</th><th className="py-5 px-2 text-center">Volume</th><th className="py-5 px-2 text-right">Value</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{lines.map(sl => (<tr key={sl.id}><td className="py-5 px-2 font-black text-emerald-950 text-lg">{state.products.find(p => p.id === sl.productId)?.name.split(' (')[0]}</td><td className="py-5 px-2 text-center font-black text-slate-800 text-2xl">{sl.qtyL}L</td><td className="py-5 px-2 text-right font-black text-emerald-950 text-2xl">₹{(sl.qtyL * sl.unitPrice).toLocaleString()}</td></tr>))}</tbody>
          <tfoot><tr className="border-t-4 border-emerald-950"><td colSpan={2} className="py-10 text-right font-black uppercase text-[11px] text-slate-400">Total Payable</td><td className="py-10 text-right font-black text-emerald-950 text-5xl italic leading-none">₹{subtotal.toLocaleString()}</td></tr></tfoot>
        </table>
        <div className="pt-8 border-t border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] flex justify-between italic">
          <p>Handcrafted Wellness Sourced from Erode</p><p className="text-emerald-950">© 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Sales;
