import { useState } from 'react'
import { registerCustomer, ApiError } from '../api/agentApi.js'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
]

const initialForm = { name: '', phone: '', pin: '', confirmPin: '', languagePref: 'en' }

export default function RegisterCustomer() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validate() {
    if (!form.name.trim()) return 'Enter the customer\'s name.'
    if (!/^\d{4}$/.test(form.pin)) return 'PIN must be exactly 4 digits.'
    if (form.pin !== form.confirmPin) return 'PINs do not match.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const data = await registerCustomer({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        pin: form.pin,
        languagePref: form.languagePref,
      })
      setResult(data)
      setForm(initialForm)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <h2>Register New Customer</h2>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Customer Name</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone (optional)</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="pin">Set 4-Digit PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={form.pin}
            onChange={(e) => update('pin', e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="field">
          <label htmlFor="confirmPin">Confirm PIN</label>
          <input
            id="confirmPin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={form.confirmPin}
            onChange={(e) => update('confirmPin', e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="field">
          <label htmlFor="language">Preferred Language</label>
          <select
            id="language"
            value={form.languagePref}
            onChange={(e) => update('languagePref', e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="result-card failure">
            <p className="result-title failure">✕ Could not register</p>
            <p>{error}</p>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Registering…' : 'Register Customer'}
        </button>
      </form>

      {result && (
        <div className="result-card success">
          <p className="result-title success">✓ Customer Registered</p>
          <div className="result-row">
            <span>Customer ID</span>
            <strong>{result.customer_id}</strong>
          </div>
          <div className="result-row">
            <span>Card ID</span>
            <strong>{result.card_id}</strong>
          </div>
          <div className="result-row">
            <span>Status</span>
            <strong>{result.status}</strong>
          </div>

          {result.qr_code_base64 && (
            <div className="qr-box">
              <img
                src={`data:image/png;base64,${result.qr_code_base64}`}
                alt={`QR card for ${result.card_id}`}
              />
              <div className="qr-caption">{result.card_id}</div>
              <p className="helper-text">Print this card and hand it to the customer.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
