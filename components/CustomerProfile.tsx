import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppState, ReturnType, Payment } from '../types';
import { calculateOutstanding } from '../db';
import { supabase } from '../supabase';

const CustomerProfile: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'statement' | 'payments'>('statement');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const customer = state.customers.find(c => c.id === id);

  const ledger = useMemo(() => {
    if (!customer) return [];
    const activities: any[] = [];

    // Sales Lines
    state.sales.filter(s => s.customerId === id).forEach(s => {
      state.saleLines.filter(sl => sl.saleId === s.id && sl.qtyL > 0).forEach(sl => {
        activities.push({
          date: s.saleDate,
          type: 'Purchase',
          detail: state.products.find(p => p.id === sl.productId)?.name.split(' (')[0],
          qty: sl.qtyL,
          unitPrice: sl.unitPrice,
          debit: sl.qtyL * sl.unitPrice,
          credit: 0
        });
      });
    });

    // Payments
    state.payments.filter(p => p.customerId === id).forEach(p => {
      activities.push({
        date: p.paymentDate,
        type: 'Payment',
        detail: `${p.mode} ${p.reference ? `(#${p.reference})` : ''}`,
        qty: null,
        unitPrice: null,
        debit: 0,
        credit: p.amount
      });
    });

    // Returns (Customer returns only)
    state.returns.filter(r => r.customerId === id && r.type === ReturnType.CUSTOMER && r.qty > 0).forEach(r => {
      activities.push({
        date: r.date,
        type: 'Return',
        detail: `Returned: ${state.products.find(p => p.id === r.productId)?.name.split(' (')[0]}`,
        qty: r.qty,
        unitPrice: r.unitPriceAtReturn,
        debit: 0,
        credit: r.qty * r.unitPriceAtReturn
      });
    });

    const sorted = activities.sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    
    return sorted
      .map(item => {
        balance = balance + item.debit - item.credit;
        return { ...item, balance };
      })
      .filter(item => item.debit !== 0 || item.credit !== 0) 
      .reverse(); 
  }, [state, id, state.sales, state.saleLines, state.payments, state.returns]);

  const stats = useMemo(() => {
    if (!customer) return { balance: 0 };
    return { balance: calculateOutstanding(state, customer.id) };
  }, [state, id]);

  const handleUpdatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    updateState(prev => ({
      ...prev,
      payments: prev.payments.map(p => p.id === editingPayment.id ? editingPayment : p)
    }));
    setEditingPayment(null);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm("Delete this payment record? Customer dues will increase.")) return;
    
    // Explicitly delete from Supabase
    await supabase.from('payments').delete().eq('id', paymentId);

    updateState(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== paymentId)
    }));
  };

  if (!customer) return <div className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">Customer Record Missing</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4 print:hidden">
        <div>
          <Link to="/customers" className="text-emerald-700 text-[9px] font-black uppercase tracking-widest mb-2 block hover:translate-x-1 transition-transform">← Back to Directory</Link>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic leading-none">{customer.salutation} {customer.name}</h1>
          <p className="text-slate-500 font-bold text-xs mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">{customer.phone || 'No Contact Number'}</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-white border px-6 py-4 rounded-2xl text-right shadow-sm border-emerald-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
              <p className={`text-2xl font-black italic tracking-tighter ${stats.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                ₹{stats.balance.toLocaleString()}
              </p>
            </div>
        </div>
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 print:hidden">
        <button className={`px-6 py-3 ${activeTab === 'statement' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('statement')}>Customer Statement</button>
        <button className={`px-6 py-3 ${activeTab === 'payments' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('payments')}>Payment Log</button>
      </div>

      {activeTab === 'statement' && (
        <div className="bg-white rounded-[32px] shadow-premium border overflow-hidden print:shadow-none print:border-none">
          <div className="bg-slate-50 px-8 py-4 border-b flex justify-between items-center print:hidden">
            <div>
              <h2 className="font-black text-slate-400 uppercase text-[9px] tracking-widest">Transaction Ledger</h2>
              <p className="text-[8px] text-slate-400 font-bold uppercase italic mt-0.5">Filter: Active Transactions Only</p>
            </div>
            <button 
              onClick={() => window.print()} 
              className="bg-emerald-950 text-white rounded-xl px-5 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-black shadow-lg active:scale-95 transition-all"
            >
              Generate Statement PDF
            </button>
          </div>
          
          <div className="overflow-x-auto print:overflow-visible">
            <div className="hidden print:block p-8 border-b-2 border-black mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Magizh Aadhi Oils</h1>
                        <p className="text-[10px] font-black tracking-[0.3em] uppercase mt-2">Authentic Wood-Pressed Wellness</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Statement of Account</h2>
                        <p className="text-lg font-black mt-1 leading-none">{customer.salutation} {customer.name}</p>
                        <p className="text-[10px] font-bold mt-1">{customer.phone}</p>
                    </div>
                </div>
            </div>

            <table className="w-full text-left print:text-xs">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b tracking-widest print:bg-slate-100">
                <tr>
                  <th className="px-8 py-5 print:px-2">Date</th>
                  <th className="px-8 py-5 print:px-2">Detail</th>
                  <th className="px-4 py-5 text-center print:px-2">Volume (L)</th>
                  <th className="px-4 py-5 text-right print:px-2">Rate (₹)</th>
                  <th className="px-8 py-5 text-right print:px-2">Debit (+)</th>
                  <th className="px-8 py-5 text-right print:px-2">Credit (-)</th>
                  <th className="px-8 py-5 text-right bg-slate-100/50 print:px-2 print:bg-white">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {ledger.map((item, idx) => (
                  <tr key={idx} className={`${item.type === 'Payment' ? 'bg-emerald-50/20' : ''} hover:bg-slate-50 transition-colors print:hover:bg-transparent`}>
                    <td className="px-8 py-4 font-bold text-slate-400 text-xs italic print:px-2 print:text-[10px]">{item.date}</td>
                    <td className="px-8 py-4 print:px-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border shadow-sm print:shadow-none ${
                          item.type === 'Purchase' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                          item.type === 'Payment' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                          'bg-rose-50 border-rose-100 text-rose-600'
                        }`}>{item.type}</span>
                        <span className="font-black text-slate-700 text-sm tracking-tight print:text-xs">{item.detail}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-slate-600 text-sm print:px-2 print:text-xs">{item.qty ? `${item.qty}L` : '-'}</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-400 text-xs print:px-2 print:text-[10px]">{item.unitPrice ? `₹${item.unitPrice}` : '-'}</td>
                    <td className="px-8 py-4 text-right font-black text-slate-800 print:px-2 print:text-xs">
                      {item.debit > 0 ? `₹${item.debit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-8 py-4 text-right font-black text-emerald-700 print:px-2 print:text-xs">
                      {item.credit > 0 ? `₹${item.credit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-8 py-4 text-right font-black text-slate-900 bg-slate-50/30 italic tracking-tighter print:px-2 print:bg-white print:text-xs">
                      ₹{item.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-8 bg-slate-900 text-white flex justify-between items-center print:bg-white print:text-black print:border-t-4 print:border-black print:p-4 print:mt-4">
             <div className="hidden print:block">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Handcrafted Sourced from Erode</p>
                <p className="text-[8px] font-bold uppercase mt-1">Computer Generated Statement - No signature required.</p>
             </div>
             <div className="text-right flex-grow">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1 print:opacity-100">Total Net Balance Due</p>
                <p className="text-4xl font-black italic tracking-tighter print:text-2xl">₹{stats.balance.toLocaleString()}</p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          {editingPayment && (
            <form onSubmit={handleUpdatePayment} className="bg-amber-50 p-6 rounded-[24px] border border-amber-200 shadow-xl space-y-4 animate-in zoom-in duration-200">
               <h3 className="text-sm font-black text-amber-800 uppercase italic">Update Payment Details</h3>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Date</label>
                   <input type="date" className="w-full border rounded-xl px-4 py-2 text-sm font-bold" value={editingPayment.paymentDate} onChange={e => setEditingPayment({...editingPayment, paymentDate: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Amount (₹)</label>
                   <input type="number" className="w-full border rounded-xl px-4 py-2 text-sm font-black" value={editingPayment.amount} onChange={e => setEditingPayment({...editingPayment, amount: parseFloat(e.target.value) || 0})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Mode</label>
                   <select className="w-full border rounded-xl px-4 py-2 text-sm font-bold" value={editingPayment.mode} onChange={e => setEditingPayment({...editingPayment, mode: e.target.value})}>
                      <option>GPay</option>
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Cheque</option>
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Ref ID</label>
                   <input type="text" placeholder="Transaction #" className="w-full border rounded-xl px-4 py-2 text-sm font-bold" value={editingPayment.reference || ''} onChange={e => setEditingPayment({...editingPayment, reference: e.target.value})} />
                 </div>
               </div>
               <div className="flex gap-2">
                 <button type="submit" className="bg-amber-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Save Update</button>
                 <button type="button" onClick={() => setEditingPayment(null)} className="px-6 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest">Discard</button>
               </div>
            </form>
          )}

          <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Amount</th>
                  <th className="px-8 py-5 text-center">Mode</th>
                  <th className="px-8 py-5">Reference ID</th>
                  <th className="px-8 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.payments.filter(p => p.customerId === id).sort((a,b) => b.paymentDate.localeCompare(a.paymentDate)).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4 font-bold text-slate-400 italic">{p.paymentDate}</td>
                    <td className="px-8 py-4 font-black text-emerald-700 text-lg italic tracking-tighter leading-none">₹{p.amount.toLocaleString()}</td>
                    <td className="px-8 py-4 text-center">
                       <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-3 py-1 rounded-lg tracking-widest">{p.mode}</span>
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-400 text-xs truncate max-w-[150px]">{p.reference || <span className="italic opacity-30">No ID</span>}</td>
                    <td className="px-8 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setEditingPayment(p)} className="text-slate-400 hover:text-emerald-600 p-2 transition-colors">
                          <span className="text-xs uppercase font-black">Edit</span>
                        </button>
                        <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-600 p-2 transition-colors">
                          <span className="text-xs uppercase font-black">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {state.payments.filter(p => p.customerId === id).length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-20 text-center font-black text-slate-200 uppercase tracking-widest">No payment records found</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          #root header, #root nav, .print\\:hidden { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .max-w-6xl { max-width: 100% !important; }
          .bg-slate-900 { background: white !important; color: black !important; }
          .bg-slate-50 { background: white !important; }
          .shadow-premium { box-shadow: none !important; border: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
          th, td { border: 1px solid #000 !important; padding: 8px 4px !important; }
          th { background: #eee !important; color: #000 !important; font-weight: bold !important; }
        }
      `}</style>
    </div>
  );
};

export default CustomerProfile;