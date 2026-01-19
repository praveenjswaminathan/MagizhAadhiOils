
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, Sale, SaleLine, ReturnRecord, ReturnType, Hub, Customer } from '../types';
import { getLatestPrice, getNextNo, deleteSale, deleteReturn, getInventoryMetrics } from '../db';

const Sales: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddReturn, setShowAddReturn] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  // Searchable Customer State for Sales
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    targetId: '', 
    docId: '', 
    productId: '',
    qty: 0,
    maxQty: 0,
    unitPrice: 0,
    notes: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return state.customers;
    return state.customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone?.includes(q)
    );
  }, [state.customers, customerSearch]);

  const targetDocs = useMemo(() => {
    if (returnForm.type === ReturnType.CUSTOMER) {
      return state.sales.filter(s => s.customerId === returnForm.targetId).sort((a,b) => (b.saleDate || '').localeCompare(a.saleDate || ''));
    } else {
      return state.consignments.filter(c => c.toHubId === returnForm.targetId).sort((a,b) => (b.receiveDate || '').localeCompare(a.receiveDate || ''));
    }
  }, [returnForm.type, returnForm.targetId, state.sales, state.consignments]);

  const docLines = useMemo(() => {
    if (returnForm.type === ReturnType.CUSTOMER) {
      return state.saleLines.filter(sl => sl.saleId === returnForm.docId);
    } else {
      return state.consignmentLines.filter(cl => cl.consignmentId === returnForm.docId);
    }
  }, [returnForm.type, returnForm.docId, state.saleLines, state.consignmentLines]);

  const resetSaleForm = () => {
    setEditingSaleId(null);
    setCustomerSearch('');
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

  const resetReturnForm = () => {
    setEditingReturnId(null);
    setReturnForm({
      date: new Date().toISOString().split('T')[0],
      type: ReturnType.CUSTOMER,
      targetId: '',
      docId: '',
      productId: '',
      qty: 0,
      maxQty: 0,
      unitPrice: 0,
      notes: ''
    });
  };

  const handleEditSale = (sale: Sale) => {
    if (!isAdmin) return;
    const lines = state.saleLines.filter(sl => sl.saleId === sale.id);
    const cust = state.customers.find(c => c.id === sale.customerId);
    setEditingSaleId(sale.id);
    setCustomerSearch(cust ? `${cust.salutation} ${cust.name}` : '');
    setSaleForm({
      saleNo: sale.saleNo,
      saleDate: sale.saleDate,
      customerId: sale.customerId,
      hubId: sale.hubId,
      reimbursement: sale.reimbursementAmount,
      lines: state.products.map(p => {
        const line = lines.find(l => l.productId === p.id);
        return {
          productId: p.id,
          qtyL: line ? line.qtyL : 0,
          unitPrice: line ? line.unitPrice : getLatestPrice(state, p.id, sale.saleDate)
        };
      })
    });
    setShowAddSale(true);
    setShowAddReturn(false);
  };

  const handleEditReturn = (rec: ReturnRecord) => {
    if (!isAdmin) return;
    setEditingReturnId(rec.id);
    setReturnForm({
      date: rec.date,
      type: rec.type,
      targetId: rec.type === ReturnType.CUSTOMER ? (rec.customerId || '') : (rec.hubId || ''),
      docId: rec.referenceId || '',
      productId: rec.productId,
      qty: rec.qty,
      maxQty: 9999, 
      unitPrice: rec.unitPriceAtReturn,
      notes: rec.notes || ''
    });
    setShowAddReturn(true);
    setShowAddSale(false);
  };

  const handleDeleteSaleBtn = async (id: string) => {
    if (!isAdmin) return;
    const sale = state.sales.find(s => s.id === id);
    if (!window.confirm(`⚠️ DELETE INVOICE: Remove sale "${sale?.saleNo}"?`)) return;
    try {
      const newState = await deleteSale(id, state);
      updateState(() => newState);
    } catch (err) {
      alert("Error deleting sale.");
    }
  };

  const handlePostSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!saleForm.customerId) return alert("Select a customer.");

    const id = editingSaleId || crypto.randomUUID();
    const newSale: Sale = {
      id,
      saleNo: saleForm.saleNo,
      saleDate: saleForm.saleDate,
      hubId: saleForm.hubId,
      customerId: saleForm.customerId,
      reimbursementAmount: Math.max(0, saleForm.reimbursement),
      createdBy: state.currentUser
    };

    const newLines: SaleLine[] = saleForm.lines
      .filter(l => l.qtyL > 0)
      .map(l => ({
        id: `${id}_${l.productId}`,
        saleId: id,
        productId: l.productId,
        qtyL: l.qtyL,
        unitPrice: l.unitPrice
      }));

    if (newLines.length === 0) return alert("Please enter a quantity for at least one product.");

    updateState(prev => ({
      ...prev,
      sales: [...prev.sales.filter(s => s.id !== id), newSale],
      saleLines: [...prev.saleLines.filter(sl => sl.saleId !== id), ...newLines]
    }));

    setShowAddSale(false);
    resetSaleForm();
    setActiveTab('sales');
  };

  const handlePostReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!returnForm.productId || returnForm.qty <= 0) return alert("Select product and valid quantity.");

    const id = editingReturnId || crypto.randomUUID();
    const newReturn: ReturnRecord = {
      id,
      date: returnForm.date,
      type: returnForm.type,
      hubId: returnForm.type === ReturnType.SUPPLIER ? returnForm.targetId : (state.sales.find(s => s.id === returnForm.docId)?.hubId || ''),
      customerId: returnForm.type === ReturnType.CUSTOMER ? returnForm.targetId : undefined,
      referenceId: returnForm.docId,
      productId: returnForm.productId,
      qty: Math.max(0, returnForm.qty),
      unitPriceAtReturn: Math.max(0, returnForm.unitPrice),
      notes: returnForm.notes,
      createdBy: state.currentUser
    };

    updateState(prev => ({
      ...prev,
      returns: [...prev.returns.filter(r => r.id !== id), newReturn]
    }));

    setShowAddReturn(false);
    resetReturnForm();
    setActiveTab('returns');
  };

  const handleDeleteReturnBtn = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this return record?")) return;
    try {
      const newState = await deleteReturn(id, state);
      updateState(() => newState);
    } catch (err) {
      alert("Error deleting return record.");
    }
  };

  if (invoiceSale) return <InvoiceView sale={invoiceSale} state={state} onBack={() => setInvoiceSale(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Commerce Hub</h1>
          <p className="text-slate-500 font-medium text-[10px] uppercase tracking-widest italic leading-none">Order Management & Processing</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button 
              onClick={() => { setShowAddReturn(!showAddReturn); setShowAddSale(false); if(!showAddReturn) resetReturnForm(); }} 
              className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-sm tracking-widest border transition-all ${showAddReturn ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}
            >
              {showAddReturn ? 'Discard Return' : editingReturnId ? 'Editing Return' : 'New Return Entry'}
            </button>
            <button 
              onClick={() => { setShowAddSale(!showAddSale); setShowAddReturn(false); if(!showAddSale) resetSaleForm(); }} 
              className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg tracking-widest transition-all ${showAddSale ? 'bg-slate-800 text-white' : 'bg-emerald-950 text-white'}`}
            >
              {showAddSale ? 'Discard Draft' : editingSaleId ? 'Editing Sale' : '+ New Invoice'}
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 print:hidden">
        <button className={`px-4 py-2 ${activeTab === 'sales' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('sales')}>Sales Invoices</button>
        <button className={`px-4 py-2 ${activeTab === 'returns' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('returns')}>Returns Register</button>
      </div>

      {isAdmin && showAddSale && (
        <form onSubmit={handlePostSale} className="bg-white p-6 rounded-[24px] border-4 border-emerald-50 shadow-2xl space-y-4 print:hidden animate-in slide-in-from-top duration-300">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 italic">{editingSaleId ? 'Update Existing Sale' : 'Register New Sale'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
               <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Sale Date</label>
               <input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={saleForm.saleDate} onChange={e => setSaleForm({ ...saleForm, saleDate: e.target.value })} />
            </div>
            <div className="space-y-1">
               <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Dispatch Hub</label>
               <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={saleForm.hubId} onChange={e => setSaleForm({ ...saleForm, hubId: e.target.value })}>
                 {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name.split(' ')[0]} Hub</option>)}
               </select>
            </div>
            <div className="space-y-1 relative" ref={dropdownRef}>
                <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Search Customer</label>
                <input 
                    type="text"
                    placeholder="Type name or phone..."
                    className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                    value={customerSearch}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }}
                />
                {isCustomerDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 bg-white border-2 mt-1 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto border-emerald-100">
                        {filteredCustomers.map(c => (
                            <button key={c.id} type="button" onClick={() => { setSaleForm({ ...saleForm, customerId: c.id }); setCustomerSearch(`${c.salutation} ${c.name}`); setIsCustomerDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b last:border-b-0 flex flex-col group">
                                <span className="font-black text-slate-800 text-xs group-hover:text-emerald-700">{c.salutation} {c.name}</span>
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{c.phone || 'No Phone'}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {saleForm.lines.map((line, idx) => {
                  const hubStock = getInventoryMetrics(state, saleForm.hubId, line.productId).qty;
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-2xl bg-white shadow-sm hover:border-emerald-200 transition-colors">
                        <div className="flex flex-col min-w-0 pr-2">
                           <span className="text-[11px] font-black truncate text-slate-700">{state.products.find(p => p.id === line.productId)?.name.split(' (')[0]}</span>
                           <span className={`text-[8px] font-black uppercase tracking-widest ${hubStock <= 5 ? 'text-rose-500' : 'text-emerald-600/60'}`}>Hub Stock: {hubStock}L</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <input type="number" step="0.5" className="w-14 border rounded-lg px-2 py-1.5 text-center font-black text-sm" placeholder="0" value={line.qtyL || ''} onChange={e => { const l = [...saleForm.lines]; l[idx].qtyL = Math.max(0, parseFloat(e.target.value) || 0); setSaleForm({...saleForm, lines: l}); }} />
                            <input type="number" className="w-16 border rounded-lg px-2 py-1.5 text-center font-black text-xs text-emerald-700" value={line.unitPrice || ''} onChange={e => { const l = [...saleForm.lines]; l[idx].unitPrice = Math.max(0, parseFloat(e.target.value) || 0); setSaleForm({...saleForm, lines: l}); }} />
                        </div>
                    </div>
                  );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center bg-emerald-950 p-6 rounded-3xl text-white">
             <div><p className="text-[9px] font-black uppercase text-emerald-400">Total Invoice Value</p><p className="text-4xl font-black italic tracking-tighter mt-1">₹{saleForm.lines.reduce((sum, l) => sum + (l.qtyL * l.unitPrice), 0).toLocaleString()}</p></div>
             <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black px-10 py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-xl">
               {editingSaleId ? 'Resync Invoice' : 'Confirm Sale'}
             </button>
          </div>
        </form>
      )}

      {isAdmin && showAddReturn && (
        <form onSubmit={handlePostReturn} className="bg-white p-6 rounded-[24px] border-4 border-rose-50 shadow-2xl space-y-4 print:hidden animate-in slide-in-from-top duration-300">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-rose-800 italic">{editingReturnId ? 'Update Return Record' : 'Record Inventory Return'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Return Date</label>
                <input type="date" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.date} onChange={e => setReturnForm({...returnForm, date: e.target.value})} />
             </div>
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Return Type</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.type} onChange={e => setReturnForm({...returnForm, type: e.target.value as ReturnType, targetId: '', docId: '', productId: '', qty: 0})}>
                  <option value={ReturnType.CUSTOMER}>Customer Return (Sales Credit)</option>
                  <option value={ReturnType.SUPPLIER}>Supplier Return (Stock Adjustment)</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">{returnForm.type === ReturnType.CUSTOMER ? 'Customer' : 'Hub Source'}</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.targetId} onChange={e => setReturnForm({...returnForm, targetId: e.target.value, docId: '', productId: '', qty: 0})}>
                  <option value="">-- Select --</option>
                  {returnForm.type === ReturnType.CUSTOMER ? state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>) : state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Ref Document</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.docId} onChange={e => setReturnForm({...returnForm, docId: e.target.value, productId: '', qty: 0})}>
                  <option value="">-- Select Doc --</option>
                  {targetDocs.map(d => <option key={d.id} value={d.id}>{('saleNo' in d) ? `${d.saleNo} (${d.saleDate})` : `${d.consignmentNo} (${d.receiveDate})`}</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Product</label>
                <select className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.productId} onChange={e => {
                  const line = docLines.find(l => l.productId === e.target.value);
                  setReturnForm({...returnForm, productId: e.target.value, qty: line?.qtyL || 0, maxQty: line?.qtyL || 0, unitPrice: line?.unitPrice || 0});
                }}>
                  <option value="">-- Select --</option>
                  {docLines.map(l => <option key={l.productId} value={l.productId}>{state.products.find(p => p.id === l.productId)?.name.split(' (')[0]} ({l.qtyL}L)</option>)}
                </select>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Return Qty (L)</label>
                <input type="number" step="0.5" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.qty || ''} onChange={e => setReturnForm({...returnForm, qty: parseFloat(e.target.value) || 0})} />
             </div>
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Adj Value/L (₹)</label>
                <input type="number" className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.unitPrice || ''} onChange={e => setReturnForm({...returnForm, unitPrice: parseFloat(e.target.value) || 0})} />
             </div>
             <div className="space-y-1 md:col-span-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Notes</label><input className="w-full border bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold" value={returnForm.notes} onChange={e => setReturnForm({...returnForm, notes: e.target.value})} /></div>
          </div>
          <button type="submit" className="w-full bg-rose-600 text-white font-black py-4 rounded-xl shadow-xl uppercase text-[10px] tracking-widest">{editingReturnId ? 'Resync Return Entry' : 'Execute Return Entry'}</button>
        </form>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden print:hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Invoice</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Basket Details</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sales.sort((a,b) => (b.saleDate || '').localeCompare(a.saleDate || '')).map(s => {
                const basket = state.saleLines
                  .filter(sl => sl.saleId === s.id)
                  .map(sl => {
                    const p = state.products.find(prod => prod.id === sl.productId);
                    return `${sl.qtyL}L ${p?.name.split(' (')[0].split(' ')[0]}`;
                  }).join(', ');

                return (
                  <tr key={s.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4 font-bold text-slate-400 italic text-xs whitespace-nowrap">{s.saleDate}</td>
                    <td className="px-6 py-4 font-black whitespace-nowrap">{s.saleNo}</td>
                    <td className="px-6 py-4 font-black text-slate-800 whitespace-nowrap">{state.customers.find(c => c.id === s.customerId)?.name}</td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-500 line-clamp-2 leading-tight">
                        {basket || <span className="italic text-slate-300">No items recorded</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-lg text-emerald-800">
                      ₹{state.saleLines.filter(sl => sl.saleId === s.id).reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        {isAdmin && <button onClick={() => handleEditSale(s)} className="bg-white border text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-lg">Edit</button>}
                        <button onClick={() => setInvoiceSale(s)} className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-3 py-1.5 rounded-lg">Invoice</button>
                        {isAdmin && <button onClick={() => handleDeleteSaleBtn(s.id)} className="bg-rose-50 text-rose-700 text-[10px] font-black px-3 py-1.5 rounded-lg">Del</button>}
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
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden print:hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400">
              <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Target (Entity)</th><th className="px-6 py-4">Product</th><th className="px-6 py-4 text-center">Volume</th><th className="px-6 py-4 text-right">Adj Value</th><th className="px-6 py-4 text-center">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.returns.sort((a,b) => (b.date || '').localeCompare(a.date || '')).map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-400 italic text-xs">{r.date}</td>
                  <td className="px-6 py-4"><span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${r.type === ReturnType.CUSTOMER ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{r.type === ReturnType.CUSTOMER ? 'Sales' : 'Stock'}</span></td>
                  <td className="px-6 py-4 font-black text-slate-800">{r.type === ReturnType.CUSTOMER ? state.customers.find(c => c.id === r.customerId)?.name : state.hubs.find(h => h.id === r.hubId)?.name}</td>
                  <td className="px-6 py-4 text-slate-600 font-bold">{state.products.find(p => p.id === r.productId)?.name.split(' (')[0]}</td>
                  <td className="px-6 py-4 text-center font-black text-rose-600">{r.qty}L</td>
                  <td className="px-6 py-4 text-right font-black">₹{(r.qty * r.unitPriceAtReturn).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center"><div className="flex gap-2 justify-center">{isAdmin && <button onClick={() => handleEditReturn(r)} className="bg-white border text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-lg">Edit</button>}{isAdmin && <button onClick={() => handleDeleteReturnBtn(r.id)} className="bg-rose-50 text-rose-700 text-[10px] font-black px-3 py-1.5 rounded-lg">Del</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const InvoiceView: React.FC<{ sale: Sale; state: AppState; onBack: () => void }> = ({ sale, state, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const customer = state.customers.find(c => c.id === sale.customerId);
  const lines = state.saleLines.filter(sl => sl.saleId === sale.id && sl.qtyL > 0);
  const total = lines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    const element = document.getElementById('invoice-printable');
    const opt = { margin: 15, filename: `MagizhAadhi_Invoice_${sale.saleNo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    // @ts-ignore
    window.html2pdf().set(opt).from(element).save().then(() => setIsGenerating(false));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center print:hidden"><button onClick={onBack} className="text-emerald-700 font-black uppercase text-[11px] tracking-widest">← Back</button><button onClick={handleDownloadPDF} disabled={isGenerating} className="bg-emerald-950 text-white px-10 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl disabled:opacity-50">{isGenerating ? 'Generating...' : 'Download Invoice PDF'}</button></div>
      <div id="invoice-printable" className="bg-white p-16 rounded-[40px] border shadow-premium print:p-0 print:border-0 print:shadow-none">
        <div className="flex justify-between items-start mb-12 border-b-4 border-emerald-950 pb-10"><div><h1 className="text-5xl font-black text-emerald-900 uppercase italic tracking-tighter leading-none">Magizh Aadhi</h1><p className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mt-3">Authentic Wood-Pressed Oils</p></div><div className="text-right"><h2 className="text-4xl font-black text-slate-100 uppercase leading-none mb-3">Invoice</h2><p className="font-black text-emerald-950 text-2xl tracking-tighter leading-none italic">{sale.saleNo}</p></div></div>
        <div className="grid grid-cols-2 gap-20 mb-12"><div className="space-y-4"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Billed To</p><div className="space-y-1"><p className="font-black text-emerald-950 text-3xl tracking-tighter leading-none">{customer?.salutation} {customer?.name}</p><p className="text-slate-500 font-bold text-lg">{customer?.phone}</p></div></div><div className="text-right space-y-4"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Issue Date</p><p className="text-emerald-950 font-black text-3xl italic tracking-tighter leading-none">{sale.saleDate}</p></div></div>
        <table className="w-full text-left mb-16">
          <thead className="border-b-2 border-emerald-950 text-[11px] font-black uppercase text-slate-500"><tr><th className="py-6 px-4">Item Description</th><th className="py-6 px-4 text-center">Volume</th><th className="py-6 px-4 text-right">Line Total</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{lines.map(sl => (<tr key={sl.id}><td className="py-6 px-4 font-black text-emerald-950 text-xl">{state.products.find(p => p.id === sl.productId)?.name.split(' (')[0]}</td><td className="py-6 px-4 text-center font-black text-slate-800 text-2xl">{sl.qtyL}L</td><td className="py-6 px-4 text-right font-black text-emerald-950 text-2xl">₹{(sl.qtyL * sl.unitPrice).toLocaleString()}</td></tr>))}</tbody>
          <tfoot><tr className="border-t-4 border-emerald-950"><td colSpan={2} className="py-12 text-right font-black uppercase text-[12px] text-slate-400">Total Payable Dues</td><td className="py-12 text-right font-black text-emerald-950 text-6xl italic tracking-tighter leading-none">₹{total.toLocaleString()}</td></tr></tfoot>
        </table>
        <div className="pt-10 border-t border-slate-100 text-[10px] text-slate-300 font-black uppercase tracking-[0.4em] flex justify-between italic"><p>Handcrafted Wellness Sourced from Erode</p><p>© 2025 Magizh Aadhi Oils</p></div>
      </div>
    </div>
  );
};

export default Sales;
