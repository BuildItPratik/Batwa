import { useEffect, useRef, useState, type FormEvent } from 'react'
import { registerCustomer, ApiError, type RegisterResponse } from '../api/agentApi'
import { Button, FormField, LoadingState, PortalFrame, StatusPanel } from '../components/ui/index'

const LANGUAGES = [{ code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' }, { code: 'ta', label: 'Tamil' }]

interface RegisterForm {
  name: string
  phone: string
  pin: string
  confirmPin: string
  languagePref: string
}

const initialForm: RegisterForm = { name: '', phone: '', pin: '', confirmPin: '', languagePref: 'en' }

export default function RegisterCustomer() {
  const [form, setForm] = useState<RegisterForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResponse | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [result])
  function update(field: keyof RegisterForm, value: string) { setForm((current) => ({ ...current, [field]: value })) }
  function validate(): string | null {
    if (!form.name.trim()) return 'Enter the customer’s name.'
    if (!/^\d{4}$/.test(form.pin)) return 'PIN must be exactly 4 digits.'
    if (form.pin !== form.confirmPin) return 'PINs do not match.'
    return null
  }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(null); setResult(null)
    const validationError = validate(); if (validationError) { setError(validationError); return }
    setSubmitting(true)
    try {
      const data = await registerCustomer({ name: form.name.trim(), phone: form.phone.trim() || null, pin: form.pin, languagePref: form.languagePref })
      setResult(data); setForm(initialForm); setShowPin(false); setShowConfirmPin(false)
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow="Agent Centre · Register" title="Give someone their Batwa card" description="Create a customer wallet, choose a preferred language and print a card they can use at the counter." className="agent-flow-panel" headingRef={headingRef}>
      <div className="flow-ribbon"><span>01</span><span>Customer details</span><span className="flow-ribbon-line" /><span>02</span><span>Print card</span></div>
      {!result && <form className="batwa-form" onSubmit={handleSubmit}>
        <div className="form-section-heading"><h2>Customer details</h2><p>Only the details needed to make and support the card.</p></div>
        <FormField id="name" label="Customer name" error={error && !form.name.trim() ? error : null}><input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="off" /></FormField>
        <FormField id="phone" label="Phone (optional)" hint="Useful for support, never shown on the payment screen."><input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="off" /></FormField>
        <div className="form-two-column">
          <FormField id="pin" label="Set 4-digit PIN" action={<button className="field-visibility" type="button" onClick={() => setShowPin((visible) => !visible)} aria-pressed={showPin}>{showPin ? 'Hide' : 'Show'}</button>}><input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => update('pin', e.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></FormField>
          <FormField id="confirmPin" label="Confirm PIN" action={<button className="field-visibility" type="button" onClick={() => setShowConfirmPin((visible) => !visible)} aria-pressed={showConfirmPin}>{showConfirmPin ? 'Hide' : 'Show'}</button>}><input type={showConfirmPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.confirmPin} onChange={(e) => update('confirmPin', e.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></FormField>
        </div>
        <FormField id="language" label="Preferred language" hint="Ruchir can extend this copy boundary for translations later."><select value={form.languagePref} onChange={(e) => update('languagePref', e.target.value)}>{LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></FormField>
        {error && <StatusPanel variant="error" title="Could not register"><p>{error}</p></StatusPanel>}
        <Button type="submit" disabled={submitting}>{submitting ? 'Registering…' : 'Register customer'}</Button>
        {submitting && <LoadingState title="Creating card" message="Keep this window open for a moment." />}
      </form>}
      {result && <section className="batwa-result-card batwa-print-card" aria-live="polite"><StatusPanel variant="success" title="Customer registered"><p>Print this card and hand it to the customer. Their PIN is never printed.</p></StatusPanel><div className="result-grid"><div><span>Customer ID</span><strong>{result.customer_id}</strong></div><div><span>Card ID</span><strong>{result.card_id}</strong></div><div><span>Status</span><strong>{result.status}</strong></div></div>{result.qr_code_base64 && <div className="qr-card"><div className="qr-card-head"><span className="qr-card-brand">बटवा</span><span>Batwa card</span></div><img src={`data:image/png;base64,${result.qr_code_base64}`} alt={`QR card for ${result.card_id}`} /><strong>{result.card_id}</strong><p>Keep this card safe. Ask an Agent if it is lost.</p></div>}<Button variant="secondary" onClick={() => window.print()}>Print card</Button></section>}
    </PortalFrame>
  )
}
