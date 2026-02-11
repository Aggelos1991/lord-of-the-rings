import React, { useState } from 'react';
import { ProcessedInvoice } from '../types';
import { MessageSquare, Copy, X, Send, Key, Globe } from 'lucide-react';

interface EmailGeneratorProps {
  data: ProcessedInvoice[];
  vendorName: string | null;
}

const EmailGenerator: React.FC<EmailGeneratorProps> = ({ data, vendorName }) => {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<'english' | 'spanish' | null>(null);
  const [apiKey, setApiKey] = useState(envKey);
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setLanguage(null);
    setEmailBody('');
    setError('');
    setCopied(false);
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const generateEmail = async (lang: 'english' | 'spanish') => {
    setLanguage(lang);
    setError('');
    setEmailBody('');

    if (!apiKey.trim()) {
      setError('Please enter your Anthropic API key first.');
      return;
    }

    if (data.length === 0) {
      setError('No invoice data to include in the email.');
      return;
    }

    setLoading(true);

    // Build invoice summary for the prompt
    const targetVendor = vendorName || 'the vendor';
    const totalAmount = data.reduce((sum, d) => sum + d.Open_Amount, 0);
    const overdueItems = data.filter(d => d.Status === 'Overdue');
    const invoiceLines = data.slice(0, 30).map(d =>
      `- Invoice ${d.Invoice_Number || 'N/A'}, Due: ${d.Due_Date?.toLocaleDateString() || 'N/A'}, Amount: €${d.Open_Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Status: ${d.Status}${d.Days_Overdue > 0 ? ` (${d.Days_Overdue} days overdue)` : ''}`
    ).join('\n');

    const prompt = lang === 'spanish'
      ? `Genera un email CORTO y directo en ESPAÑOL desde el departamento de Cuentas a Pagar al proveedor "${targetVendor}". Somos Cuentas a Pagar y necesitamos un estado de cuenta.

El email debe ser breve (máximo 5-6 líneas de texto), profesional y al grano. NO escribas un email largo.

Datos de referencia:
- Total facturas abiertas: ${data.length}
- Importe total pendiente: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
${overdueItems.length > 0 ? `- Facturas vencidas: ${overdueItems.length}` : ''}

Estructura del email:
1. Saludo breve
2. Solicitar estado de cuenta actualizado para las facturas pendientes que aparecen en nuestros registros
3. Mencionar brevemente el total pendiente y número de facturas
4. Solicitar que envíen el estado de cuenta a la mayor brevedad
5. Cierre breve con "Saludos cordiales" y "Departamento de Cuentas a Pagar"

NO incluyas línea de asunto. NO incluyas lista detallada de facturas individuales. NO inventes datos. Sé CONCISO.`
      : `Generate a SHORT and direct email in ENGLISH from the Accounts Payable department to vendor "${targetVendor}". We are Accounts Payable and we need a statement of account.

The email must be brief (maximum 5-6 lines of text), professional and to the point. Do NOT write a long email.

Reference data:
- Total open invoices: ${data.length}
- Total outstanding amount: €${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
${overdueItems.length > 0 ? `- Overdue invoices: ${overdueItems.length}` : ''}

Email structure:
1. Brief greeting
2. Request an updated statement of account for the outstanding invoices showing on our records
3. Briefly mention the total outstanding and number of invoices
4. Request they send the statement at their earliest convenience
5. Brief closing with "Kind regards" and "Accounts Payable Department"

Do NOT include a subject line. Do NOT include a detailed list of individual invoices. Do NOT invent data. Be CONCISE.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
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
      setError(err.message || 'Failed to generate email. Check your API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-400 text-black rounded-full w-14 h-14 shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center border-2 border-amber-300"
        style={{ boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)' }}
        title="Generate Vendor Email"
      >
        <MessageSquare size={22} />
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-cinzel text-gold-500 flex items-center gap-2">
                <MessageSquare size={22} /> Email Generator
              </h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">

              {/* API Key Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Key size={14} /> Anthropic API Key
                </label>
                {envKey ? (
                  <div className="flex items-center gap-2 bg-green-900/20 border border-green-600 text-green-300 text-sm rounded-lg p-2.5">
                    <span>API key loaded from environment</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="password"
                      placeholder="sk-ant-..."
                      className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:border-gold-500 outline-none placeholder:text-slate-600 font-mono"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">Key is stored in browser memory only, never saved or sent anywhere except Anthropic's API.</p>
                  </>
                )}
              </div>

              {/* Context Info */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                <p><span className="text-slate-300 font-medium">Vendor:</span> {vendorName || 'All filtered vendors'}</p>
                <p><span className="text-slate-300 font-medium">Invoices:</span> {data.length}</p>
                <p><span className="text-slate-300 font-medium">Total:</span> €{data.reduce((s, d) => s + d.Open_Amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
                  <div className="w-10 h-10 border-3 border-gold-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gold-500 font-cinzel animate-pulse">Forging the message...</p>
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
                      Generated Email ({language === 'spanish' ? '🇪🇸 Español' : '🇬🇧 English'})
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={resetState}
                        className="text-xs text-slate-400 hover:text-gold-500 transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar leading-relaxed">
                    {emailBody}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-center gap-2 bg-gold-600 hover:bg-gold-500 text-black py-3 rounded-xl transition-colors font-bold text-sm"
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

export default EmailGenerator;
