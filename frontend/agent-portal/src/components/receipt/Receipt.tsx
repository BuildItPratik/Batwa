import { formatRupees, maskCardId } from '../../merchant/merchantFlow'
import type { Copy } from '../../i18n/copy'

export interface ReceiptProps {
  merchantName: string
  merchantId: string
  transactionId: string | null | undefined
  cardId: string
  amount: number | null
  newCustomerBalance?: number | null
  date: Date
  labels: Copy['receipt']
  locale?: string
}

export default function Receipt({
  merchantName,
  merchantId,
  transactionId,
  cardId,
  amount,
  newCustomerBalance,
  date,
  labels,
  locale = 'en-IN',
}: ReceiptProps) {
  return (
    <section className="payment-receipt" aria-label={labels.title}>
      <header>
        <span className="payment-receipt-brand">बटवा</span>
        <strong>{labels.title}</strong>
      </header>
      <dl>
        <div>
          <dt>{labels.merchant}</dt>
          <dd>{merchantName} · {merchantId}</dd>
        </div>
        <div>
          <dt>{labels.date}</dt>
          <dd>{date.toLocaleString(locale)}</dd>
        </div>
        <div>
          <dt>{labels.txnId}</dt>
          <dd>{transactionId || '—'}</dd>
        </div>
        <div>
          <dt>{labels.card}</dt>
          <dd>{maskCardId(cardId)}</dd>
        </div>
        <div>
          <dt>{labels.amount}</dt>
          <dd>{formatRupees(amount, locale)}</dd>
        </div>
        {typeof newCustomerBalance === 'number' && (
          <div>
            <dt>{labels.newBalance}</dt>
            <dd>{formatRupees(newCustomerBalance, locale)}</dd>
          </div>
        )}
      </dl>
      <footer>{labels.footer}</footer>
    </section>
  )
}
