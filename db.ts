
import { AppState, ProductType, ReturnType, ConsignmentLine, Hub, Customer, Product, PriceHistory, Consignment, Sale, SaleLine, Payment, ReturnRecord } from './types';
import { supabase } from './supabase';

const STORAGE_KEY = 'magizh_aadhi_oils_db';

export const INITIAL_STATE: AppState = {
  hubs: [
    { id: 'hub-1', name: 'Magizh Aadhi Hub (Chennai)', address: 'Chennai, India' }
  ],
  customers: [],
  products: [
    { id: 'p1', name: ProductType.GINGELLY_JAGGERY },
    { id: 'p2', name: ProductType.COCONUT },
    { id: 'p3', name: ProductType.GROUNDNUT },
    { id: 'p4', name: ProductType.DEEPAM },
    { id: 'p5', name: ProductType.CASTOR },
    { id: 'p6', name: ProductType.GINGELLY_PALM_SUGAR },
  ],
  priceHistory: [
    { id: 'ph1', productId: 'p1', effectiveDate: '2025-01-01', unitPrice: 390 },
    { id: 'ph2', productId: 'p2', effectiveDate: '2025-01-01', unitPrice: 450 },
    { id: 'ph3', productId: 'p3', effectiveDate: '2025-01-01', unitPrice: 240 },
    { id: 'ph4', productId: 'p4', effectiveDate: '2025-01-01', unitPrice: 190 },
    { id: 'ph5', productId: 'p5', effectiveDate: '2025-01-01', unitPrice: 290 },
    { id: 'ph6', productId: 'p6', effectiveDate: '2025-01-01', unitPrice: 430 },
  ],
  consignments: [],
  consignmentLines: [],
  sales: [],
  saleLines: [],
  payments: [],
  returns: [],
  adminUsernames: []
};

const cleanState = (state: AppState): AppState => {
  const dedup = <T extends { id: string }>(arr: T[]): T[] => {
    const map = new Map();
    arr.forEach(i => { if (i.id) map.set(i.id, i); });
    return Array.from(map.values());
  };

  return {
    ...state,
    hubs: dedup(state.hubs),
    customers: dedup(state.customers),
    products: dedup(state.products),
    priceHistory: dedup(state.priceHistory),
    consignments: dedup(state.consignments),
    consignmentLines: dedup(state.consignmentLines),
    sales: dedup(state.sales),
    saleLines: dedup(state.saleLines),
    payments: dedup(state.payments),
    returns: dedup(state.returns)
  };
};

export const loadState = async (): Promise<AppState> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return INITIAL_STATE;

  try {
    const [hRes, cRes, pRes, phRes, coRes, clRes, sRes, slRes, pyRes, rRes, admRes] = await Promise.all([
      supabase.from('hubs').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('products').select('*'),
      supabase.from('price_history').select('*'),
      supabase.from('consignments').select('*'),
      supabase.from('consignment_lines').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('sale_lines').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('returns').select('*'),
      supabase.from('admin_users').select('username')
    ]);

    const state: AppState = {
      hubs: (hRes.data || []).map(h => ({ id: h.id, name: h.name || '', address: h.address || '' })),
      customers: (cRes.data || []).map(c => ({ id: c.id, salutation: c.salutation || 'Smt.', name: c.name || '', phone: c.phone || '', notes: c.notes || '' })),
      products: (pRes.data || []).length > 0 ? (pRes.data || []).map(p => ({ id: p.id, name: p.name || '' })) : INITIAL_STATE.products,
      /* Fix: Map phRes.data correctly to camelCase properties */
      priceHistory: (phRes.data || []).length > 0 ? (phRes.data || []).map(ph => ({ id: ph.id, productId: ph.product_id, effectiveDate: ph.effective_date, unitPrice: Number(ph.unit_price) })) : INITIAL_STATE.priceHistory,
      /* Fix: Map coRes.data correctly to camelCase properties */
      consignments: (coRes.data || []).map(c => ({ id: c.id, consignmentNo: c.consignment_no, receiveDate: c.receive_date, toHubId: c.to_hub_id, transportCost: Number(c.transport_cost || 0), notes: c.notes || '', createdBy: c.created_by })),
      /* Fix: Map clRes.data correctly to camelCase properties */
      consignmentLines: (clRes.data || []).map(cl => ({ id: cl.id, consignmentId: cl.consignment_id, productId: cl.product_id, qtyL: Number(cl.qty_l || 0), unitPrice: Number(cl.unit_price || 0) })),
      sales: (sRes.data || []).map(s => ({ id: s.id, saleNo: s.sale_no, saleDate: s.sale_date, hubId: s.hub_id, customerId: s.customer_id, reimbursementAmount: Number(s.reimbursement_amount || 0), notes: s.notes || '', createdBy: s.created_by })),
      saleLines: (slRes.data || []).map(sl => ({ id: sl.id, saleId: sl.sale_id, productId: sl.product_id, qtyL: Number(sl.qty_l || 0), unitPrice: Number(sl.unit_price || 0) })),
      payments: (pyRes.data || []).map(p => ({ id: p.id, customerId: p.customer_id, paymentDate: p.payment_date, amount: Number(p.amount || 0), mode: p.mode || 'GPay', type: (p.type || 'PAYMENT') as any, reference: p.reference || '', notes: p.notes || '', createdBy: p.created_by })),
      /* Fix: Map rRes.data correctly to camelCase properties */
      returns: (rRes.data || []).map(r => ({ id: r.id, date: r.date, type: r.type as any, hubId: r.hub_id, customerId: r.customer_id, referenceId: r.sale_line_id, productId: r.product_id, qty: Number(r.qty || 0), unitPriceAtReturn: Number(r.unit_price_at_return || 0), notes: r.notes || '', createdBy: r.created_by })),
      adminUsernames: (admRes.data || []).map(a => a.username)
    };

    const finalState = cleanState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
    return finalState;
  } catch (error) {
    console.error("Load failed, using local cache:", error);
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : INITIAL_STATE;
  }
};

