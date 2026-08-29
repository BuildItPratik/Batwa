import { Link } from 'react-router-dom'
import BatwaBrand from '../components/ui/BatwaBrand'

const SYSTEM_STEPS: [string, string, string][] = [
  ['01', 'Get a card', 'card'],
  ['02', 'Add cash', 'wallet'],
  ['03', 'Pay with PIN', 'pin'],
]

function StepIcon({ kind }: { kind: string }) {
  if (kind === 'wallet') return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 9h31a5 5 0 0 1 5 5v15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h27" /><path d="M4 10h34a4 4 0 0 1 4 4v5H30a5 5 0 0 1 0-10h12M30 16h2" /></svg>
  if (kind === 'pin') return <svg viewBox="0 0 48 42" aria-hidden="true"><rect x="7" y="3" width="29" height="36" rx="3" /><path d="M14 11h15M14 18h3m5 0h3m5 0h0M14 25h3m5 0h3m5 0h0M14 32h3m5 0h3" /><path d="m34 27 5 5 7-9" /></svg>
  return <svg viewBox="0 0 48 36" aria-hidden="true"><rect x="3" y="8" width="42" height="25" rx="3" /><path d="M3 16h42M10 25h13" /></svg>
}

export default function LandingPage() {
  return (
    <main className="landing-page" aria-label="Batwa phone-free payment service">
      <div className="landing-topbar">
        <a href="/" aria-label="Batwa home"><BatwaBrand descriptor="Phone-free payments under ₹100" /></a>
      </div>
      <section className="landing-stage" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title"><span>Small payments.</span><span>No phone needed.</span></h1>
          <p className="landing-description">A familiar card-and-PIN way to pay safely at your local shops.</p>
          <div className="landing-actions">
            <Link className="batwa-button batwa-button-primary batwa-button-regular" to="/agent">Enter Agent Centre</Link>
            <Link className="batwa-button batwa-button-secondary batwa-button-regular" to="/merchant">Enter Merchant Counter</Link>
          </div>
          <Link className="landing-admin-link" to="/admin">Live dashboard →</Link>
          <p className="landing-note"><span className="landing-note-icon" aria-hidden="true"><svg viewBox="0 0 24 28"><path d="M12 2 21 5v7c0 6-3.8 10.4-9 14-5.2-3.6-9-8-9-14V5l9-3Z" /><path d="m7.5 13 3 3 6-6" /></svg></span>Built for familiar, assisted payments</p>
        </div>
      </section>
      <section className="landing-steps" aria-labelledby="steps-title">
        <div className="landing-step-grid">
          {SYSTEM_STEPS.map(([number, title, icon], index) => <article className="landing-step" key={number}><span className="landing-step-number">{number}</span><div className="landing-step-icon"><StepIcon kind={icon} /></div><h2 id={index === 0 ? 'steps-title' : undefined}>{title}</h2>{index < SYSTEM_STEPS.length - 1 && <span className="landing-step-rule" aria-hidden="true" />}</article>)}
        </div>
      </section>
    </main>
  )
}
