import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ProcessedInvoice, POUserRecord } from '../types';
import { UserCheck, Copy, X, Mail, Send, Search, Loader2, Users, ChevronDown, ChevronUp, ChevronsUpDown, Filter, FileSpreadsheet } from 'lucide-react';

interface POTableProps {
  poRecords: POUserRecord[];
  invoiceData: ProcessedInvoice[];
  vendorName: string | null;
}

/** Convert "John Smith" → "john.smith@saniikos.com" */
const buildEmail = (name: string): string => {
  if (!name.trim()) return '';
  return name.trim().toLowerCase().replace(/\s+/g, '.') + '@saniikos.com';
};

/** Find the newest PO user for a given list (sorted by issue date Col A) */
const getNewestPOUser = (pos: POUserRecord[]): POUserRecord | null => {
  if (pos.length === 0) return null;
  const sorted = [...pos].sort((a, b) => {
    if (!a.issueDate && !b.issueDate) return 0;
    if (!a.issueDate) return -1;
    if (!b.issueDate) return 1;
    return a.issueDate.getTime() - b.issueDate.getTime();
  });
  return sorted[sorted.length - 1];
};

/** Fuzzy vendor match — by name OR by VAT ID embedded in PO vendor string */
const vendorsMatch = (poVendor: string, invVendor: string, invVatId?: string): boolean => {
  const la = poVendor.toLowerCase().trim();
  const lb = invVendor.toLowerCase().trim();
  // Direct name match
  if (la === lb || la.includes(lb) || lb.includes(la)) return true;
  // VAT ID match: PO vendor often starts with "998771872 - VENDOR NAME"
  if (invVatId) {
    const vatClean = invVatId.trim();
    if (vatClean && la.includes(vatClean.toLowerCase())) return true;
  }
  // Extract numeric prefix from PO vendor (e.g. "998771872 - INTTRUST" → "998771872")
  const poNumericPrefix = la.match(/^(\d{6,})/);
  if (poNumericPrefix && invVatId) {
    if (invVatId.trim().includes(poNumericPrefix[1])) return true;
  }
  return false;
};

/** PO entity code → Main Ledger entity code mapping (where they differ) */
const ENTITY_ALIAS: Record<string, string> = {
  'ISHM': 'HQ',
};

/**
 * Extract entity code from PO doc number or PO number, mapped to ledger entity.
 * Patterns seen:
 *   POR-OP-IPP IT-000023  → IPP
 *   EXR_OP-IPP IT-...     → IPP
 *   EXR-ISHM HR-00...     → HQ  (ISHM maps to HQ in ledger)
 *   POR-IAN HR-00...      → IAN
 */
const extractEntityFromDoc = (docNumber: string): string => {
  if (!docNumber) return '';
  // Take everything before the first space (the prefix part)
  const prefix = docNumber.trim().split(/\s+/)[0]; // e.g. "POR-OP-IPP" or "EXR_OP-IPP" or "EXR-ISHM"
  // Split by - or _
  const segments = prefix.split(/[-_]/); // ["POR","OP","IPP"] or ["EXR","ISHM"]
  // Find the last segment that is purely alphabetic (2-6 chars) — that's the entity
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].trim();
    if (/^[A-Z]{2,6}$/i.test(seg)) {
      // Skip common prefixes that aren't entities
      const upper = seg.toUpperCase();
      if (['POR', 'EXR', 'OP', 'ADM'].includes(upper)) continue;
      // Map to ledger entity name if alias exists (e.g. ISHM → HQ)
      return ENTITY_ALIAS[upper] || upper;
    }
  }
  return '';
};

type ModalMode = 'general' | 'vendor';

interface VendorEntityRow {
  vendor: string;
  entity: string;
  newestUser: POUserRecord;
  email: string;
  matchedPOsForRow: POUserRecord[];
}

