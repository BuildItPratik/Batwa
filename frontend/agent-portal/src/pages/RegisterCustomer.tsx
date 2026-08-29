import { useEffect, useRef, useState, type FormEvent } from 'react'
import { registerCustomer, ApiError, type RegisterResponse } from '../api/agentApi'
import { Button, FormField, LoadingState, PortalFrame, StatusPanel } from '../components/ui/index'
import { LANGUAGE_OPTIONS } from '../i18n/copy'
import { useLanguage } from '../i18n/LanguageContext'

interface RegisterForm {
  name: string
  phone: string
  pin: string
  confirmPin: string
  languagePref: string
}

const initialForm: RegisterForm = { name: '', phone: '', pin: '', confirmPin: '', languagePref: 'en' }

export default function RegisterCustomer() {
  const { copy } = useLanguage()
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
    if (!form.name.trim()) return copy.validation.nameRequired
    if (!/^\d{4}$/.test(form.pin)) return copy.validation.pinInvalid
    if (form.pin !== form.confirmPin) return copy.validation.pinMismatch
    return null
  }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(null); setResult(null)
    const validationError = validate(); if (validationError) { setError(validationError); return }
    setSubmitting(true)
    try {
      const data = await registerCustomer({ name: form.name.trim(), phone: form.phone.trim() || null, pin: form.pin, languagePref: form.languagePref })
      setResult(data); setForm(initialForm); setShowPin(false); setShowConfirmPin(false)
    } catch (err) { setError(err instanceof ApiError ? err.message : copy.common.somethingWrong) }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow={copy.register.eyebrow} title={copy.register.title} description={copy.register.description} className="agent-flow-panel" headingRef={headingRef}>
      <div className="flow-ribbon"><span>01</span><span>{copy.register.customerDetails}</span><span className="flow-ribbon-line" /><span>02</span><span>{copy.register.printCardStep}</span></div>
      {!result && <form className="batwa-form" onSubmit={handleSubmit}>
        <div className="form-section-heading"><h2>{copy.register.customerDetails}</h2><p>{copy.register.customerDetailsHelp}</p></div>
        <FormField id="name" label={copy.register.customerName} error={error && !form.name.trim() ? error : null}><input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="off" /></FormField>
        <FormField id="phone" label={copy.register.phoneOptional} hint={copy.register.phoneHint}><input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="off" /></FormField>
        <div className="form-two-column">
          <FormField id="pin" label={copy.register.setPin} action={<button className="field-visibility" type="button" onClick={() => setShowPin((visible) => !visible)} aria-pressed={showPin}>{showPin ? copy.common.hide : copy.common.show}</button>}><input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => update('pin', e.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></FormField>
          <FormField id="confirmPin" label={copy.register.confirmPin} action={<button className="field-visibility" type="button" onClick={() => setShowConfirmPin((visible) => !visible)} aria-pressed={showConfirmPin}>{showConfirmPin ? copy.common.hide : copy.common.show}</button>}><input type={showConfirmPin ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.confirmPin} onChange={(e) => update('confirmPin', e.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></FormField>
        </div>
        <FormField id="language" label={copy.register.preferredLanguage} hint={copy.register.preferredLanguageHint}><select value={form.languagePref} onChange={(e) => update('languagePref', e.target.value)}>{LANGUAGE_OPTIONS.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></FormField>
        {error && <StatusPanel variant="error" title={copy.register.unableRegister}><p>{error}</p></StatusPanel>}
        <Button type="submit" disabled={submitting}>{submitting ? copy.register.registering : copy.navigation.register}</Button>
        {submitting && <LoadingState title={copy.register.createCard} message={copy.register.keepWindowOpen} />}
      </form>}
      {result && <section className="batwa-result-card batwa-print-card" aria-live="polite"><StatusPanel variant="success" title={copy.register.registered}><p>{copy.register.registeredHelp}</p></StatusPanel><div className="result-grid"><div><span>{copy.register.customerId}</span><strong>{result.customer_id}</strong></div><div><span>{copy.register.cardId}</span><strong>{result.card_id}</strong></div><div><span>{copy.register.status}</span><strong>{result.status}</strong></div></div>{result.qr_code_base64 && <div className="qr-card"><div className="qr-card-head"><span className="qr-card-brand">बटवा</span><span>{copy.register.cardLabel}</span></div><img src={`data:image/png;base64,${result.qr_code_base64}`} alt={`${copy.register.qrAlt} ${result.card_id}`} /><strong>{result.card_id}</strong><p>{copy.register.cardSafety}</p></div>}<Button variant="secondary" onClick={() => window.print()}>{copy.common.printCard}</Button></section>}
    </PortalFrame>
  )
}
