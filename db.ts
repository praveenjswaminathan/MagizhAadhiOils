
import { AppState, ProductType, ReturnType, ConsignmentLine, Hub, Customer, Product, PriceHistory, Consignment, Sale, SaleLine, Payment, ReturnRecord } from './types';
import { supabase } from './supabase';

const STORAGE_KEY = 'magizh_aadhi_oils_db';

export const INITIAL_STATE: AppState = {
  hubs: [
    { id: 'hub-1', name: 'Swaminathan Residence (Chennai)', address: 'Chennai, India' }
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
  returns: []
};

// CRITICAL: Ensure no duplicate IDs exist in the local state
const uniqueById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

export const loadState = async (): Promise<AppState> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : INITIAL_STATE;
  }

  try {
    const [
      hubsRes, customersRes, productsRes, priceHistoryRes,
      consignmentsRes, consignmentLinesRes, salesRes,
      saleLinesRes, paymentsRes, returnsRes
    ] = await Promise.all([
      supabase.from('hubs').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('products').select('*'),
      supabase.from('price_history').select('*'),
      supabase.from('consignments').select('*'),
      supabase.from('consignment_lines').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('sale_lines').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('returns').select('*')
    ]);

    const state: AppState = {
      hubs: uniqueById((hubsRes.data || []).map(h => ({ id: h.id, name: h.name || '', address: h.address || '' }))),
      customers: uniqueById((customersRes.data || []).map(c => ({ 
        id: c.id, 
        salutation: c.salutation || 'Shri.', 
        name: c.name || '', 
        phone: c.phone || '', 
        notes: c.notes || '' 
      }))),
      products: uniqueById((productsRes.data || []).map(p => ({ id: p.id, name: p.name || '' }))),
      priceHistory: uniqueById((priceHistoryRes.data || []).map(ph => ({
        id: ph.id, productId: ph.product_id, effectiveDate: ph.effective_date, unitPrice: Number(ph.unit_price)
      }))),
      consignments: uniqueById((consignmentsRes.data || []).map(c => ({
        id: c.id, 
        consignmentNo: c.consignment_no || '', 
        receiveDate: c.receive_date || '', 
        toHubId: c.to_hub_id || '', 
        transportCost: Number(c.transport_cost), 
        notes: c.notes || '', 
        createdBy: c.created_by || ''
      }))),
      consignmentLines: uniqueById((consignmentLinesRes.data || []).map(cl => ({
        id: cl.id, consignmentId: cl.consignment_id, productId: cl.product_id, qtyL: Number(cl.qty_l), unitPrice: Number(cl.unit_price)
      }))),
      sales: uniqueById((salesRes.data || []).map(s => ({
        id: s.id, 
        saleNo: s.sale_no || '', 
        saleDate: s.sale_date || '', 
        hubId: s.hub_id || '', 
        customerId: s.customer_id || '', 
        reimbursementAmount: Number(s.reimbursement_amount), 
        notes: s.notes || '', 
        createdBy: s.created_by || ''
      }))),
      saleLines: uniqueById((saleLinesRes.data || []).map(sl => ({
        id: sl.id, saleId: sl.sale_id, productId: sl.product_id, qtyL: Number(sl.qty_l), unitPrice: Number(sl.unit_price)
      }))),
      payments: uniqueById((paymentsRes.data || []).map(p => ({
        id: p.id, 
        customerId: p.customer_id || '', 
        paymentDate: p.payment_date || '', 
        amount: Number(p.amount), 
        mode: p.mode || '', 
        reference: p.reference || '', 
        notes: p.notes || '', 
        createdBy: p.created_by || ''
      }))),
      returns: uniqueById((returnsRes.data || []).map(r => ({
        id: r.id, 
        date: r.date || '', 
        type: r.type as any, 
        hubId: r.hub_id || '', 
        customerId: r.customer_id || '', 
        saleLineId: r.sale_line_id || '', 
        productId: r.product_id || '', 
        qty: Number(r.qty), 
        unitPriceAtReturn: Number(r.unit_price_at_return), 
        notes: r.notes || '', 
        createdBy: r.created_by || ''
      })))
    };

    return state;
  } catch (error) {
    console.error("Supabase load failed:", error);
    return INITIAL_STATE;
  }
};

