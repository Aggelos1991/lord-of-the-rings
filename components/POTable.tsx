import React, { useState, useMemo } from 'react';
import { ProcessedInvoice, POUserRecord } from '../types';
import { UserCheck, Copy, X, Globe, Mail, Send, Search } from 'lucide-react';

interface POTableProps {
  poRecords: POUserRecord[];
  invoiceData: ProcessedInvoice[];
  vendorName: string | null;
}

const POTable: React.FC<POTableProps> = ({ poRecords, invoiceData, vendorName }) => {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [apiKey] = useState(envKey);
  const [poSearch, setPOSearch] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<POUserRecord | null>(null);
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
      // Check for exact match or partial match (vendor name contains)
      for (const invVendor of invoiceVendorNames) {
        if (invVendor === poVendor || invVendor.includes(poVendor) || poVendor.includes(invVendor)) {
          return true;
        }
      }
      return false;
    });
  }, [poRecords, invoiceVendorNames]);

  // Group by PO Owner for the email generator
  const poOwners = useMemo(() => {
    const map = new Map<string, { createdBy: string; email: string; pos: POUserRecord[] }>();
    matchedPOs.forEach(po => {
      if (!po.createdBy) return;
      const key = po.createdBy.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { createdBy: po.createdBy, email: po.email, pos: [] });
      }
      map.get(key)!.pos.push(po);
    });
    return Array.from(map.values()).sort((a, b) => b.pos.length - a.pos.length);
  }, [matchedPOs]);

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
        regex.test(po.email) ||
        regex.test(po.documentNumber)
      );
    } catch {
      return matchedPOs;
    }
  }, [matchedPOs, poSearch]);

  const openEmailModal = (po: POUserRecord) => {
    setSelectedPO(po);
    setEmailModalOpen(true);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedPO(null);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const generateEmail = async (lang: 'english' | 'spanish') => {
    if (!selectedPO) return;
    setError('');
    setEmailBody('');

    const key = apiKey.trim();
    if (!key) {
      setError('No API key found. Configure VITE_ANTHROPIC_API_KEY in your environment or Vercel settings.');
      return;
    }

    setLoading(true);

    // Find all POs from the same owner
    const ownerPOs = matchedPOs.filter(p => p.createdBy.toLowerCase() === selectedPO.createdBy.toLowerCase());

    // Find blocked invoices from the invoice data matching these PO vendors
    const relatedInvoices = invoiceData.filter(inv => {
      return ownerPOs.some(po => {
        const poVendor = po.vendorName.toLowerCase().trim();
        const invVendor = inv.Vendor_Name.toLowerCase().trim();
        return invVendor === poVendor || invVendor.includes(poVendor) || poVendor.includes(invVendor);
      });
    });

    const poLines = ownerPOs.map(po =>
      `- PO: ${po.poNumber || 'N/A'}, Vendor: ${po.vendorName}, Doc#: ${po.documentNumber || 'N/A'}`
    ).join('\n');

    const invoiceLines = relatedInvoices.slice(0, 20).map(d =>
      `- Invoice ${d.Invoice_Number || 'N/A'}, Vendor: ${d.Vendor_Name}, Due: ${d.Due_Date?.toLocaleDateString() || 'N/A'}, Amount: €${d.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Status: ${d.Status}${d.Days_Overdue > 0 ? ` (${d.Days_Overdue} days overdue)` : ''}, Block Status: ${d.Col_BS}`
    ).join('\n');

    const totalAmount = relatedInvoices.reduce((sum, d) => sum + d.Open_Amount, 0);

    const prompt = lang === 'spanish'
      ? `Genera un email profesional e interno en ESPAÑOL para enviar a "${selectedPO.createdBy}" (email: ${selectedPO.email || 'no disponible'}) que es el responsable de la(s) Orden(es) de Compra. El email debe solicitar que desbloquee las facturas pendientes para que puedan ser pagadas.

Datos del responsable PO:
- Nombre: ${selectedPO.createdBy}
- Email: ${selectedPO.email || 'No disponible'}

Órdenes de Compra asociadas:
${poLines}

Facturas bloqueadas relacionadas (${relatedInvoices.length} facturas, total: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}):
${invoiceLines}

El email debe incluir:
1. Saludo formal usando el nombre del responsable
2. Explicación de que hay facturas pendientes de desbloqueo asociadas a sus POs
3. Detalle de las POs y facturas con importes
4. Solicitud clara de acción para desbloquear las facturas
5. Mención de que el pago está pendiente de su aprobación
6. Cierre formal

NO incluyas línea de asunto, solo el cuerpo del email. No inventes datos adicionales. El tono debe ser profesional pero urgente.`
      : `Generate a professional internal email in ENGLISH to send to "${selectedPO.createdBy}" (email: ${selectedPO.email || 'not available'}) who is the Purchase Order (PO) owner. The email should request that they unblock the pending invoices so they can be processed for payment.

PO Owner details:
- Name: ${selectedPO.createdBy}
- Email: ${selectedPO.email || 'Not available'}

Associated Purchase Orders:
${poLines}

Related blocked invoices (${relatedInvoices.length} invoices, total: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}):
${invoiceLines}

The email should include:
1. Formal greeting using the PO owner's name
2. Explanation that there are invoices pending unblock associated with their POs
3. Details of the POs and invoices with amounts
4. Clear action request to unblock the invoices
5. Mention that payment is pending their approval
6. Formal closing

Do NOT include a subject line, only the email body. Do not invent additional data. The tone should be professional but convey urgency.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error: ${response.status}`);
      }

      const result = await response.json();
      const text = result.content?.[0]?.text || 'No response generated.';
      setEmailBody(text);
    } catch (err: any) {
      setError(err.message || 'Failed to generate email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const emailWithRecipient = selectedPO?.email
      ? `To: ${selectedPO.email}\n\n${emailBody}`
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
                  <td className="px-4 py-2 font-mono text-xs text-slate-300 truncate max-w-[120px]" title={po.documentNumber}>
                    {po.documentNumber || '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => openEmailModal(po)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                      title={`Send email to ${po.createdBy}`}
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
                <p><span className="text-slate-300 font-medium">Email:</span> <span className="text-blue-300">{selectedPO.email || 'Not available'}</span></p>
                <p><span className="text-slate-300 font-medium">PO Number:</span> {selectedPO.poNumber || 'N/A'}</p>
                <p><span className="text-slate-300 font-medium">Vendor:</span> {selectedPO.vendorName}</p>
              </div>

              {/* Language Selection */}
              {!emailBody && !loading && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Globe size={14} /> Select Language
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => generateEmail('english')}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white py-3 rounded-xl transition-colors font-medium"
                    >
                      <span className="text-lg">🇬🇧</span> English
                    </button>
                    <button
                      onClick={() => generateEmail('spanish')}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 text-white py-3 rounded-xl transition-colors font-medium"
                    >
                      <span className="text-lg">🇪🇸</span> Español
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-emerald-400 font-cinzel animate-pulse">Forging the message...</p>
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
                      Try again
                    </button>
                  </div>

                  {selectedPO.email && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700 rounded-lg p-2">
                      <Mail size={14} /> To: {selectedPO.email}
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
