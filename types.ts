
export enum ProductType {
  GINGELLY_JAGGERY = 'நல்லெண்ணெய் (வெல்லம்) - Gingelly Oil (Jaggery)',
  COCONUT = 'தேங்காய் எண்ணெய் - Coconut Oil',
  GROUNDNUT = 'கடலை எண்ணெய் - Groundnut Oil',
  DEEPAM = 'தீப எண்ணெய் - Deepam Oil',
  CASTOR = 'விளக்கெண்ணெய் - Castor Oil',
  GINGELLY_PALM_SUGAR = 'நல்லெண்ணெய் (பனை வெல்லம்) - Gingelly Oil (Palm Sugar)'
}

export enum ReturnType {
  CUSTOMER = 'Customer Return',
  SUPPLIER = 'Return to Supplier'
}

export type PaymentType = 'PAYMENT' | 'REFUND';

export interface Hub {
  id: string;
  name: string;
  address?: string;
}

export interface Customer {
  id: string;
  name: string;
  salutation: string;
  phone?: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
}

export interface PriceHistory {
  id: string;
  productId: string;
  effectiveDate: string;
  unitPrice: number;
}

export interface Consignment {
  id: string;
  consignmentNo: string;
  receiveDate: string;
  toHubId: string;
  transportCost: number;
  notes?: string;
  createdBy?: string;
}

export interface ConsignmentLine {
  id: string;
  consignmentId: string;
  productId: string;
  qtyL: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  saleNo: string;
  saleDate: string;
  hubId: string;
  customerId: string;
  reimbursementAmount: number;
  notes?: string;
  createdBy?: string;
}

export interface SaleLine {
  id: string;
  saleId: string;
  productId: string;
  qtyL: number;
  unitPrice: number;
}

export interface Payment {
  id: string;
  paymentDate: string;
  customerId: string;
  amount: number;
  mode: string;
  type?: PaymentType;
  reference?: string;
  notes?: string;
  createdBy?: string;
}

export interface ReturnRecord {
  id: string;
  date: string;
  type: ReturnType;
  hubId: string;
  customerId?: string;
  referenceId?: string; // Links to Sale ID or Consignment ID
  productId: string;
  qty: number;
  unitPriceAtReturn: number;
  notes?: string;
  createdBy?: string;
}

export interface AppState {
  hubs: Hub[];
  customers: Customer[];
  products: Product[];
  priceHistory: PriceHistory[];
  consignments: Consignment[];
  consignmentLines: ConsignmentLine[];
  sales: Sale[];
  saleLines: SaleLine[];
  payments: Payment[];
  returns: ReturnRecord[];
  adminUsernames: string[];
  currentUser?: string;
}