export const saveState = async (state: AppState) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  
  const userId = session.user.id;
  const clean = cleanState(state);

  const trySync = async (table: string, data: any[]) => {
    if (!data || data.length === 0) return;
    const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
    if (error) {
      console.error(`Sync error on table ${table}:`, error.message);
      throw new Error(`Sync failed for ${table}: ${error.message}`);
    }
  };

  try {
    await Promise.all([
      trySync('hubs', clean.hubs.map(h => ({ id: h.id, name: h.name, address: h.address || null, user_id: userId }))),
      trySync('customers', clean.customers.map(c => ({ id: c.id, salutation: c.salutation || 'Smt.', name: c.name, phone: c.phone || '', notes: c.notes || '', user_id: userId }))),
      trySync('products', clean.products.map(p => ({ id: p.id, name: p.name, user_id: userId }))),
      trySync('price_history', clean.priceHistory.map(ph => ({ id: ph.id, product_id: ph.productId, effective_date: ph.effectiveDate, unit_price: ph.unitPrice, user_id: userId }))),
      /* Fix: Use c.transportCost instead of c.transport_cost to resolve property not existing error */
      trySync('consignments', clean.consignments.map(c => ({ id: c.id, consignment_no: c.consignmentNo, receive_date: c.receiveDate, to_hub_id: c.toHubId, transport_cost: c.transportCost, notes: c.notes || '', created_by: c.createdBy || null, user_id: userId }))),
      trySync('sales', clean.sales.map(s => ({ id: s.id, sale_no: s.saleNo, sale_date: s.saleDate, hub_id: s.hubId, customer_id: s.customerId || null, reimbursement_amount: s.reimbursementAmount, notes: s.notes || '', created_by: s.createdBy || null, user_id: userId }))),
      trySync('payments', clean.payments.map(p => ({ id: p.id, customer_id: p.customerId || null, payment_date: p.paymentDate, amount: p.amount, mode: p.mode, type: p.type || 'PAYMENT', reference: p.reference || '', notes: p.notes || '', created_by: p.createdBy || null, user_id: userId }))),
      /* Fix: Use r.createdBy instead of r.created_by to align with type interface */
      trySync('returns', clean.returns.map(r => ({ id: r.id, date: r.date, type: r.type, hub_id: r.hubId, customer_id: r.customerId || null, sale_line_id: r.referenceId || null, product_id: r.productId, qty: r.qty, unit_price_at_return: r.unitPriceAtReturn, notes: r.notes || '', created_by: r.createdBy || null, user_id: userId })))
    ]);

    if (clean.consignmentLines.length > 0) {
      await trySync('consignment_lines', clean.consignmentLines.map(cl => ({ id: cl.id, consignment_id: cl.consignmentId, product_id: cl.productId, qty_l: cl.qtyL, unit_price: cl.unitPrice, user_id: userId })));
    }
    if (clean.saleLines.length > 0) {
      await trySync('sale_lines', clean.saleLines.map(sl => ({ id: sl.id, sale_id: sl.saleId, product_id: sl.productId, qty_l: sl.qtyL, unit_price: sl.unitPrice, user_id: userId })));
    }
  } catch (error: any) {
    console.error("Global Save Failure:", error);
    throw error;
  }
};

