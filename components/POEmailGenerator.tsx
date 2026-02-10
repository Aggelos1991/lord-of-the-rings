import React, { useState, useMemo } from 'react';
import { ProcessedInvoice, POUserRecord } from '../types';
import { UserCheck, Copy, X, Globe, Mail } from 'lucide-react';

interface POEmailGeneratorProps {
  data: ProcessedInvoice[];
  poMap: Map<string, POUserRecord>;
  vendorName: string | null;
}

const POEmailGenerator: React.FC<POEmailGeneratorProps> = ({ data, poMap, vendorName }) => {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(envKey);
  const [selectedPOUser, setSelectedPOUser] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Build a list of unique PO users that match the current filtered invoices
  const poUsers = useMemo(() => {
    const userMap = new Map<string, { createdBy: string; email: string; invoices: ProcessedInvoice[] }>();

    data.forEach(invoice => {
      const po = poMap.get(invoice.Document_Number);
      if (po && po.createdBy) {
        const key = po.createdBy.toLowerCase();
        if (!userMap.has(key)) {
          userMap.set(key, { createdBy: po.createdBy, email: po.email, invoices: [] });
        }
        userMap.get(key)!.invoices.push(invoice);
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.invoices.length - a.invoices.length);
  }, [data, poMap]);

  const resetState = () => {
    setSelectedPOUser(null);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const generateEmail = async (lang: 'english' | 'spanish') => {
    setError('');
    setEmailBody('');

    const key = apiKey.trim();
    if (!key) {
      setError('No API key found. Please configure VITE_ANTHROPIC_API_KEY in your environment.');
      return;
    }

    const user = poUsers.find(u => u.createdBy === selectedPOUser);
    if (!user) {
      setError('Please select a PO user first.');
      return;
    }

    setLoading(true);

    const totalAmount = user.invoices.reduce((sum, d) => sum + d.Open_Amount, 0);
    const invoiceLines = user.invoices.slice(0, 30).map(d =>
      `- Invoice ${d.Invoice_Number || 'N/A'}, Vendor: ${d.Vendor_Name}, Due: ${d.Due_Date?.toLocaleDateString() || 'N/A'}, Amount: €${d.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Status: ${d.Status}${d.Days_Overdue > 0 ? ` (${d.Days_Overdue} days overdue)` : ''}, Block Status: ${d.Col_BS}`
    ).join('\n');

    const prompt = lang === 'spanish'
      ? `Genera un email profesional e interno en ESPAÑOL para enviar al usuario "${user.createdBy}" (email: ${user.email}) que es el responsable de la Orden de Compra (PO). El email debe solicitar que desbloquee las facturas pendientes para que puedan ser pagadas.

Datos:
- Responsable PO: ${user.createdBy}
- Total facturas bloqueadas: ${user.invoices.length}
- Importe total: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
${vendorName ? `- Proveedor: ${vendorName}` : ''}

Detalle de facturas:
${invoiceLines}

El email debe incluir:
1. Saludo formal usando el nombre del responsable
2. Explicación de que hay facturas pendientes de desbloqueo
3. Detalle de las facturas con importes
4. Solicitud clara de acción para desbloquear las facturas
5. Mención de que el pago está pendiente de su aprobación
6. Cierre formal

NO incluyas línea de asunto, solo el cuerpo del email. No inventes datos adicionales. El tono debe ser profesional pero urgente.`
      : `Generate a professional internal email in ENGLISH to send to "${user.createdBy}" (email: ${user.email}) who is the Purchase Order (PO) owner. The email should request that they unblock the pending invoices so they can be processed for payment.

Data:
- PO Owner: ${user.createdBy}
- Total blocked invoices: ${user.invoices.length}
- Total amount: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
${vendorName ? `- Vendor: ${vendorName}` : ''}

Invoice details:
${invoiceLines}

The email should include:
1. Formal greeting using the PO owner's name
2. Explanation that there are invoices pending unblock
3. Invoice details with amounts
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
          messages: [
            { role: 'user', content: prompt }
          ],
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
    const user = poUsers.find(u => u.createdBy === selectedPOUser);
    const emailWithRecipient = user?.email
      ? `To: ${user.email}\n\n${emailBody}`
      : emailBody;
    navigator.clipboard.writeText(emailWithRecipient);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedUser = poUsers.find(u => u.createdBy === selectedPOUser);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-64 z-50 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-5 py-4 shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-3 font-bold text-sm border-2 border-emerald-400"
        style={{ boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)' }}
      >
        <UserCheck size={22} />
        Send to PO User
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-cinzel text-emerald-400 flex items-center gap-2">
                <UserCheck size={22} /> PO User Email
              </h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">

              {/* PO User Selection */}
              {poUsers.length === 0 ? (
                <div className="bg-amber-900/20 border border-amber-600 text-amber-300 p-4 rounded-lg text-sm">
                  No PO users found matching the current filtered invoices. Make sure the Document Numbers match between the ledger and PO file.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <UserCheck size={14} /> Select PO User ({poUsers.length} found)
                  </label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:border-emerald-500 outline-none"
                    value={selectedPOUser || ''}
                    onChange={(e) => {
                      setSelectedPOUser(e.target.value || null);
                      setEmailBody('');
                      setError('');
                    }}
                  >
                    <option value="">-- Select a PO User --</option>
                    {poUsers.map(u => (
                      <option key={u.createdBy} value={u.createdBy}>
                        {u.createdBy} — {u.invoices.length} invoice(s) — {u.email || 'No email'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected User Info */}
              {selectedUser && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                  <p><span className="text-slate-300 font-medium">PO Owner:</span> {selectedUser.createdBy}</p>
                  <p><span className="text-slate-300 font-medium">Email:</span> <span className="text-emerald-400">{selectedUser.email || 'Not available'}</span></p>
                  <p><span className="text-slate-300 font-medium">Invoices:</span> {selectedUser.invoices.length}</p>
                  <p><span className="text-slate-300 font-medium">Total:</span> €{selectedUser.invoices.reduce((s, d) => s + d.Open_Amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  {vendorName && <p><span className="text-slate-300 font-medium">Vendor:</span> {vendorName}</p>}
                </div>
              )}

              {/* Language Selection */}
              {selectedUser && !emailBody && !loading && (
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
                      Generated Email for {selectedUser?.createdBy}
                    </label>
                    <button
                      onClick={() => { setEmailBody(''); setError(''); }}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      Try again
                    </button>
                  </div>

                  {selectedUser?.email && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700 rounded-lg p-2">
                      <Mail size={14} /> To: {selectedUser.email}
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

export default POEmailGenerator;
