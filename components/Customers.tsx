import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppState, Customer, Payment, ReturnType } from '../types';
import { calculateOutstanding } from '../db';

const Customers: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  
  const [customerForm, setCustomerForm] = useState({ salutation: 'Shri.', name: '', phone: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    mode: 'GPay',
    reference: ''
  });

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name) return;

    const id = editingCustomerId || crypto.randomUUID();
    const newCustomer: Customer = {
      id,
      salutation: customerForm.salutation,
      name: customerForm.name,
      phone: customerForm.phone,
      notes: customerForm.notes
    };

    updateState(prev => ({ 
      ...prev, 
      customers: [...prev.customers.filter(c => c.id !== id), newCustomer] 
    }));

    setShowAddCustomer(false);
    setEditingCustomerId(null);
    setCustomerForm({ salutation: 'Shri.', name: '', phone: '', notes: '' });
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      salutation: customer.salutation || 'Shri.',
      name: customer.name,
      phone: customer.phone || '',
      notes: customer.notes || ''
    });
    setShowAddCustomer(true);
    setShowAddPayment(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.customerId || paymentForm.amount <= 0) return;

    const newPayment: Payment = {
      id: crypto.randomUUID(),
      customerId: paymentForm.customerId,
      amount: paymentForm.amount,
      paymentDate: paymentForm.date,
      mode: paymentForm.mode,
      reference: paymentForm.reference
    };

    updateState(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
    setShowAddPayment(false);
    setPaymentForm({ customerId: '', amount: 0, date: new Date().toISOString().split('T')[0], mode: 'GPay', reference: '' });
  };

  const handleCustomerSelectionForPayment = (cid: string) => {
    const dues = calculateOutstanding(state, cid);
    // Auto pre-populate amount with pending dues if they exist
    setPaymentForm({ 
        ...paymentForm, 
        customerId: cid, 
        amount: dues > 0 ? dues : 0 
    });
  };

  const customerStats = useMemo(() => {
    return state.customers.map(c => {
      // Total Gross Sales
      const totalSales = state.sales
        .filter(s => s.customerId === c.id)
        .reduce((sum, s) => {
          return sum + state.saleLines
            .filter(sl => sl.saleId === s.id)
            .reduce((lSum, sl) => lSum + (sl.qtyL * sl.unitPrice), 0);
        }, 0);

      // Total Credit from Returns
      const totalReturns = state.returns
        .filter(r => r.customerId === c.id && r.type === ReturnType.CUSTOMER)
        .reduce((sum, r) => sum + (r.qty * r.unitPriceAtReturn), 0);

      // Total Cash Received
      const totalPayments = state.payments
        .filter(p => p.customerId === c.id)
        .reduce((sum, p) => sum + p.amount, 0);

      const netPurchased = totalSales - totalReturns;
      const balance = netPurchased - totalPayments;

      return {
        ...c,
        netPurchased,
        totalPayments,
        balance
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Customer Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Manage client accounts and receivables.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setShowAddPayment(true); setShowAddCustomer(false); setEditingCustomerId(null); }}
            className="bg-amber-100 text-amber-800 px-6 py-3 rounded-2xl font-black uppercase text-xs border border-amber-200 shadow-sm active:scale-95 transition-all"
          >
            Record Payment
          </button>
          <button 
            onClick={() => { 
              setShowAddCustomer(true); 
              setShowAddPayment(false); 
              setEditingCustomerId(null);
              setCustomerForm({ salutation: 'Shri.', name: '', phone: '', notes: '' });
            }}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
          >
            + New Client
          </button>
        </div>
      </div>

      {showAddCustomer && (
        <form onSubmit={handleAddCustomer} className="bg-white p-10 rounded-[32px] border shadow-2xl space-y-4">
          <h2 className="text-xl font-black text-slate-800 uppercase italic">
            {editingCustomerId ? 'Edit Client Profile' : 'Onboard New Customer'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select 
              className="border rounded-2xl px-4 py-3 bg-slate-50 font-bold" 
              value={customerForm.salutation} 
              onChange={e => setCustomerForm({...customerForm, salutation: e.target.value})}
            >
              <option>Shri.</option>
              <option>Smt.</option>
              <option>Ms.</option>
              <option>Dr.</option>
            </select>
            <input 
              required placeholder="Legal Full Name" className="col-span-2 border rounded-2xl px-4 py-3"
              value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})}
            />
            <input 
              placeholder="Contact Number" className="border rounded-2xl px-4 py-3"
              value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})}
            />
          </div>
          <div>
            <textarea 
              placeholder="Additional notes (address, preferences, etc.)" 
              className="w-full border rounded-2xl px-4 py-3 h-24"
              value={customerForm.notes} onChange={e => setCustomerForm({...customerForm, notes: e.target.value})}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-grow bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">
              {editingCustomerId ? 'Save Changes' : 'Register Customer'}
            </button>
            <button 
              type="button" 
              onClick={() => { setShowAddCustomer(false); setEditingCustomerId(null); }} 
              className="px-8 border rounded-2xl font-black uppercase text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showAddPayment && (
        <form onSubmit={handleAddPayment} className="bg-white p-10 rounded-[32px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300">
          <h2 className="text-xl font-black text-amber-800 uppercase italic">Log Customer Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Select Customer</label>
              <select 
                required className="w-full border rounded-2xl px-4 py-3 bg-slate-50 font-bold mt-1"
                value={paymentForm.customerId} onChange={e => handleCustomerSelectionForPayment(e.target.value)}
              >
                <option value="">Search Customer Directory...</option>
                {state.customers.map(c => <option key={c.id} value={c.id}>{c.salutation} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Amount to Pay (₹)</label>
              <input 
                type="number" required placeholder="Amount (₹)" className="w-full border rounded-2xl px-4 py-3 font-black mt-1"
                value={paymentForm.amount || ''} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Payment Mode</label>
              <select 
                className="w-full border rounded-2xl px-4 py-3 bg-slate-50 font-bold mt-1"
                value={paymentForm.mode} onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})}
              >
                <option value="GPay">GPay (Google Pay)</option>
                <option value="Cash">Cash Payment</option>
                <option value="UPI">Other UPI / Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Ref / Transaction ID</label>
              <input 
                placeholder="Reference No." className="w-full border rounded-2xl px-4 py-3 mt-1 font-bold text-xs"
                value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Payment Date</label>
              <input 
                type="date" required className="w-full border rounded-2xl px-4 py-3 mt-1"
                value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button type="submit" className="flex-grow bg-amber-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Post Credit to Account</button>
            <button type="button" onClick={() => setShowAddPayment(false)} className="px-12 border rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[32px] shadow-sm border overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b tracking-widest">
            <tr>
              <th className="px-8 py-5">Customer</th>
              <th className="px-8 py-5">Contact</th>
              <th className="px-8 py-5 text-right">Gross Purchases</th>
              <th className="px-8 py-5 text-right">Total Payments</th>
              <th className="px-8 py-5 text-right">Current Balance</th>
              <th className="px-8 py-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customerStats.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                <td className="px-8 py-6">
                  <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">{c.salutation}</span>
                  <span className="font-black text-slate-800 text-lg tracking-tight">{c.name}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-slate-500 font-bold text-xs">{c.phone || <span className="text-slate-300 italic">No Phone</span>}</span>
                </td>
                <td className="px-8 py-6 text-right font-bold text-slate-700">
                  ₹{c.netPurchased.toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right font-bold text-emerald-600">
                  ₹{c.totalPayments.toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-xl font-black leading-none ${c.balance > 0 ? 'text-rose-600' : c.balance < 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      ₹{Math.abs(c.balance).toLocaleString()}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded border ${
                      c.balance > 0 ? 'bg-rose-50 border-rose-100 text-rose-500' : 
                      c.balance < 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                      'bg-slate-50 border-slate-100 text-slate-400'
                    }`}>
                      {c.balance > 0 ? 'DUE' : c.balance < 0 ? 'CREDIT' : 'SETTLED'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => handleEditClick(c)} 
                      className="bg-white border text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all tracking-widest"
                    >
                      Edit
                    </button>
                    <Link 
                      to={`/customer/${c.id}`} 
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 hover:text-white transition-all tracking-widest"
                    >
                      Statement
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Customers;
