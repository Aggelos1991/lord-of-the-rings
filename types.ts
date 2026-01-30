export interface RawInvoice {
  Vendor_Name: string;
  VAT_ID: string;
  VAT_ID_clean: string; // normalized VAT for matching
  Due_Date: Date | null;
  Open_Amount: number;
  Invoice_Number: string; // Column K
  Vendor_Email: string;
  Account_Email: string;
  Col_AF: string; // Filter Yes/No
  Col_AH: string; // Filter Yes/No
  Col_AJ: string; // Filter Yes/No
  Col_AN: string; // Filter Yes/No
  Col_BS: string; // Block Status
  Business_Area: string;
}

export interface ProcessedInvoice extends RawInvoice {
  id: string; // unique ID for React keys
  Vendor_Type: string;
  Country: string;
  Country_Type: 'Spain' | 'Foreign';
  Status: 'Overdue' | 'Not Overdue';
  Days_Overdue: number;

  // Credit Notes fields
  CN_Number?: string;
  CN_Amount?: number;

  [key: string]: any;
}

export interface FilterState {
  country: 'All' | 'Spain' | 'Foreign';
  dateRange: [Date | null, Date | null];
  vendorSearch: string; // Wildcard search for vendor name
  invoiceSearch: string; // Wildcard search for invoice number (table-level)
  amountOperator: '>=' | '<=' | '=' | 'between' | 'all';
  amountValue: string;       // single value for >=, <=, =
  amountValueMin: string;    // min for "between"
  amountValueMax: string;    // max for "between"
  selectedVendorTypes: string[];
  selectedBFPStatus: string[];
  chartStatus: 'All Open' | 'Overdue Only' | 'Not Overdue Only';
  vendorGroup: string; // "Top 20", "Specific Name", etc.
  selectedVendor: string | null; // For drill-down
}

export interface VendorFile {
  id: number;
  vendor_name: string;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface VendorComment {
  id: number;
  vendor_name: string;
  comment: string;
  created_at: string;
}

export const CONFIG = {
  MAIN_SHEET: 'Outstanding Invoices IB',
  REF_SHEET: 'VR CHECK_Special vendors list',
  COUNTRY_SHEET: 'VENDOR LIST',
  MAIN_COLS_INDICES: [0, 1, 4, 6, 29, 30, 31, 33, 35, 39],
  MAIN_COL_NAMES: [
    'Vendor_Name', 'VAT_ID', 'Due_Date', 'Open_Amount',
    'Vendor_Email', 'Account_Email', 'Col_AF', 'Col_AH', 'Col_AJ', 'Col_AN'
  ]
};
