import React, { useState, useMemo } from 'react';
import { ProcessedInvoice, POUserRecord } from '../types';
import { UserCheck, Copy, X, Mail, Send, Search, Loader2 } from 'lucide-react';

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

const POTable: React.FC<POTableProps> = ({ poRecords, invoiceData, vendorName }) => {
  const [poSearch, setPOSearch] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<POUserRecord | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Get unique vendor names from filtered invoices
  const invoiceVendorNames = useMemo(() => {
    return new Set(invoiceData.map(d => d.Vendor_Name.toLowerCase().trim()));
  }, [invoiceData]);

  // Filter PO records to only those whose vendor matches the filtered invoices
  const matchedPOs = useMemo(() => {
    return poRecords.filter(po => {
      const poVendor = po.vendorName.toLowerCase().trim();
      if (!poVendor) return false;
      for (const invVendor of invoiceVendorNames) {
        if (invVendor === poVendor || invVendor.includes(poVendor) || poVendor.includes(invVendor)) {
          return true;
        }
      }
      return false;
    });
  }, [poRecords, invoiceVendorNames]);

  // Filter POs by search term (supports * wildcard)
  const filteredPOs = useMemo(() => {
    if (!poSearch.trim()) return matchedPOs;
    const escaped = poSearch.trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    try {
      const regex = new RegExp(escaped, 'i');
      return matchedPOs.filter(po =>
        regex.test(po.poNumber) ||
        regex.test(po.vendorName) ||
        regex.test(po.createdBy) ||
        regex.test(buildEmail(po.createdBy)) ||
        regex.test(po.documentNumber)
      );
    } catch {
      return matchedPOs;
    }
  }, [matchedPOs, poSearch]);

  /**
   * When clicking email on a PO row:
   * 1. Find all POs for this vendor
   * 2. Sort by issue date (Col A) ascending
   * 3. Take the LAST created by (most recent)
   * 4. Build email as name@saniikos.com
   */
  const openEmailModal = (po: POUserRecord) => {
    // Find all POs for the same vendor
    const vendorPOs = matchedPOs.filter(p => {
      const a = p.vendorName.toLowerCase().trim();
      const b = po.vendorName.toLowerCase().trim();
      return a === b || a.includes(b) || b.includes(a);
    });

    // Sort by issue date ascending (oldest first), nulls go to start
    const sorted = [...vendorPOs].sort((a, b) => {
      if (!a.issueDate && !b.issueDate) return 0;
      if (!a.issueDate) return -1;
      if (!b.issueDate) return 1;
      return a.issueDate.getTime() - b.issueDate.getTime();
    });

    // Take the last one (most recent by issue date)
    const lastPO = sorted.length > 0 ? sorted[sorted.length - 1] : po;
    const email = buildEmail(lastPO.createdBy);

    setSelectedPO(lastPO);
    setResolvedEmail(email);
    setEmailModalOpen(true);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedPO(null);
    setResolvedEmail('');
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const generateEmail = async () => {
    if (!selectedPO) return;
    setError('');
    setEmailBody('');
    setLoading(true);

    // Find all POs from this vendor
    const vendorPOs = matchedPOs.filter(p => {
      const a = p.vendorName.toLowerCase().trim();
      const b = selectedPO.vendorName.toLowerCase().trim();
      return a === b || a.includes(b) || b.includes(a);
    });

    // Find ONLY blocked invoices matching these PO vendors
    const blockedInvoices = invoiceData.filter(inv => {
      if (!inv.Col_BS.toLowerCase().includes('block')) return false;
      return vendorPOs.some(po => {
        const poVendor = po.vendorName.toLowerCase().trim();
        const invVendor = inv.Vendor_Name.toLowerCase().trim();
        return invVendor === poVendor || invVendor.includes(poVendor) || poVendor.includes(invVendor);
      });
    });

    if (blockedInvoices.length === 0) {
      setError('No blocked invoices found for this vendor.');
      setLoading(false);
      return;
    }

    // Build invoice details for the prompt
    const invoiceLines = blockedInvoices.map(d =>
      `- Invoice #${d.Invoice_Number || 'N/A'}, Vendor: ${d.Vendor_Name}, Entity: ${d.Entity || 'N/A'}, Amount: €${d.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ).join('\n');

    const totalAmount = blockedInvoices.reduce((sum, d) => sum + d.Open_Amount, 0);

    const prompt = `Write a short, professional email from the Accounts Payable department to ${selectedPO.createdBy}.

The email must say: We have invoices blocked for payment that are correlated with your Purchase Order. Please provide the PO number so we can sync it, and ensure that you have provided certification (CER) approval.

Include this list of blocked invoices in a clean table format:
${invoiceLines}

Total blocked amount: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${blockedInvoices.length} invoice${blockedInvoices.length > 1 ? 's' : ''})

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

  const handleCopy = () => {
    const emailWithRecipient = resolvedEmail
      ? `To: ${resolvedEmail}\n\n${emailBody}`
      : emailBody;
    navigator.clipboard.writeText(emailWithRecipient);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (matchedPOs.length === 0) {
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
            PO Users ({filteredPOs.length}{filteredPOs.length !== matchedPOs.length ? ` / ${matchedPOs.length}` : ''} records)
          </h3>
          <div className="flex items-center gap-2">
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
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Doc #</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredPOs.slice(0, 100).map((po, idx) => (
                <tr key={`po-${idx}`} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-slate-300">
                    {po.poNumber || '-'}
                  </td>
                  <td className="px-4 py-2 font-medium text-white truncate max-w-[200px]" title={po.vendorName}>
                    {po.vendorName || '-'}
                  </td>
                  <td className="px-4 py-2 text-emerald-300 truncate max-w-[150px]" title={po.createdBy}>
                    {po.createdBy || '-'}
                  </td>
                  <td className="px-4 py-2 text-blue-300 text-xs truncate max-w-[200px]" title={buildEmail(po.createdBy)}>
                    {po.createdBy ? buildEmail(po.createdBy) : '-'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-300 truncate max-w-[120px]" title={po.documentNumber}>
                    {po.documentNumber || '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => openEmailModal(po)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                      title={`Send email to ${buildEmail(po.createdBy)}`}
                    >
                      <Send size={12} /> Email
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPOs.length > 100 && (
          <div className="text-center text-xs text-slate-500 mt-4 italic">
            Showing first 100 of {filteredPOs.length} PO records.
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-cinzel text-emerald-400 flex items-center gap-2">
                <Send size={22} /> Email to PO User
              </h2>
              <button onClick={closeEmailModal} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">

              {/* PO User Info */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                <p><span className="text-slate-300 font-medium">PO Owner:</span> <span className="text-emerald-300">{selectedPO.createdBy}</span></p>
                <p><span className="text-slate-300 font-medium">Email:</span> <span className="text-blue-300">{resolvedEmail || 'Not available'}</span></p>
                <p><span className="text-slate-300 font-medium">PO Number:</span> {selectedPO.poNumber || 'N/A'}</p>
                <p><span className="text-slate-300 font-medium">Vendor:</span> {selectedPO.vendorName}</p>
              </div>

              {/* Generate Email Button */}
              {!emailBody && !loading && (
                <button
                  onClick={() => generateEmail()}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl transition-colors font-bold text-sm"
                >
                  <Send size={16} /> Generate Email
                </button>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={40} className="text-emerald-500 animate-spin" />
                  <p className="text-emerald-400 font-cinzel animate-pulse">Generating email...</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Generated Email */}
              {emailBody && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-300">
                      Generated Email for {selectedPO.createdBy}
                    </label>
                    <button
                      onClick={() => { setEmailBody(''); setError(''); }}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>

                  {resolvedEmail && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700 rounded-lg p-2">
                      <Mail size={14} /> To: {resolvedEmail}
                    </div>
                  )}

                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar leading-relaxed">
                    {emailBody}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl transition-colors font-bold text-sm"
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