export const deleteCustomer = async (id: string, state: AppState): Promise<AppState> => {
  const newState = { ...state, customers: state.customers.filter(c => c.id !== id) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  await supabase.from('customers').delete().eq('id', id);
  return newState;
};

export const deleteSale = async (id: string, state: AppState): Promise<AppState> => {
  const newState = { ...state, sales: state.sales.filter(s => s.id !== id), saleLines: state.saleLines.filter(sl => sl.saleId !== id) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  await supabase.from('sale_lines').delete().eq('sale_id', id);
  await supabase.from('sales').delete().eq('id', id);
  return newState;
};

export const deleteConsignment = async (id: string, state: AppState): Promise<AppState> => {
  const newState = { ...state, consignments: state.consignments.filter(c => c.id !== id), consignmentLines: state.consignmentLines.filter(cl => cl.consignmentId !== id) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  await supabase.from('consignment_lines').delete().eq('consignment_id', id);
  await supabase.from('consignments').delete().eq('id', id);
  return newState;
};

export const deleteReturn = async (id: string, state: AppState): Promise<AppState> => {
  const newState = { ...state, returns: state.returns.filter(r => r.id !== id) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  await supabase.from('returns').delete().eq('id', id);
  return newState;
};

export const deletePayment = async (id: string, state: AppState): Promise<AppState> => {
  const newState = { ...state, payments: state.payments.filter(p => p.id !== id) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  await supabase.from('payments').delete().eq('id', id);
  return newState;
};

export const getNextNo = (state: AppState, type: 'CON' | 'S') => {
  if (type === 'CON') return `CON-${state.consignments.length + 1}`;
  return `S-${state.sales.length + 1}`;
};

export const getLatestPrice = (state: AppState, productId: string, date: string): number => {
  const prices = state.priceHistory
    .filter(ph => ph.productId === productId && (ph.effectiveDate || '') <= date)
    .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''));
  return prices.length > 0 ? prices[0].unitPrice : 0;
};

export const getInventoryMetrics = (state: AppState, hubId: string | 'all', productId: string) => {
  const batches: { qty: number; cost: number; date: string }[] = [];
  state.consignmentLines.forEach(cl => {
    const c = state.consignments.find(cons => cons.id === cl.consignmentId);
    if (c && cl.productId === productId && (hubId === 'all' || c.toHubId === hubId)) {
      if (cl.qtyL > 0) batches.push({ qty: cl.qtyL, cost: cl.unitPrice, date: c.receiveDate || '' });
    }
  });
  batches.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  state.saleLines.forEach(sl => {
    const s = state.sales.find(sale => sale.id === sl.saleId);
    if (s && sl.productId === productId && (hubId === 'all' || s.hubId === hubId)) {
      let saleQty = sl.qtyL;
      for (const b of batches) {
        if (saleQty <= 0) break;
        const deduct = Math.min(b.qty, saleQty);
        b.qty -= deduct;
        saleQty -= deduct;
      }
    }
  });
  state.returns.filter(r => r.type === ReturnType.SUPPLIER && r.productId === productId).forEach(r => {
    if (hubId === 'all' || r.hubId === hubId) {
      let returnQty = r.qty;
      for (const b of batches) {
        if (returnQty <= 0) break;
        const deduct = Math.min(b.qty, returnQty);
        b.qty -= deduct;
        returnQty -= deduct;
      }
    }
  });
  const finalQty = batches.reduce((sum, b) => sum + b.qty, 0);
  const costValue = batches.reduce((sum, b) => sum + (b.qty * b.cost), 0);
  const today = new Date();
  let weightedAgeSum = 0;
  batches.forEach(b => {
    if (b.qty > 0 && b.date) {
      const receiveDate = new Date(b.date);
      const diffMs = today.getTime() - receiveDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      weightedAgeSum += (b.qty * diffDays);
    }
  });
  const ageDays = finalQty > 0 ? Math.round(weightedAgeSum / finalQty) : 0;
  return { qty: finalQty, value: costValue, ageDays };
};

export const calculateOutstanding = (state: AppState, customerId: string) => {
  let receivable = 0;
  state.sales.filter(s => s.customerId === customerId).forEach(s => {
    state.saleLines.filter(sl => sl.saleId === s.id).forEach(sl => { receivable += (sl.qtyL * sl.unitPrice); });
  });
  state.payments.filter(p => p.customerId === customerId).forEach(p => { 
    if (p.type === 'REFUND') {
        receivable += p.amount;
    } else {
        receivable -= p.amount;
    }
  });
  state.returns.filter(r => r.customerId === customerId && r.type === ReturnType.CUSTOMER).forEach(r => { receivable -= (r.qty * r.unitPriceAtReturn); });
  return receivable;
};