export const saveState = async (state: AppState) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  try {
    // Stage 1: Basic Lookups
    await Promise.all([
      supabase.from('hubs').upsert(state.hubs.map(h => ({ id: h.id, user_id: userId, name: h.name, address: h.address }))),
      supabase.from('customers').upsert(state.customers.map(c => ({ id: c.id, user_id: userId, salutation: c.salutation, name: c.name, phone: c.phone, notes: c.notes }))),
      supabase.from('products').upsert(state.products.map(p => ({ id: p.id, user_id: userId, name: p.name }))),
    ]);
    
    // Stage 2: Parent Transactions
    await Promise.all([
      supabase.from('price_history').upsert(state.priceHistory.map(ph => ({ 
        id: ph.id, user_id: userId, product_id: ph.productId, effective_date: ph.effectiveDate, unit_price: ph.unitPrice 
      }))),
      supabase.from('consignments').upsert(state.consignments.map(c => ({
        id: c.id, user_id: userId, consignment_no: c.consignmentNo, receive_date: c.receiveDate, to_hub_id: c.toHubId, transport_cost: c.transportCost, notes: c.notes || '', created_by: c.createdBy
      }))),
      supabase.from('sales').upsert(state.sales.map(s => ({
        id: s.id, user_id: userId, sale_no: s.saleNo, sale_date: s.saleDate, hub_id: s.hubId, customer_id: s.customerId || null, reimbursement_amount: s.reimbursementAmount, notes: s.notes || '', created_by: s.createdBy
      }))),
      supabase.from('payments').upsert(state.payments.map(p => ({
        id: p.id, user_id: userId, customer_id: p.customerId || null, payment_date: p.paymentDate, amount: p.amount, mode: p.mode, reference: p.reference || '', notes: p.notes || '', created_by: p.createdBy
      }))),
    ]);

    // Stage 3: Child Lines & Returns
    await Promise.all([
      supabase.from('consignment_lines').upsert(state.consignmentLines.map(cl => ({
        id: cl.id, consignment_id: cl.consignmentId, product_id: cl.productId, qty_l: cl.qtyL, unit_price: cl.unitPrice
      }))),
      supabase.from('sale_lines').upsert(state.saleLines.map(sl => ({
        id: sl.id, sale_id: sl.saleId, product_id: sl.productId, qty_l: sl.qtyL, unit_price: sl.unitPrice
      }))),
      supabase.from('returns').upsert(state.returns.map(r => ({
        id: r.id, 
        user_id: userId, 
        date: r.date, 
        type: r.type, 
        hub_id: r.hubId, 
        customer_id: r.customerId || null, 
        sale_line_id: r.saleLineId || null, 
        product_id: r.productId, 
        qty: r.qty, 
        unit_price_at_return: r.unitPriceAtReturn, 
        notes: r.notes || '', 
        created_by: r.createdBy
      })))
    ]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Save state failed:", error);
  }
};

export const getNextNo = (state: AppState, type: 'CON' | 'S') => {
  if (type === 'CON') return `CON-${state.consignments.length + 1}`;
  return `S-${state.sales.length + 1}`;
};

export const getLatestPrice = (state: AppState, productId: string, date: string): number => {
  const prices = state.priceHistory
    .filter(ph => ph.productId === productId && ph.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return prices.length > 0 ? prices[0].unitPrice : 0;
};

export const getInventoryMetrics = (state: AppState, hubId: string | 'all', productId: string) => {
  const batches: { qty: number; cost: number; date: string }[] = [];

  state.consignmentLines.forEach(cl => {
    const c = state.consignments.find(cons => cons.id === cl.consignmentId);
    if (c && cl.productId === productId && (hubId === 'all' || c.toHubId === hubId)) {
      if (cl.qtyL > 0) batches.push({ qty: cl.qtyL, cost: cl.unitPrice, date: c.receiveDate });
    }
  });
  
  batches.sort((a, b) => a.date.localeCompare(b.date));

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
    if (b.qty > 0) {
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
    state.saleLines.filter(sl => sl.saleId === s.id).forEach(sl => {
      receivable += (sl.qtyL * sl.unitPrice);
    });
  });
  state.payments.filter(p => p.customerId === customerId).forEach(p => {
    receivable -= p.amount;
  });
  state.returns.filter(r => r.customerId === customerId && r.type === ReturnType.CUSTOMER).forEach(r => {
    receivable -= (r.qty * r.unitPriceAtReturn);
  });
  return receivable;
};
