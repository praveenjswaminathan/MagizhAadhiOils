
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

/**
 * Robustly load state by mapping snake_case DB fields back to camelCase frontend fields.
 */
export const loadState = async (): Promise<AppState> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : INITIAL_STATE;
  }

  console.log("Loading state from Supabase for user:", session.user.id);

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

    // Check for critical errors
    if (productsRes.error) throw productsRes.error;

    // Map data back to AppState interface
    const state: AppState = {
      hubs: (hubsRes.data || []).map(h => ({ id: h.id, name: h.name, address: h.address })),
      customers: (customersRes.data || []).map(c => ({ id: c.id, salutation: c.salutation, name: c.name, phone: c.phone, notes: c.notes })),
      products: (productsRes.data || []).map(p => ({ id: p.id, name: p.name })),
      priceHistory: (priceHistoryRes.data || []).map(ph => ({
        id: ph.id,
        productId: ph.product_id,
        effectiveDate: ph.effective_date,
        unitPrice: Number(ph.unit_price)
      })),
      consignments: (consignmentsRes.data || []).map(c => ({
        id: c.id,
        consignmentNo: c.consignment_no,
        receiveDate: c.receive_date,
        toHubId: c.to_hub_id,
        transportCost: Number(c.transport_cost),
        notes: c.notes,
        createdBy: c.created_by
      })),
      consignmentLines: (consignmentLinesRes.data || []).map(cl => ({
        id: cl.id,
        consignmentId: cl.consignment_id,
        productId: cl.product_id,
        qtyL: Number(cl.qty_l),
        unitPrice: Number(cl.unit_price)
      })),
      sales: (salesRes.data || []).map(s => ({
        id: s.id,
        saleNo: s.sale_no,
        saleDate: s.sale_date,
        hubId: s.hub_id,
        customerId: s.customer_id,
        reimbursementAmount: Number(s.reimbursement_amount),
        notes: s.notes,
        createdBy: s.created_by
      })),
      saleLines: (saleLinesRes.data || []).map(sl => ({
        id: sl.id,
        saleId: sl.sale_id,
        productId: sl.product_id,
        qtyL: Number(sl.qty_l),
        unitPrice: Number(sl.unit_price)
      })),
      payments: (paymentsRes.data || []).map(p => ({
        id: p.id,
        customerId: p.customer_id,
        paymentDate: p.payment_date,
        amount: Number(p.amount),
        mode: p.mode,
        reference: p.reference,
        notes: p.notes
      })),
      returns: (returnsRes.data || []).map(r => ({
        id: r.id,
        date: r.date,
        type: r.type as any,
        hubId: r.hub_id,
        customerId: r.customer_id,
        saleLineId: r.sale_line_id,
        productId: r.product_id,
        qty: Number(r.qty),
        unitPriceAtReturn: Number(r.unit_price_at_return),
        notes: r.notes
      }))
    };

    // If a brand new user has no products yet, we MUST return INITIAL_STATE to seed them
    if (state.products.length === 0) {
      console.log("No products found in DB, seeding with INITIAL_STATE");
      return INITIAL_STATE;
    }

    return state;
  } catch (error) {
    console.error("Supabase load failed, falling back to local storage:", error);
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : INITIAL_STATE;
  }
};

/**
 * Sequential save ensures parent records exist before children are upserted.
 */
export const saveState = async (state: AppState) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;
  console.log("Syncing state to Supabase for user:", userId);

  try {
    // 1. Save Core Entities (No FK dependencies)
    const baseResults = await Promise.all([
      supabase.from('hubs').upsert(state.hubs.map(h => ({ id: h.id, user_id: userId, name: h.name, address: h.address }))),
      supabase.from('customers').upsert(state.customers.map(c => ({ id: c.id, user_id: userId, salutation: c.salutation, name: c.name, phone: c.phone, notes: c.notes }))),
      supabase.from('products').upsert(state.products.map(p => ({ id: p.id, user_id: userId, name: p.name }))),
    ]);
    
    const baseError = baseResults.find(r => r.error);
    if (baseError) throw baseError.error;

    // 2. Save Price History & Transaction Parents (Require Products/Hubs/Customers)
    const transactionResults = await Promise.all([
      supabase.from('price_history').upsert(state.priceHistory.map(ph => ({ 
        id: ph.id, user_id: userId, product_id: ph.productId, effective_date: ph.effectiveDate, unit_price: ph.unitPrice 
      }))),
      supabase.from('consignments').upsert(state.consignments.map(c => ({
        id: c.id, user_id: userId, consignment_no: c.consignmentNo, receive_date: c.receiveDate, to_hub_id: c.toHubId, transport_cost: c.transportCost, notes: c.notes, created_by: c.createdBy
      }))),
      supabase.from('sales').upsert(state.sales.map(s => ({
        id: s.id, user_id: userId, sale_no: s.saleNo, sale_date: s.saleDate, hub_id: s.hubId, customer_id: s.customerId, reimbursement_amount: s.reimbursementAmount, notes: s.notes, created_by: s.createdBy
      }))),
      supabase.from('payments').upsert(state.payments.map(p => ({
        id: p.id, user_id: userId, customer_id: p.customerId, payment_date: p.paymentDate, amount: p.amount, mode: p.mode, reference: p.reference, notes: p.notes
      }))),
      supabase.from('returns').upsert(state.returns.map(r => ({
        id: r.id, user_id: userId, date: r.date, type: r.type, hub_id: r.hubId, customer_id: r.customerId, sale_line_id: r.saleLineId, product_id: r.productId, qty: r.qty, unit_price_at_return: r.unitPriceAtReturn, notes: r.notes
      })))
    ]);

    const transError = transactionResults.find(r => r.error);
    if (transError) throw transError.error;

    // 3. Save Children (Line items require parents to be committed)
    const lineResults = await Promise.all([
      supabase.from('consignment_lines').upsert(state.consignmentLines.map(cl => ({
        id: cl.id, consignment_id: cl.consignmentId, product_id: cl.productId, qty_l: cl.qtyL, unit_price: cl.unitPrice
      }))),
      supabase.from('sale_lines').upsert(state.saleLines.map(sl => ({
        id: sl.id, sale_id: sl.saleId, product_id: sl.productId, qty_l: sl.qtyL, unit_price: sl.unitPrice
      })))
    ]);

    const lineError = lineResults.find(r => r.error);
    if (lineError) throw lineError.error;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log("Sync complete!");
  } catch (error) {
    console.error("CRITICAL: Sync failed. Local data preserved, but Cloud not updated.", error);
    // We do NOT wipe local storage here to ensure the user doesn't lose their current session data
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
      batches.push({ qty: cl.qtyL, cost: cl.unitPrice, date: c.receiveDate });
    }
  });

  state.returns.filter(r => r.type === ReturnType.CUSTOMER && r.productId === productId).forEach(r => {
    if (hubId === 'all' || r.hubId === hubId) {
      batches.push({ qty: r.qty, cost: r.unitPriceAtReturn, date: r.date });
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
      for (const b of [...batches].reverse()) {
        if (returnQty <= 0) break;
        const deduct = Math.min(b.qty, returnQty);
        b.qty -= deduct;
        returnQty -= deduct;
      }
    }
  });

  const finalQty = batches.reduce((sum, b) => sum + b.qty, 0);
  const costValue = batches.reduce((sum, b) => sum + (b.qty * b.cost), 0);
  const oldestBatch = batches.find(b => b.qty > 0);
  const ageDays = oldestBatch ? Math.floor((new Date().getTime() - new Date(oldestBatch.date).getTime()) / 86400000) : 0;

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
