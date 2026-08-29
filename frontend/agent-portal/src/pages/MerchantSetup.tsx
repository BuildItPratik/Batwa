import { Link, useNavigate } from 'react-router-dom'
import { Button, PortalFrame } from '../components/ui/index'
import { getConfiguredMerchant, selectDemoMerchant } from '../config/runtime'
import { DEMO_MERCHANTS } from '../config/merchantDemo'
import Icon from '../components/ui/Icon'

export default function MerchantSetup() {
  const navigate = useNavigate()
  const selectedMerchant = getConfiguredMerchant()

  function choose(merchantId: string) {
    selectDemoMerchant(merchantId)
    navigate('/merchant/pay')
  }

  return (
    <PortalFrame
      eyebrow="Merchant Counter · Demo mode"
      title="Choose today’s counter"
      description="This presenter-only switch selects the merchant identity used by the real payment request."
      className="merchant-setup-panel"
    >
      <div className="demo-banner"><span className="demo-dot" /> Demo facility · no merchant authentication</div>
      <div className="merchant-catalogue">
        {DEMO_MERCHANTS.map((merchant) => (
          <article className={`merchant-choice${merchant.id === selectedMerchant.id ? ' is-selected' : ''}`} key={merchant.id} aria-current={merchant.id === selectedMerchant.id ? 'true' : undefined}>
            <div className="merchant-choice-mark" aria-hidden="true">{merchant.name.charAt(0)}</div>
            <div>
              <p className="merchant-choice-id">{merchant.id}</p>
              <h2>{merchant.name}</h2>
              <p>{merchant.id === selectedMerchant.id ? 'Currently selected · seeded local merchant' : 'Seeded local merchant'}</p>
            </div>
            <Button onClick={() => choose(merchant.id)}>Use this counter</Button>
          </article>
        ))}
      </div>
      <p className="batwa-field-hint">In normal configured mode, identity comes from authenticated merchant provisioning and this switch is hidden.</p>
      <Link className="batwa-text-link" to="/">Return to Batwa home</Link>
      <div className="merchant-counter-floor merchant-setup-floor" aria-label="Merchant counter guidance"><span><Icon name="card" size={19} /> Select the receiving counter</span><span><Icon name="cash" size={19} /> Accept familiar small payments</span><span><Icon name="receipt" size={19} /> Confirm each receipt</span></div>
    </PortalFrame>
  )
}
