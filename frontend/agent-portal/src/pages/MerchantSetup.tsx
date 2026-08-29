import { Link, useNavigate } from 'react-router-dom'
import { Button, PortalFrame } from '../components/ui/index'
import { getConfiguredMerchant, selectDemoMerchant } from '../config/runtime'
import { DEMO_MERCHANTS } from '../config/merchantDemo'
import Icon from '../components/ui/Icon'
import { useLanguage } from '../i18n/LanguageContext'

export default function MerchantSetup() {
  const { copy } = useLanguage()
  const navigate = useNavigate()
  const selectedMerchant = getConfiguredMerchant()

  function choose(merchantId: string) {
    selectDemoMerchant(merchantId)
    navigate('/merchant/pay')
  }

  return (
    <PortalFrame
      eyebrow={copy.merchantSetup.eyebrow}
      title={copy.merchantSetup.title}
      description={copy.merchantSetup.description}
      className="merchant-setup-panel"
    >
      <div className="demo-banner"><span className="demo-dot" /> {copy.merchantSetup.demoBanner}</div>
      <div className="merchant-catalogue">
        {DEMO_MERCHANTS.map((merchant) => (
          <article className={`merchant-choice${merchant.id === selectedMerchant.id ? ' is-selected' : ''}`} key={merchant.id} aria-current={merchant.id === selectedMerchant.id ? 'true' : undefined}>
            <div className="merchant-choice-mark" aria-hidden="true">{merchant.name.charAt(0)}</div>
            <div>
              <p className="merchant-choice-id">{merchant.id}</p>
               <h2>{merchant.name}{merchant.id === selectedMerchant.id && <span className="merchant-choice-selected">{copy.common.selected}</span>}</h2>
               <p>{merchant.id === selectedMerchant.id ? copy.merchantSetup.currentSelection : copy.merchantSetup.seededMerchant}</p>
             </div>
             <Button onClick={() => choose(merchant.id)}>{copy.merchantSetup.useCounter}</Button>
          </article>
        ))}
      </div>
       <p className="batwa-field-hint">{copy.merchantSetup.normalModeHint}</p>
       <Link className="batwa-text-link" to="/">{copy.common.returnHome}</Link>
       <div className="merchant-counter-floor merchant-setup-floor" aria-label={copy.workspace.merchant}><span><Icon name="card" size={19} /> {copy.merchantSetup.selectCounter}</span><span><Icon name="cash" size={19} /> {copy.merchantSetup.acceptPayments}</span><span><Icon name="receipt" size={19} /> {copy.merchantSetup.confirmReceipt}</span></div>
    </PortalFrame>
  )
}
