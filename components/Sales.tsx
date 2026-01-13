
import React, { useState, useMemo } from 'react';
import { AppState, Sale, SaleLine, ReturnRecord, ReturnType } from '../types';
import { getLatestPrice, getNextNo, getInventoryMetrics } from '../db';

const Sales: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddReturn, setShowAddReturn] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);

  // Edit states
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);

  // Return Flow States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [returnQty, setReturnQty] = useState(0);

  const initialSaleLines = state.products.map(p => ({
    productId: p.id,
    qtyL: 0,
    unitPrice: getLatestPrice(state, p.id, new Date().toISOString().split('T')[0])
  }));

  const [saleForm, setSaleForm] = useState({
    saleNo: getNextNo(state, 'S'),
    saleDate: new Date().toISOString().split('T')[0],
    customerId: '',
    hubId: state.hubs[0]?.id || '',
    reimbursement: 0,
    lines: initialSaleLines
  });

  const [returnForm, setReturnForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: ReturnType.CUSTOMER,
    hubId: state.hubs[0]?.id || '',
    notes: ''
  });

  const handlePostSale = (e: React.FormEvent) => {
    e.preventDefault();
    const activeLines = saleForm.lines.filter(l => l.qtyL > 0);
    if (!saleForm.customerId || activeLines.length === 0) return alert("Select customer and items.");

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

    const newLines: SaleLine[] = activeLines.map(l => ({
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
    resetSaleForm();
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

  const handleDeleteSale = (saleId: string) => {
    if (!confirm("Are you sure you want to delete this sale? This will also remove the items and adjust stock/receivables.")) return;
    updateState(prev => ({
      ...prev,
      sales: prev.sales.filter(s => s.id !== saleId),
      saleLines: prev.saleLines.filter(sl => sl.saleId !== saleId)
    }));
  };

  const handlePostReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnQty <= 0) return alert("Enter valid quantity");

    let finalPrice = 0;
    let prodId = selectedProductId;
    let saleLineId: string | undefined = undefined;

    if (returnForm.type === ReturnType.CUSTOMER) {
      if (!selectedSaleId || !selectedProductId) return alert("Select Sale and Product");
      const sLine = state.saleLines.find(sl => sl.saleId === selectedSaleId && sl.productId === selectedProductId);
      if (!sLine) return alert("Item not found in this sale");
      
      const alreadyReturned = state.returns
        .filter(r => r.saleLineId === sLine.id && r.id !== editingReturnId)
        .reduce((sum, r) => sum + r.qty, 0);
      
      if (returnQty > (sLine.qtyL - alreadyReturned)) return alert("Cannot return more than what was sold.");
      
      finalPrice = sLine.unitPrice;
      prodId = sLine.productId;
      saleLineId = sLine.id;
    } else {
      finalPrice = getLatestPrice(state, selectedProductId, returnForm.date);
    }

    const id = editingReturnId || crypto.randomUUID();
    const record: ReturnRecord = {
      id,
      date: returnForm.date,
      type: returnForm.type,
      hubId: returnForm.hubId,
      customerId: selectedCustomerId || undefined,
      saleLineId,
      productId: prodId,
      qty: returnQty,
      unitPriceAtReturn: finalPrice,
      createdBy: state.currentUser,
      notes: returnForm.notes
    };

    updateState(prev => ({ 
      ...prev, 
      returns: [...prev.returns.filter(r => r.id !== id), record] 
    }));
    
    setShowAddReturn(false);
    setEditingReturnId(null);
    resetReturnFlow();
  };

  const handleEditReturn = (record: ReturnRecord) => {
    setReturnForm({
      date: record.date,
      type: record.type,
      hubId: record.hubId,
      notes: record.notes || ''
    });
    setSelectedCustomerId(record.customerId || '');
    
    if (record.saleLineId) {
      const sLine = state.saleLines.find(sl => sl.id === record.saleLineId);
      if (sLine) {
        setSelectedSaleId(sLine.saleId);
        setSelectedProductId(sLine.productId);
      }
    } else {
      setSelectedProductId(record.productId);
    }

    setReturnQty(record.qty);
    setEditingReturnId(record.id);
    setShowAddReturn(true);
    setShowAddSale(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteReturn = (returnId: string) => {
    if (!confirm("Remove this return record? Hub stock will be updated.")) return;
    updateState(prev => ({
      ...prev,
      returns: prev.returns.filter(r => r.id !== returnId)
    }));
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

  const resetReturnFlow = () => {
    setSelectedCustomerId('');
    setSelectedSaleId('');
    setSelectedProductId('');
    setReturnQty(0);
    setReturnForm({
      date: new Date().toISOString().split('T')[0],
      type: ReturnType.CUSTOMER,
      hubId: state.hubs[0]?.id || '',
      notes: ''
    });
  };

  const customerSales = useMemo(() => {
    return state.sales.filter(s => s.customerId === selectedCustomerId).sort((a,b) => b.saleDate.localeCompare(a.saleDate));
  }, [state.sales, selectedCustomerId]);

  const saleProducts = useMemo(() => {
    const lines = state.saleLines.filter(sl => sl.saleId === selectedSaleId);
    return state.products.filter(p => lines.some(l => l.productId === p.id));
  }, [state.saleLines, selectedSaleId, state.products]);

  if (invoiceSale) return <InvoiceView sale={invoiceSale} state={state} onBack={() => setInvoiceSale(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase">Sales & Returns</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { 
              setShowAddSale(!showAddSale); 
              setShowAddReturn(false); 
              setEditingSaleId(null);
              resetSaleForm(); 
            }} 
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg"
          >
            {showAddSale && !editingSaleId ? 'Cancel' : '+ New Sale'}
          </button>
          <button 
            onClick={() => { 
              setShowAddReturn(!showAddReturn); 
              setShowAddSale(false); 
              setEditingReturnId(null);
              resetReturnFlow(); 
            }} 
            className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-100 font-black uppercase text-[10px]"
          >
            {showAddReturn && !editingReturnId ? 'Cancel' : 'Record Return'}
          </button>
        </div>
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
        <button className={`px-4 py-2 ${activeTab === 'sales' ? 'border-b-2 border-slate-800 text-slate-800' : ''}`} onClick={() => setActiveTab('sales')}>Sales History</button>
        <button className={`px-4 py-2 ${activeTab === 'returns' ? 'border-b-2 border-slate-800 text-slate-800' : ''}`} onClick={() => setActiveTab('returns')}>Returns Log</button>
      </div>

      {showAddSale && (
        <form onSubmit={handlePostSale} className="bg-white p-6 rounded-3xl border shadow-xl space-y-4">
          <h2 className="text-sm font-black text-emerald-800 uppercase italic">
            {editingSaleId ? `Modify Transaction: ${saleForm.saleNo}` : 'Finalize New Sale'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 mb-1">Date</label>
              <input type="date" className="border rounded-xl px-3 py-2 text-xs" value={saleForm.saleDate} onChange={e => setSaleForm({...saleForm, saleDate: e.target.value})} />
            </div>
            <div className="flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 mb-1">Customer</label>
              <select className="border rounded-xl px-3 py-2 text-xs" value={saleForm.customerId} onChange={e => setSaleForm({...saleForm, customerId: e.target.value})}>
                <option value="">Select Customer</option>
                {state.customers.map(c => <option key={c.id} value={c.id}>{c.salutation} {c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 mb-1">Hub</label>
              <select className="border rounded-xl px-3 py-2 text-xs" value={saleForm.hubId} onChange={e => setSaleForm({...saleForm, hubId: e.target.value})}>
                {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 mb-1">Reimbursement (₹)</label>
              <input type="number" placeholder="Reimb. ₹" className="border rounded-xl px-3 py-2 text-xs" value={saleForm.reimbursement} onChange={e => setSaleForm({...saleForm, reimbursement: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
          <div className="space-y-1">
             {saleForm.lines.map((line, idx) => (
               <div key={idx} className="flex items-center justify-between p-2 border rounded-xl bg-slate-50 text-[10px]">
                  <span className="font-bold">{state.products.find(p => p.id === line.productId)?.name}</span>
                  <div className="flex gap-2">
                    <input type="number" step="0.5" placeholder="L" className="w-16 border rounded px-2 py-1 text-center font-bold" value={line.qtyL || ''} onChange={e => { const l = [...saleForm.lines]; l[idx].qtyL = parseFloat(e.target.value) || 0; setSaleForm({...saleForm, lines: l}); }}/>
                    <input type="number" placeholder="₹" className="w-16 border rounded px-2 py-1 text-center" value={line.unitPrice} onChange={e => { const l = [...saleForm.lines]; l[idx].unitPrice = parseFloat(e.target.value) || 0; setSaleForm({...saleForm, lines: l}); }}/>
                  </div>
               </div>
             ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-grow bg-emerald-700 text-white font-black py-3 rounded-2xl shadow-xl uppercase text-xs">
              {editingSaleId ? 'Update Sale Record' : 'Post Transaction'}
            </button>
            <button type="button" onClick={() => { setEditingSaleId(null); setShowAddSale(false); resetSaleForm(); }} className="px-6 border rounded-2xl font-black uppercase text-[10px]">Cancel</button>
          </div>
        </form>
      )}

      {showAddReturn && (
        <form onSubmit={handlePostReturn} className="bg-white p-6 rounded-3xl border shadow-xl space-y-3">
           <h2 className="text-sm font-black text-rose-800 uppercase italic">
             {editingReturnId ? 'Modify Return Entry' : 'Process Stock Return'}
           </h2>
           <div className="grid grid-cols-2 gap-2">
              <select className="border rounded-xl px-3 py-2 text-xs" value={returnForm.type} onChange={e => { setReturnForm({...returnForm, type: e.target.value as ReturnType}); resetReturnFlow(); }}>
                <option value={ReturnType.CUSTOMER}>Customer Return</option>
                <option value={ReturnType.SUPPLIER}>Supplier Return (Erode)</option>
              </select>
              <input type="date" className="border rounded-xl px-3 py-2 text-xs" value={returnForm.date} onChange={e => setReturnForm({...returnForm, date: e.target.value})} />
           </div>

           {returnForm.type === ReturnType.CUSTOMER ? (
             <>
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded-xl px-3 py-2 text-xs" value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setSelectedSaleId(''); }}>
                  <option value="">1. Choose Customer</option>
                  {state.customers.map(c => <option key={c.id} value={c.id}>{c.salutation} {c.name}</option>)}
                </select>
                <select className="border rounded-xl px-3 py-2 text-xs" value={selectedSaleId} onChange={e => setSelectedSaleId(e.target.value)} disabled={!selectedCustomerId}>
                  <option value="">2. Select Sale</option>
                  {customerSales.map(s => <option key={s.id} value={s.id}>{s.saleNo} ({s.saleDate})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded-xl px-3 py-2 text-xs" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} disabled={!selectedSaleId}>
                  <option value="">3. Item</option>
                  {saleProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" step="0.5" placeholder="Qty to Return" className="border rounded-xl px-3 py-2 text-xs font-black" value={returnQty || ''} onChange={e => setReturnQty(parseFloat(e.target.value) || 0)} />
              </div>
             </>
           ) : (
             <div className="grid grid-cols-3 gap-2">
                <select className="border rounded-xl px-3 py-2 text-xs col-span-1" value={returnForm.hubId} onChange={e => setReturnForm({...returnForm, hubId: e.target.value})}>
                  {state.hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <select className="border rounded-xl px-3 py-2 text-xs col-span-1" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                   <option value="">Select Product</option>
                   {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" placeholder="Qty" className="border rounded-xl px-3 py-2 text-xs" value={returnQty || ''} onChange={e => setReturnQty(parseFloat(e.target.value) || 0)} />
             </div>
           )}
           <textarea 
             placeholder="Reason for return..." 
             className="w-full border rounded-xl px-3 py-2 text-xs h-16"
             value={returnForm.notes}
             onChange={e => setReturnForm({...returnForm, notes: e.target.value})}
           />
           <div className="flex gap-2">
            <button type="submit" className="flex-grow bg-rose-700 text-white font-black py-3 rounded-2xl shadow-xl uppercase text-[10px]">
              {editingReturnId ? 'Save Return Adjustments' : 'Commit Return'}
            </button>
            <button type="button" onClick={() => { setEditingReturnId(null); setShowAddReturn(false); resetReturnFlow(); }} className="px-6 border rounded-2xl font-black uppercase text-[10px]">Cancel</button>
           </div>
        </form>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Sale ID</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2 text-right">Total ₹</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sales.sort((a,b) => b.saleDate.localeCompare(a.saleDate)).map(s => {
                const total = state.saleLines.filter(sl => sl.saleId === s.id).reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);
                const cust = state.customers.find(c => c.id === s.customerId);
                return (
                  <tr key={s.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-2 text-slate-400">{s.saleDate}</td>
                    <td className="px-4 py-2 font-bold text-slate-800">{s.saleNo}</td>
                    <td className="px-4 py-2 font-black">
                      <span className="text-[8px] uppercase block opacity-40 leading-none mb-1">{cust?.salutation}</span>
                      {cust?.name}
                    </td>
                    <td className="px-4 py-2 text-right font-black text-slate-700">₹{total.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setInvoiceSale(s)} className="text-emerald-700 text-[8px] font-black uppercase border border-emerald-100 px-2 py-1 rounded-lg hover:bg-emerald-50">Invoice</button>
                        <button onClick={() => handleEditSale(s)} className="text-blue-700 text-[8px] font-black uppercase border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                        <button onClick={() => handleDeleteSale(s.id)} className="text-rose-600 text-[8px] font-black uppercase border border-rose-100 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
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
        <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
           <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.returns.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-2 text-slate-400">{r.date}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${r.type === ReturnType.CUSTOMER ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {r.type.split(' ')[0]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-black text-slate-700">{state.products.find(p => p.id === r.productId)?.name.split(' (')[0]}</td>
                    <td className="px-4 py-2 text-right font-black">{r.qty} L</td>
                    <td className="px-4 py-2 text-right font-black text-slate-800">₹{(r.qty * r.unitPriceAtReturn).toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEditReturn(r)} className="text-blue-700 text-[8px] font-black uppercase border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                        <button onClick={() => handleDeleteReturn(r.id)} className="text-rose-600 text-[8px] font-black uppercase border border-rose-100 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
                      </div>
                    </td>
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
  const customer = state.customers.find(c => c.id === sale.customerId);
  const hub = state.hubs.find(h => h.id === sale.hubId);
  const lines = state.saleLines.filter(sl => sl.saleId === sale.id);
  const subtotal = lines.reduce((sum, sl) => sum + (sl.qtyL * sl.unitPrice), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <button onClick={onBack} className="text-emerald-700 font-bold uppercase text-[10px]">← Back to Sales</button>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg">Print / Save PDF</button>
      </div>
      
      <div className="bg-white p-8 md:p-12 rounded-[40px] border shadow-2xl print:shadow-none print:border-0 print:p-0">
        <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
           <div>
             <h1 className="text-4xl font-black text-emerald-800 uppercase italic tracking-tighter">Magizh Aadhi Oils</h1>
             <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mt-2">Traditional Cold Pressed Wellness</p>
           </div>
           <div className="text-right">
             <h2 className="text-5xl font-black text-slate-100 uppercase leading-none">Invoice</h2>
             <p className="font-black text-slate-900 text-sm mt-2">{sale.saleNo}</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12 text-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billed To</p>
            <p className="font-black text-slate-800 text-xl tracking-tight">{customer?.salutation} {customer?.name}</p>
            <p className="text-slate-500 font-bold mt-1">{customer?.phone || 'No Contact Provided'}</p>
            <p className="text-slate-400 text-xs mt-2 italic">{customer?.notes}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Details</p>
            <p className="text-slate-800 font-black text-lg">{sale.saleDate}</p>
            <p className="text-slate-500 uppercase font-black text-[10px] tracking-widest mt-1 bg-slate-50 px-3 py-1 rounded-full inline-block border border-slate-100">{hub?.name}</p>
          </div>
        </div>

        <table className="w-full text-left mb-12">
          <thead className="border-b-2 border-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-4 px-2">Description</th>
              <th className="py-4 px-2 text-center">Quantity</th>
              <th className="py-4 px-2 text-right">Unit Rate</th>
              <th className="py-4 px-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map(sl => (
              <tr key={sl.id}>
                <td className="py-6 px-2">
                  <span className="font-black text-slate-800 text-sm">{state.products.find(p => p.id === sl.productId)?.name.split(' (')[0]}</span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase mt-1 italic">Wood Pressed / Marachekku</span>
                </td>
                <td className="py-6 px-2 text-center font-black text-slate-700 text-sm">{sl.qtyL} Liters</td>
                <td className="py-6 px-2 text-right text-slate-500 font-bold">₹{sl.unitPrice.toLocaleString()}</td>
                <td className="py-6 px-2 text-right font-black text-slate-900 text-sm">₹{(sl.qtyL * sl.unitPrice).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-4 border-slate-900">
              <td colSpan={3} className="py-8 text-right font-black uppercase text-xs tracking-widest text-slate-400">Total Payable Amount</td>
              <td className="py-8 text-right font-black text-emerald-800 text-3xl tracking-tighter italic">₹{subtotal.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="pt-8 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex justify-between items-center">
          <p>Handcrafted in Erode • Distributed via {hub?.name}</p>
          <p className="text-slate-800">Magizh Aadhi Oils © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Sales;