const POTable: React.FC<POTableProps> = ({ poRecords, invoiceData, vendorName }) => {
  const [poSearch, setPOSearch] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('vendor');
  const [selectedRow, setSelectedRow] = useState<VendorEntityRow | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTo, setCopiedTo] = useState(false);
  const [error, setError] = useState('');
  const [generalRecipients, setGeneralRecipients] = useState<{ name: string; email: string; vendor: string; entity: string }[]>([]);

  // Sorting state
  type SortKey = 'poNumber' | 'vendor' | 'entity' | 'createdBy' | 'email' | 'docNumber';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // PO Owner filter state
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setOwnerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build a map: Document_Number → Entity (from invoices)
  const docToEntity = useMemo(() => {
    const map = new Map<string, string>();
    invoiceData.forEach(inv => {
      if (inv.Document_Number) {
        map.set(inv.Document_Number.trim(), inv.Entity || '');
      }
    });
    return map;
  }, [invoiceData]);

  // Build invoice lookup: array of { vendorName, vatId, entity } for matching
  const invoiceVendorList = useMemo(() => {
    const seen = new Set<string>();
    const list: { vendorName: string; vatId: string; entity: string }[] = [];
    invoiceData.forEach(inv => {
      const key = `${inv.Vendor_Name}|||${inv.VAT_ID}|||${inv.Entity}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ vendorName: inv.Vendor_Name, vatId: inv.VAT_ID || '', entity: inv.Entity || '' });
      }
    });
    return list;
  }, [invoiceData]);

  // Build set of entities that exist in the current filtered invoices (globally)
  const activeEntities = useMemo(() => {
    const s = new Set<string>();
    invoiceData.forEach(inv => {
      if (inv.Entity) s.add(inv.Entity.toUpperCase().trim());
    });
    return s;
  }, [invoiceData]);

  // Match PO records to invoices using vendor name OR VAT ID, then filter by entity
  // Returns matched invoice vendor name for consistent grouping
  const matchedPOsWithEntity = useMemo(() => {
    const results: { po: POUserRecord; entity: string; invoiceVendor: string }[] = [];
    poRecords.forEach(po => {
      const poVendor = po.vendorName.trim();
      if (!poVendor) return;

      // Check vendor matches any invoice vendor (by name or VAT ID)
      let matchedInvVendor = '';
      for (const inv of invoiceVendorList) {
        if (vendorsMatch(poVendor, inv.vendorName, inv.vatId)) {
          matchedInvVendor = inv.vendorName;
          break;
        }
      }
      if (!matchedInvVendor) return;

      // Extract entity from PO doc number AND PO number
      let entity = extractEntityFromDoc(po.documentNumber) || extractEntityFromDoc(po.poNumber);

      // If we extracted an entity, check it exists in the current filtered invoices
      // If it doesn't match, skip — this PO belongs to a different entity
      if (entity && !activeEntities.has(entity)) {
        return;
      }

      // If no entity extracted, try to match via invoice Document_Number lookup
      if (!entity && po.documentNumber) {
        entity = (docToEntity.get(po.documentNumber.trim()) || '').toUpperCase().trim();
      }

      // Last fallback: if only one entity in active invoices, use it
      if (!entity && activeEntities.size === 1) {
        entity = [...activeEntities][0];
      }

      results.push({ po, entity, invoiceVendor: matchedInvVendor });
    });
    return results;
  }, [poRecords, invoiceVendorList, activeEntities, docToEntity]);

  // Group by INVOICE vendor name + entity → ONE row per vendor per entity
  const vendorEntityRows = useMemo(() => {
    const groupMap = new Map<string, { pos: POUserRecord[]; vendor: string; entity: string }>();
    matchedPOsWithEntity.forEach(({ po, entity, invoiceVendor }) => {
      // Use the invoice vendor name (consistent) as group key, not PO vendor name (varies)
      const key = `${invoiceVendor.toLowerCase().trim()}|||${entity.toLowerCase().trim()}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { pos: [], vendor: invoiceVendor, entity });
      }
      groupMap.get(key)!.pos.push(po);
    });

    const result: VendorEntityRow[] = [];
    groupMap.forEach(({ pos, vendor, entity }) => {
      const newest = getNewestPOUser(pos);
      if (newest && newest.createdBy) {
        result.push({
          vendor: newest.vendorName,
          entity,
          newestUser: newest,
          email: buildEmail(newest.createdBy),
          matchedPOsForRow: pos,
        });
      }
    });
    return result;
  }, [matchedPOsWithEntity]);

  // Unique PO owner names for the dropdown filter
  const uniqueOwners = useMemo(() => {
    const names = new Set<string>();
    vendorEntityRows.forEach(({ newestUser }) => {
      if (newestUser.createdBy) names.add(newestUser.createdBy.trim());
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [vendorEntityRows]);

  // Filter rows by search term (supports * wildcard) + owner filter
  const filteredVendorRows = useMemo(() => {
    let rows = vendorEntityRows;

    // Apply PO Owner dropdown filter
    if (ownerFilter) {
      rows = rows.filter(({ newestUser }) =>
        newestUser.createdBy.trim() === ownerFilter
      );
    }

    // Apply search filter
    if (poSearch.trim()) {
      const escaped = poSearch.trim()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      try {
        const regex = new RegExp(escaped, 'i');
        rows = rows.filter(({ vendor, newestUser, email, entity }) =>
          regex.test(newestUser.poNumber) ||
          regex.test(vendor) ||
          regex.test(newestUser.createdBy) ||
          regex.test(email) ||
          regex.test(newestUser.documentNumber) ||
          regex.test(entity)
        );
      } catch {
        // invalid regex, skip search filter
      }
    }

    // Apply sorting
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let valA = '';
        let valB = '';
        switch (sortKey) {
          case 'poNumber':
            valA = a.newestUser.poNumber || '';
            valB = b.newestUser.poNumber || '';
            break;
          case 'vendor':
            valA = a.vendor || '';
            valB = b.vendor || '';
            break;
          case 'entity':
            valA = a.entity || '';
            valB = b.entity || '';
            break;
          case 'createdBy':
            valA = a.newestUser.createdBy || '';
            valB = b.newestUser.createdBy || '';
            break;
          case 'email':
            valA = a.email || '';
            valB = b.email || '';
            break;
          case 'docNumber':
            valA = a.newestUser.documentNumber || '';
            valB = b.newestUser.documentNumber || '';
            break;
        }
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [vendorEntityRows, poSearch, ownerFilter, sortKey, sortDir]);

  // Toggle sort when clicking a column header
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Sort icon helper
  const SortIcon: React.FC<{ colKey: SortKey }> = ({ colKey }) => {
    if (sortKey !== colKey) return <ChevronsUpDown size={12} className="text-slate-600 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-emerald-400 ml-1 inline" />
      : <ChevronDown size={12} className="text-emerald-400 ml-1 inline" />;
  };

  // ==================== GENERAL EMAIL (Email All) ====================
  const openGeneralEmailModal = () => {
    const seen = new Set<string>();
    const recipients: { name: string; email: string; vendor: string; entity: string }[] = [];
    vendorEntityRows.forEach(({ newestUser, email, vendor, entity }) => {
      const dedupeKey = `${email}|||${entity}`;
      if (email && !seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        recipients.push({ name: newestUser.createdBy, email, vendor, entity });
      }
    });

    setGeneralRecipients(recipients);
    setModalMode('general');
    setSelectedRow(null);
    setResolvedEmail(recipients.map(r => r.email).join('; '));
    setEmailModalOpen(true);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const generateGeneralEmail = () => {
    if (generalRecipients.length === 0) {
      setError('No PO users found.');
      return;
    }

    const lines = [
      `Dear Colleague,`,
      ``,
      `We have invoices blocked for payment that are related to Purchase Orders under your name.`,
      ``,
      `In order to unblock and proceed with payment, please provide the corresponding PO number(s) so we can sync them, and confirm that Certification (CER) approval has been granted.`,
      ``,
      `Kind regards,`,
      `Accounts Payable Department`,
    ];

    setEmailBody(lines.join('\n'));
  };

  // ==================== VENDOR-SPECIFIC EMAIL ====================
  const openVendorEmailModal = (row: VendorEntityRow) => {
    setModalMode('vendor');
    setSelectedRow(row);
    setResolvedEmail(row.email);
    setGeneralRecipients([]);
    setEmailModalOpen(true);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const generateVendorEmail = async () => {
    if (!selectedRow) return;
    setError('');
    setEmailBody('');
    setLoading(true);

    // Get blocked invoices for this vendor AND entity
    const blockedInvoices = invoiceData.filter(inv => {
      if (!inv.Col_BS.toLowerCase().includes('block')) return false;
      if (!vendorsMatch(selectedRow.vendor, inv.Vendor_Name, inv.VAT_ID)) return false;
      // Entity must match
      if (selectedRow.entity && inv.Entity) {
        return inv.Entity.toUpperCase().trim() === selectedRow.entity.toUpperCase().trim();
      }
      return true;
    });

    if (blockedInvoices.length === 0) {
      setError('No blocked invoices found for this vendor/entity.');
      setLoading(false);
      return;
    }

    const invoiceLines = blockedInvoices.map(d =>
      `- Invoice #${d.Invoice_Number || 'N/A'}, Vendor: ${d.Vendor_Name}, Entity: ${d.Entity || 'N/A'}, Amount: \u20AC${d.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ).join('\n');

    const totalAmount = blockedInvoices.reduce((sum, d) => sum + d.Open_Amount, 0);

    const prompt = `Write a short, professional email from the Accounts Payable department to ${selectedRow.newestUser.createdBy}.

The email must say: We have invoices blocked for payment that are related to Purchase Orders under your name. In order to unblock and proceed with payment, please provide the corresponding PO number(s) so we can sync them, and confirm that Certification (CER) approval has been granted. Both actions are required.

Include this list of blocked invoices in a clean table format:
${invoiceLines}

Total blocked amount: \u20AC${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${blockedInvoices.length} invoice${blockedInvoices.length > 1 ? 's' : ''})

Rules:
- Maximum 8 lines excluding the table
- Professional but concise AP style
- Sign as "Accounts Payable Department"
- Do NOT add a subject line
- Include the invoice table with columns: Invoice #, Vendor, Entity, Amount`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${res.status}`);
      }

      const result = await res.json();
      const text = result.content?.[0]?.text || '';
      setEmailBody(text.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to generate email.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== SHARED ====================
  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedRow(null);
    setResolvedEmail('');
    setEmailBody('');
    setError('');
    setCopied(false);
    setCopiedTo(false);
    setGeneralRecipients([]);
  };

  // ==================== EXPORT EXCEL ====================
  const handleDownloadExcel = () => {
    const rows = filteredVendorRows.map(row => ({
      'PO Number': row.newestUser.poNumber || '',
      'Vendor': row.vendor || '',
      'Entity': row.entity || '',
      'Created By': row.newestUser.createdBy || '',
      'Email': row.email || '',
      'Doc #': row.newestUser.documentNumber || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key]).length).slice(0, 50)) + 2
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PO Users');
    XLSX.writeFile(wb, `po_users_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (matchedPOsWithEntity.length === 0) {
    return (
      <div className="bg-slate-800 border border-emerald-700/30 rounded-xl p-6 shadow-lg">
        <h3 className="text-white font-cinzel text-lg flex items-center gap-2 mb-3">
          <UserCheck size={20} className="text-emerald-400" />
          PO Users
        </h3>
        <p className="text-slate-500 text-sm italic">No PO records match the current filtered vendors.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-800 border border-emerald-700/30 rounded-xl p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-white font-cinzel text-lg flex items-center gap-2">
            <UserCheck size={20} className="text-emerald-400" />
            PO Users ({filteredVendorRows.length} vendor{filteredVendorRows.length !== 1 ? 's' : ''})
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={openGeneralEmailModal}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-colors font-bold shadow-md"
              title="Send generic email to all newest PO users"
            >
              <Users size={14} /> Email All ({vendorEntityRows.length})
            </button>
            <button
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg transition-colors font-bold shadow-md"
              title="Export current view as Excel"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>

            {/* PO Owner dropdown filter */}
            <div className="relative" ref={ownerDropdownRef}>
              <button
                onClick={() => setOwnerDropdownOpen(!ownerDropdownOpen)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  ownerFilter
                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                <Filter size={13} />
                {ownerFilter || 'PO Owner'}
                <ChevronDown size={13} className={`transition-transform ${ownerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {ownerDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-56 max-h-64 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => { setOwnerFilter(''); setOwnerDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      !ownerFilter ? 'bg-emerald-900/30 text-emerald-300' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    All Owners
                  </button>
                  {uniqueOwners.map(name => (
                    <button
                      key={name}
                      onClick={() => { setOwnerFilter(name); setOwnerDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        ownerFilter === name ? 'bg-emerald-900/30 text-emerald-300' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ownerFilter && (
              <button
                onClick={() => setOwnerFilter('')}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Clear owner filter"
              >
                ✕
              </button>
            )}

            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search PO (e.g. 450* or *john*)"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5 w-64 focus:border-emerald-500 outline-none placeholder:text-slate-600"
              value={poSearch}
              onChange={(e) => setPOSearch(e.target.value)}
            />
            {poSearch && (
              <button
                onClick={() => setPOSearch('')}
                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-900 text-slate-200 uppercase font-medium text-xs">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('poNumber')}>
                  PO Number <SortIcon colKey="poNumber" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('vendor')}>
                  Vendor <SortIcon colKey="vendor" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('entity')}>
                  Entity <SortIcon colKey="entity" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('createdBy')}>
                  Created By <SortIcon colKey="createdBy" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('email')}>
                  Email <SortIcon colKey="email" />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-emerald-400 transition-colors" onClick={() => handleSort('docNumber')}>
                  Doc # <SortIcon colKey="docNumber" />
                </th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredVendorRows.slice(0, 100).map((row, idx) => (
                <tr key={`po-ve-${idx}`} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-slate-300">
                    {row.newestUser.poNumber || '-'}
                  </td>
                  <td className="px-4 py-2 font-medium text-white truncate max-w-[200px]" title={row.vendor}>
                    {row.vendor || '-'}
                  </td>
                  <td className="px-4 py-2 text-amber-300 text-xs font-semibold">
                    {row.entity || '-'}
                  </td>
                  <td className="px-4 py-2 text-emerald-300 truncate max-w-[150px]" title={row.newestUser.createdBy}>
                    {row.newestUser.createdBy || '-'}
                  </td>
                  <td className="px-4 py-2 text-blue-300 text-xs truncate max-w-[200px]" title={row.email}>
                    {row.email || '-'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-300 truncate max-w-[120px]" title={row.newestUser.documentNumber}>
                    {row.newestUser.documentNumber || '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => openVendorEmailModal(row)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                      title={`Send email for ${row.vendor} (${row.entity})`}
                    >
                      <Send size={12} /> Email
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVendorRows.length > 100 && (
          <div className="text-center text-xs text-slate-500 mt-4 italic">
            Showing first 100 of {filteredVendorRows.length} vendors.
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-cinzel text-emerald-400 flex items-center gap-2">
                {modalMode === 'general'
                  ? <><Users size={22} /> Email All PO Users</>
                  : <><Send size={22} /> Email to PO User</>
                }
              </h2>
              <button onClick={closeEmailModal} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-5">

              {modalMode === 'general' ? (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium mb-2">Recipients ({generalRecipients.length} unique PO users):</p>
                  <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
                    {generalRecipients.map((r, i) => (
                      <p key={i}>
                        <span className="text-emerald-300">{r.name}</span>
                        <span className="text-slate-500 mx-1">—</span>
                        <span className="text-blue-300">{r.email}</span>
                        <span className="text-amber-300 ml-1">[{r.entity || '?'}]</span>
                        <span className="text-slate-600 ml-1">({r.vendor})</span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : selectedRow && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                  <p><span className="text-slate-300 font-medium">PO Owner:</span> <span className="text-emerald-300">{selectedRow.newestUser.createdBy}</span></p>
                  <p><span className="text-slate-300 font-medium">Email:</span> <span className="text-blue-300">{resolvedEmail || 'Not available'}</span></p>
                  <p><span className="text-slate-300 font-medium">Entity:</span> <span className="text-amber-300">{selectedRow.entity || 'N/A'}</span></p>
                  <p><span className="text-slate-300 font-medium">PO Number:</span> {selectedRow.newestUser.poNumber || 'N/A'}</p>
                  <p><span className="text-slate-300 font-medium">Vendor:</span> {selectedRow.vendor}</p>
                </div>
              )}

              {!emailBody && !loading && (
                <button
                  onClick={() => modalMode === 'general' ? generateGeneralEmail() : generateVendorEmail()}
                  className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl transition-colors font-bold text-sm ${
                    modalMode === 'general'
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  <Send size={16} /> Generate Email
                </button>
              )}

              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={40} className="text-emerald-500 animate-spin" />
                  <p className="text-emerald-400 font-cinzel animate-pulse">Generating email...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {emailBody && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-300">
                      {modalMode === 'general' ? 'Generic Email' : `Email for ${selectedRow?.newestUser.createdBy} [${selectedRow?.entity || '?'}]`}
                    </label>
                    <button
                      onClick={() => { setEmailBody(''); setError(''); }}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>

                  {resolvedEmail && (
                    <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700 rounded-lg p-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Mail size={14} className="flex-shrink-0" />
                        <span className="truncate">To: {resolvedEmail}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`To: ${resolvedEmail}`);
                          setCopiedTo(true);
                          setTimeout(() => setCopiedTo(false), 2000);
                        }}
                        className="flex-shrink-0 ml-2 inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded transition-colors"
                      >
                        <Copy size={12} />
                        {copiedTo ? 'Copied!' : 'Copy To'}
                      </button>
                    </div>
                  )}

                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar leading-relaxed">
                    {emailBody}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl transition-colors font-bold text-sm ${
                      modalMode === 'general'
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Copy size={16} />
                    {copied ? 'Copied to Clipboard!' : 'Copy Email to Clipboard'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default POTable;
