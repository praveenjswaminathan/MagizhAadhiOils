
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppState, Customer, Payment, ReturnType, PaymentType } from '../types';
import { calculateOutstanding, deleteCustomer } from '../db';

const Customers: React.FC<{ state: AppState; updateState: (u: (p: AppState) => AppState) => void; isAdmin: boolean }> = ({ state, updateState, isAdmin }) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  
  const [customerForm, setCustomerForm] = useState({ salutation: 'Smt.', name: '', phone: '', notes: '' });
  
  // Searchable Customer for Payments
  const [paymentCustomerSearch, setPaymentCustomerSearch] = useState('');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);

  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    mode: 'GPay',
    type: 'PAYMENT' as PaymentType,
    reference: ''
  });

  // Handle outside clicks for payment dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(event.target as Node)) {
        setIsPaymentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPaymentCustomers = useMemo(() => {
    const q = paymentCustomerSearch.toLowerCase().trim();
    if (!q) return state.customers;
    return state.customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone?.includes(q)
    );
  }, [state.customers, paymentCustomerSearch]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
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
    setCustomerForm({ salutation: 'Smt.', name: '', phone: '', notes: '' });
  };

  const handleEditClick = (customer: Customer) => {
    if (!isAdmin) return;
    setEditingCustomerId(customer.id);
    setCustomerForm({
      salutation: customer.salutation || 'Smt.',
      name: customer.name,
      phone: customer.phone || '',
      notes: customer.notes || ''
    });
    setShowAddCustomer(true);
    setShowAddPayment(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCustomerBtn = async (id: string) => {
    if (!isAdmin) return;
    const cust = state.customers.find(c => c.id === id);
    if (!window.confirm(`⚠️ PERMANENT DELETE: Remove client "${cust?.name}"?\n\nThis will wipe their profile from the directory. Historical transaction logs will lose this reference. This cannot be retrieved once confirmed.`)) return;
    
    try {
      const newState = await deleteCustomer(id, state);
      updateState(() => newState);
    } catch (err) {
      alert("Error deleting customer.");
    }
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!paymentForm.customerId || paymentForm.amount <= 0) return alert("Please select a customer and enter a valid amount.");

    const newPayment: Payment = {
      id: crypto.randomUUID(),
      customerId: paymentForm.customerId,
      amount: paymentForm.amount,
      paymentDate: paymentForm.date,
      mode: paymentForm.mode,
      type: paymentForm.type,
      reference: paymentForm.reference,
      createdBy: state.currentUser
    };

    updateState(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
    setShowAddPayment(false);
    setPaymentCustomerSearch('');
    setPaymentForm({ customerId: '', amount: 0, date: new Date().toISOString().split('T')[0], mode: 'GPay', type: 'PAYMENT', reference: '' });
  };

  const handleCustomerSelectionForPayment = (cid: string) => {
    const cust = state.customers.find(c => c.id === cid);
    const dues = calculateOutstanding(state, cid);
    setPaymentForm({ 
        ...paymentForm, 
        customerId: cid, 
        amount: dues !== 0 ? Math.abs(dues) : 0,
        type: dues < 0 ? 'REFUND' : 'PAYMENT'
    });
    setPaymentCustomerSearch(cust ? `${cust.salutation} ${cust.name}` : '');
    setIsPaymentDropdownOpen(false);
  };

  const customerStats = useMemo(() => {
    return state.customers.map(c => {
      const totalSales = state.sales
        .filter(s => s.customerId === c.id)
        .reduce((sum, s) => {
          return sum + state.saleLines
            .filter(sl => sl.saleId === s.id)
            .reduce((lSum, sl) => lSum + (sl.qtyL * sl.unitPrice), 0);
        }, 0);

      const totalReturns = state.returns
        .filter(r => r.customerId === c.id && r.type === ReturnType.CUSTOMER)
        .reduce((sum, r) => sum + (r.qty * r.unitPriceAtReturn), 0);

      const totalPayments = state.payments
        .filter(p => p.customerId === c.id)
        .reduce((sum, p) => {
            if (p.type === 'REFUND') return sum - p.amount;
            return sum + p.amount;
        }, 0);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Customer Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Manage client accounts and receivables.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link 
            to="/reports/consolidated"
            className="bg-emerald-950 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2 border border-emerald-800"
          >
            <span>📜</span> Master PDF Ledger
          </Link>
          {isAdmin && (
            <>
              <button 
                onClick={() => { setShowAddPayment(true); setShowAddCustomer(false); setEditingCustomerId(null); setPaymentCustomerSearch(''); }}
                className="bg-amber-100 text-amber-800 px-6 py-3 rounded-2xl font-black uppercase text-[10px] border border-amber-200 shadow-sm active:scale-95 transition-all"
              >
                Money Flow Control
              </button>
              <button 
                onClick={() => { 
                  setShowAddCustomer(true); 
                  setShowAddPayment(false); 
                  setEditingCustomerId(null);
                  setCustomerForm({ salutation: 'Smt.', name: '', phone: '', notes: '' });
                }}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
              >
                + New Client
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && showAddCustomer && (
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
              <option>Smt.</option>
              <option>Shri.</option>
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

      {isAdmin && showAddPayment && (
        <form onSubmit={handleAddPayment} className={`bg-white p-10 rounded-[32px] border shadow-2xl space-y-4 animate-in slide-in-from-top duration-300 ${paymentForm.type === 'REFUND' ? 'border-amber-500 bg-amber-50/10' : 'border-emerald-500 bg-emerald-50/10'}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className={`text-xl font-black uppercase italic ${paymentForm.type === 'REFUND' ? 'text-amber-800' : 'text-emerald-800'}`}>
                {paymentForm.type === 'REFUND' ? 'Record Outward Refund (MA → Client)' : 'Record Inward Payment (Client → MA)'}
              </h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-200">
                  <button 
                    type="button"
                    onClick={() => setPaymentForm({...paymentForm, type: 'PAYMENT'})}
                    className={`px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${paymentForm.type === 'PAYMENT' ? 'bg-emerald-950 text-white shadow-xl' : 'text-slate-400'}`}
                  >
                    Payment Received
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPaymentForm({...paymentForm, type: 'REFUND'})}
                    className={`px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${paymentForm.type === 'REFUND' ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-400'}`}
                  >
                    Refund to Customer
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative" ref={paymentDropdownRef}>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Search Customer Directory</label>
              <input 
                type="text"
                placeholder="Type name or contact..."
                className="w-full border rounded-2xl px-4 py-3 bg-white font-bold mt-1 outline-none focus:border-emerald-500 transition-all shadow-sm"
                value={paymentCustomerSearch}
                onFocus={() => setIsPaymentDropdownOpen(true)}
                onChange={(e) => {
                  setPaymentCustomerSearch(e.target.value);
                  setIsPaymentDropdownOpen(true);
                }}
              />
              {isPaymentDropdownOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border-2 mt-2 rounded-[24px] shadow-2xl z-[60] max-h-60 overflow-y-auto border-emerald-100 overflow-x-hidden">
                  {filteredPaymentCustomers.length > 0 ? (
                    filteredPaymentCustomers.map(c => {
                        const balance = calculateOutstanding(state, c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleCustomerSelectionForPayment(c.id)}
                            className="w-full text-left px-5 py-4 hover:bg-emerald-50 transition-colors border-b last:border-b-0 flex items-center justify-between group"
                          >
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-sm group-hover:text-emerald-800">{c.salutation} {c.name}</span>
                              <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">{c.phone || 'No Phone'}</span>
                            </div>
                            <span className={`text-[10px] font-black italic px-2 py-1 rounded-lg ${balance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              ₹{Math.abs(balance).toLocaleString()} {balance > 0 ? 'Due' : 'Cr'}
                            </span>
                          </button>
                        );
                    })
                  ) : (
                    <div className="px-5 py-8 text-[11px] font-black uppercase text-slate-300 text-center italic">No matching clients found</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Amount (₹)</label>
              <input 
                type="number" required placeholder="Amount (₹)" className="w-full border rounded-2xl px-4 py-3 font-black mt-1 bg-white shadow-sm"
                value={paymentForm.amount || ''} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mode</label>
              <select 
                className="w-full border rounded-2xl px-4 py-3 bg-white font-bold mt-1 shadow-sm"
                value={paymentForm.mode} onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})}
              >
                <option value="GPay">GPay (Google Pay)</option>
                <option value="Cash">Cash Payment</option>
                <option value="UPI">Other UPI / Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Reference / ID</label>
              <input 
                placeholder="Txn ID / Ref" className="w-full border rounded-2xl px-4 py-3 mt-1 font-bold text-xs bg-white shadow-sm"
                value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Date</label>
              <input 
                type="date" required className="w-full border rounded-2xl px-4 py-3 mt-1 bg-white shadow-sm"
                value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button 
              type="submit" 
              className={`flex-grow py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all text-white ${paymentForm.type === 'REFUND' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-950 hover:bg-black'}`}
            >
              {paymentForm.type === 'REFUND' ? 'Confirm Outward Refund' : 'Post Payment to Account'}
            </button>
            <button type="button" onClick={() => setShowAddPayment(false)} className="px-12 border-2 bg-white rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
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
              <th className="px-8 py-5 text-right">Net Payments</th>
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
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditClick(c)} 
                        className="bg-white border text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all tracking-widest"
                      >
                        Edit
                      </button>
                    )}
                    <Link 
                      to={`/customer/${c.id}`} 
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 hover:text-white transition-all tracking-widest"
                    >
                      Ledger
                    </Link>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteCustomerBtn(c.id)} 
                        className="bg-rose-50 text-rose-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all tracking-widest"
                      >
                        Del
                      </button>
                    )}
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
