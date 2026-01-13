
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppState, ReturnType } from '../types';
import { calculateOutstanding } from '../db';

const CustomerProfile: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const { id } = useParams<{ id: string }>();
  const customer = state.customers.find(c => c.id === id);

  const ledger = useMemo(() => {
    if (!customer) return [];
    const activities: any[] = [];

    // Sales
    state.sales.filter(s => s.customerId === id).forEach(s => {
      state.saleLines.filter(sl => sl.saleId === s.id).forEach(sl => {
        activities.push({
          date: s.saleDate,
          type: 'Purchase',
          detail: state.products.find(p => p.id === sl.productId)?.name,
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
        detail: `${p.mode} ${p.reference ? `Ref: ${p.reference}` : ''}`,
        qty: null,
        unitPrice: null,
        debit: 0,
        credit: p.amount
      });
    });

    // Returns
    state.returns.filter(r => r.customerId === id && r.type === ReturnType.CUSTOMER).forEach(r => {
      activities.push({
        date: r.date,
        type: 'Return',
        detail: `Returned: ${state.products.find(p => p.id === r.productId)?.name}`,
        qty: r.qty,
        unitPrice: r.unitPriceAtReturn,
        debit: 0,
        credit: r.qty * r.unitPriceAtReturn
      });
    });

    const sorted = activities.sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    return sorted.map(item => {
      balance = balance + item.debit - item.credit;
      return { ...item, balance };
    }).reverse();
  }, [state, id]);

  const stats = useMemo(() => {
    if (!customer) return { balance: 0 };
    return { balance: calculateOutstanding(state, customer.id) };
  }, [state, id]);

  if (!customer) return <div className="p-8 text-center">Record Missing</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b pb-6">
        <div>
          <Link to="/customers" className="text-emerald-700 text-[9px] font-black uppercase tracking-widest mb-2 block">← Customers</Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">{customer.salutation} {customer.name}</h1>
          <p className="text-slate-500 font-bold text-xs mt-1">{customer.phone}</p>
        </div>
        <div className="bg-slate-900 px-6 py-4 rounded-2xl text-white text-right shadow-lg">
          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Balance</p>
          <p className="text-2xl font-black italic">₹{stats.balance.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="bg-slate-50 p-3 border-b flex justify-between items-center print:hidden">
          <h2 className="font-black text-slate-400 uppercase text-[9px]">Statement Ledger</h2>
          <button onClick={() => window.print()} className="bg-white border rounded-lg px-3 py-1 text-[9px] font-black uppercase hover:bg-slate-50">Save PDF</button>
        </div>
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px] border-b">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Detail</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.map((item, idx) => (
              <tr key={idx} className={`${item.type === 'Payment' ? 'bg-emerald-50/30' : ''} hover:bg-slate-50`}>
                <td className="px-4 py-1.5 font-bold text-slate-400">{item.date}</td>
                <td className="px-4 py-1.5 font-bold text-slate-700">
                  <span className={`mr-2 px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${
                    item.type === 'Purchase' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                    item.type === 'Payment' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                  }`}>{item.type}</span>
                  {item.detail}
                </td>
                <td className="px-4 py-1.5 text-right">{item.debit > 0 ? `₹${item.debit.toLocaleString()}` : '-'}</td>
                <td className="px-4 py-1.5 text-right text-emerald-700">{item.credit > 0 ? `₹${item.credit.toLocaleString()}` : '-'}</td>
                <td className="px-4 py-1.5 text-right font-black">₹{item.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerProfile;
