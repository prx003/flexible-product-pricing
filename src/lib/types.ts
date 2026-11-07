export type Role =
  | "Admin"
  | "Shop Owner"
  | "Manager"
  | "Cashier"
  | "Inventory Staff"
  | "Accountant";

export type Unit = "pcs" | "kg" | "g" | "l" | "ml" | "packet" | "box" | "dozen";

export const UNITS: Unit[] = ["pcs", "kg", "g", "l", "ml", "packet", "box", "dozen"];

export const ROLES: Role[] = [
  "Admin",
  "Shop Owner",
  "Manager",
  "Cashier",
  "Inventory Staff",
  "Accountant",
];

export interface Category {
  id?: number | undefined;
  name: string;
  description?: string | undefined;
  active: boolean;
}

export interface Brand {
  id?: number | undefined;
  name: string;
  description?: string | undefined;
  active: boolean;
}

export interface Product {
  id?: number | undefined;
  name: string;
  sku: string;
  barcode: string;
  categoryId: number;
  subcategory?: string | undefined;
  brandId: number;
  unit: Unit;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gst: number;
  hsn: string;
  stock: number;
  minStock: number;
  reorderLevel: number;
  batchNo?: string | undefined;
  mfgDate?: string | undefined;
  expiryDate?: string | undefined;
  supplierId?: number | undefined;
  shelf?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
  active: boolean;
  createdAt: string;
}

export interface Supplier {
  id?: number | undefined;
  name: string;
  company?: string | undefined;
  mobile: string;
  email?: string | undefined;
  gstin?: string | undefined;
  address?: string | undefined;
  openingBalance: number;
  balance: number;
}

export type Membership = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface Customer {
  id?: number | undefined;
  name: string;
  mobile: string;
  email?: string | undefined;
  address?: string | undefined;
  gstin?: string | undefined;
  type: "Retail" | "Wholesale" | "Staff";
  creditLimit: number;
  creditBalance: number;
  loyaltyPoints: number;
  wallet: number;
  membership: Membership;
  birthday?: string | undefined;
  createdAt: string;
}

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank Transfer" | "Credit" | "Split";

export interface SaleItem {
  productId: number;
  name: string;
  unit: Unit;
  qty: number;
  price: number;
  mrp: number;
  gst: number;
  hsn: string;
  discount: number;
  purchasePrice: number;
  total: number;
  returnedQty?: number | undefined;
}

export interface Sale {
  id?: number | undefined;
  invoiceNo: string;
  date: string;
  customerId?: number | undefined;
  customerName: string;
  customerMobile?: string | undefined;
  cashier: string;
  items: SaleItem[];
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  couponCode?: string | undefined;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
  profit: number;
  paymentMethod: PaymentMethod;
  payments: { method: PaymentMethod; amount: number }[];
  received: number;
  change: number;
  creditAmount: number;
  pointsEarned: number;
  pointsRedeemed: number;
  notes?: string | undefined;
  status: "completed" | "cancelled" | "returned" | "partially-returned";
}

export interface HeldBill {
  id?: number | undefined;
  ref: string;
  date: string;
  customerName: string;
  items: SaleItem[];
  note?: string | undefined;
}

export interface PurchaseItem {
  productId: number;
  name: string;
  qty: number;
  cost: number;
  gst: number;
  total: number;
}

export interface Purchase {
  id?: number | undefined;
  billNo: string;
  date: string;
  supplierId: number;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  status: "ordered" | "received" | "returned";
}

export interface SupplierPayment {
  id?: number | undefined;
  supplierId: number;
  date: string;
  amount: number;
  method: PaymentMethod;
  note?: string | undefined;
}

export interface StockMovement {
  id?: number | undefined;
  productId: number;
  productName: string;
  date: string;
  type:
    | "stock-in"
    | "stock-out"
    | "sale"
    | "purchase"
    | "adjustment"
    | "damaged"
    | "expired"
    | "wastage"
    | "return"
    | "transfer"
    | "audit";
  qty: number;
  before: number;
  after: number;
  note?: string | undefined;
  user: string;
}

export interface SalesReturn {
  id?: number | undefined;
  refNo: string;
  saleId: number;
  invoiceNo: string;
  date: string;
  customerName: string;
  items: { productId: number; name: string; qty: number; price: number; total: number }[];
  amount: number;
  reason: string;
  type: "full" | "partial";
  refundMethod: PaymentMethod;
}

export interface Expense {
  id?: number | undefined;
  date: string;
  category: "Rent" | "Electricity" | "Salary" | "Transport" | "Maintenance" | "Other";
  amount: number;
  paidTo?: string | undefined;
  method: PaymentMethod;
  note?: string | undefined;
  receipt?: string | undefined;
}

export type OfferType =
  | "percentage"
  | "fixed"
  | "product"
  | "category"
  | "brand"
  | "bogo"
  | "b2g1"
  | "combo"
  | "coupon"
  | "festival";

export interface Offer {
  id?: number | undefined;
  name: string;
  code?: string | undefined;
  type: OfferType;
  value: number;
  minBill: number;
  targetId?: number | undefined;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Employee {
  id?: number | undefined;
  name: string;
  mobile: string;
  email: string;
  password: string;
  role: Role;
  shift: "Morning" | "Evening" | "Full Day";
  salary: number;
  joinDate: string;
  active: boolean;
}

export interface ActivityLog {
  id?: number | undefined;
  date: string;
  user: string;
  action: string;
  details?: string | undefined;
}

export interface Settings {
  id?: number | undefined;
  shopName: string;
  logo?: string | undefined;
  address: string;
  mobile: string;
  email: string;
  gstin: string;
  invoicePrefix: string;
  nextInvoiceNo: number;
  currency: string;
  financialYear: string;
  gstEnabled: boolean;
  gstInclusive: boolean;
  interState: boolean;
  roundOff: boolean;
  loyaltyRate: number;
  pointValue: number;
  thermalWidth: 58 | 80;
  footerNote: string;
  wishes?: string | undefined;
  showWatermark?: boolean | undefined;
  notifications: boolean;
  upiId?: string | undefined;
}

export interface SyncItem {
  id?: number | undefined;
  date: string;
  entity: string;
  action: string;
  payload: string;
  synced: boolean;
}
