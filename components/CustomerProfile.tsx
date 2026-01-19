
import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppState, ReturnType, Payment } from '../types';
import { calculateOutstanding, deletePayment } from '../db';

const CustomerProfile: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'statement' | 'payments'>('statement');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const customer = state.customers.find(c => c.id === id);

  const ledger = useMemo(() => {
    if (!customer) return [];
    const activities: any[] = [];

    state.sales.filter(s => s.customerId === id).forEach(s => {
      state.saleLines.filter(sl => sl.saleId === s.id && sl.qtyL > 0).forEach(sl => {
        activities.push({
          date: s.saleDate || 'N/A',
          type: 'Purchase',
          detail: state.products.find(p => p.id === sl.productId)?.name.split(' (')[0],
          qty: sl.qtyL,
          unitPrice: sl.unitPrice,
          debit: sl.qtyL * sl.unitPrice,
          credit: 0
        });
      });
    });

    state.payments.filter(p => p.customerId === id).forEach(p => {
      if (p.type === 'REFUND') {
        activities.push({
          date: p.paymentDate || 'N/A',
          type: 'Refund',
          detail: `Outward Refund (${p.mode})`,
          qty: null,
          unitPrice: null,
          debit: p.amount,
          credit: 0
        });
      } else {
        activities.push({
          date: p.paymentDate || 'N/A',
          type: 'Payment',
          detail: `Inward Payment (${p.mode}) ${p.reference ? `(#${p.reference})` : ''}`,
          qty: null,
          unitPrice: null,
          debit: 0,
          credit: p.amount
        });
      }
    });

    state.returns.filter(r => r.customerId === id && r.type === ReturnType.CUSTOMER && r.qty > 0).forEach(r => {
      activities.push({
        date: r.date || 'N/A',
        type: 'Return',
        detail: `Returned: ${state.products.find(p => p.id === r.productId)?.name.split(' (')[0]}`,
        qty: r.qty,
        unitPrice: r.unitPriceAtReturn,
        debit: 0,
        credit: r.qty * r.unitPriceAtReturn
      });
    });

    const sorted = activities.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let balance = 0;
    
    return sorted
      .map(item => {
        balance = balance + item.debit - item.credit;
        return { ...item, balance };
      })
      .filter(item => item.debit !== 0 || item.credit !== 0) 
      .reverse(); 
  }, [state, id]);

  const stats = useMemo(() => {
    if (!customer) return { balance: 0 };
    return { balance: calculateOutstanding(state, customer.id) };
  }, [state, id]);

  const handleUpdatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingPayment) return;
    updateState(prev => ({
      ...prev,
      payments: prev.payments.map(p => p.id === editingPayment.id ? editingPayment : p)
    }));
    setEditingPayment(null);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!isAdmin) return;
    const pay = state.payments.find(p => p.id === paymentId);
    if (!window.confirm(`⚠️ CAUTION: Delete payment/refund of ₹${pay?.amount}?\n\nThis will adjust the customer's outstanding balance. This action cannot be retrieved once confirmed.`)) return;
    
    try {
      const newState = await deletePayment(paymentId, state);
      updateState(() => newState);
    } catch (err) {
      alert("Error deleting record.");
    }
  };

  if (!customer) return <div className="p-20 text-center">Customer Record Missing</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {isAdmin && editingPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <form onSubmit={handleUpdatePayment} className="bg-white p-10 rounded-[40px] shadow-2xl max-w-lg w-full space-y-4">
                <h3 className="text-xl font-black italic tracking-tighter">Edit Money Entry</h3>
                <div className="space-y-4">
                    <input type="date" className="w-full border rounded-xl px-4 py-3" value={editingPayment.paymentDate} onChange={e => setEditingPayment({...editingPayment, paymentDate: e.target.value})} />
                    <input type="number" className="w-full border rounded-xl px-4 py-3 font-black" value={editingPayment.amount} onChange={e => setEditingPayment({...editingPayment, amount: parseFloat(e.target.value) || 0})} />
                    <select className="w-full border rounded-xl px-4 py-3" value={editingPayment.mode} onChange={e => setEditingPayment({...editingPayment, mode: e.target.value})}>
                        <option value="GPay">GPay</option>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button type="submit" className="flex-grow bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Update Record</button>
                    <button type="button" onClick={() => setEditingPayment(null)} className="px-6 border rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                </div>
            </form>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4 print:hidden">
        <div>
          <Link to="/customers" className="text-emerald-700 text-[9px] font-black uppercase tracking-widest mb-2 block">← Back to Clients</Link>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic leading-none">{customer.salutation} {customer.name}</h1>
          <p className="text-slate-500 font-bold text-xs mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">{customer.phone}</p>
        </div>
        <div className="bg-white border px-6 py-4 rounded-2xl text-right shadow-sm border-emerald-100">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
          <p className={`text-2xl font-black italic tracking-tighter ${stats.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            ₹{stats.balance.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex border-b text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 print:hidden">
        <button className={`px-6 py-3 ${activeTab === 'statement' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('statement')}>Transaction Ledger</button>
        <button className={`px-6 py-3 ${activeTab === 'payments' ? 'border-b-2 border-emerald-600 text-emerald-700' : ''}`} onClick={() => setActiveTab('payments')}>Payment History</button>
      </div>

      {activeTab === 'statement' && (
        <div id="ledger-printable" className="bg-white rounded-[32px] shadow-premium border overflow-hidden p-10 print:m-0 print:p-0 print:border-0 print:shadow-none">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b tracking-widest">
              <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Transaction</th><th className="px-4 py-4 text-center">Vol</th><th className="px-4 py-4 text-right">Debit</th><th className="px-4 py-4 text-right">Credit</th><th className="px-6 py-4 text-right bg-slate-100/30">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-400 text-xs italic">{item.date}</td>
                  <td className="px-6 py-4">
                    <span className="font-black text-slate-700 text-sm tracking-tight">{item.detail}</span>
                    {item.type === 'Refund' && <span className="ml-2 bg-amber-100 text-amber-700 text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase">Refund</span>}
                  </td>
                  <td className="px-4 py-4 text-center font-black text-slate-600 text-sm">{item.qty ? `${item.qty}L` : '-'}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-800">{item.debit > 0 ? `₹${item.debit.toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-4 text-right font-black text-emerald-700">{item.credit > 0 ? `₹${item.credit.toLocaleString()}` : '-'}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 bg-slate-50/20 italic tracking-tighter">₹{item.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-[24px] border shadow-premium overflow-hidden print:hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400">
              <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Type</th><th className="px-8 py-5">Amount</th><th className="px-8 py-5 text-center">Mode</th><th className="px-8 py-5">Reference</th><th className="px-8 py-5 text-center">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.payments.filter(p => p.customerId === id).sort((a,b) => b.paymentDate.localeCompare(a.paymentDate)).map(p => (
                <tr key={p.id}>
                  <td className="px-8 py-4 font-bold text-slate-400">{p.paymentDate}</td>
                  <td className="px-8 py-4">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${p.type === 'REFUND' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {p.type || 'PAYMENT'}
                      </span>
                  </td>
                  <td className={`px-8 py-4 font-black text-lg ${p.type === 'REFUND' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      ₹{p.amount.toLocaleString()}
                  </td>
                  <td className="px-8 py-4 text-center"><span className="text-[9px] font-black uppercase bg-slate-100 px-3 py-1 rounded-lg">{p.mode}</span></td>
                  <td className="px-8 py-4 text-xs font-bold text-slate-400">{p.reference || '-'}</td>
                  <td className="px-8 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                        {isAdmin ? (
                          <>
                            <button onClick={() => setEditingPayment(p)} className="text-emerald-700 font-black uppercase text-[10px]">Edit</button>
                            <button onClick={() => handleDeletePayment(p.id)} className="text-rose-600 font-black uppercase text-[10px]">Delete</button>
                          </>
                        ) : (
                          <span className="text-[8px] font-black text-slate-300 uppercase italic">Locked</span>
                        )}
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

export default CustomerProfile;
