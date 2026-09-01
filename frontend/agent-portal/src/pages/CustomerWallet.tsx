import { useMemo, useState, type FormEvent } from 'react'
import {
  getCustomerBalance,
  getCustomerTransactions,
  CustomerWalletApiError,
  type BalanceResponse,
  type TransactionItem,
} from '../api/customerWalletApi'
import {
  Button,
  FormField,
  PortalFrame,
  StatusPanel,
} from '../components/ui/index'
import '../styles/customer-wallet.css'

function formatRupees(amount: number | null): string {
  if (amount === null) return '—'
  return `₹${amount.toFixed(2)}`
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp.replace(' ', 'T') + 'Z')

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return date.toLocaleString()
}

export default function CustomerWallet() {
  const [customerId, setCustomerId] = useState('')
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<
    'ALL' | 'TOPUP' | 'PAYMENT'
  >('ALL')
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'SUCCESS' | 'FAILED'
  >('ALL')
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST')

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const id = customerId.trim()

    if (!id) {
      setError('Please enter a customer ID.')
      setBalance(null)
      setTransactions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [balanceData, transactionData] = await Promise.all([
        getCustomerBalance(id),
        getCustomerTransactions(id),
      ])

      setBalance(balanceData)
      setTransactions(transactionData.transactions)
    } catch (err) {
      if (err instanceof CustomerWalletApiError) {
        setError(err.message)
      } else {
        setError('Could not load wallet information.')
      }

      setBalance(null)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    const filtered = transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        transaction.txn_id.toLowerCase().includes(query) ||
        transaction.type.toLowerCase().includes(query)

      const matchesType =
        typeFilter === 'ALL' || transaction.type === typeFilter

      const matchesStatus =
        statusFilter === 'ALL' || transaction.status === statusFilter

      return matchesSearch && matchesType && matchesStatus
    })

    return [...filtered].sort((first, second) => {
      const firstTime = new Date(
        first.timestamp.replace(' ', 'T') + 'Z',
      ).getTime()

      const secondTime = new Date(
        second.timestamp.replace(' ', 'T') + 'Z',
      ).getTime()

      return sortOrder === 'NEWEST'
        ? secondTime - firstTime
        : firstTime - secondTime
    })
  }, [transactions, search, typeFilter, statusFilter, sortOrder])

  return (
    <PortalFrame
      eyebrow="Customer Centre · Wallet"
      title="Customer wallet"
      description="Check the current balance and view the customer's transaction history."
      className="customer-wallet-panel"
    >
      <form className="batwa-form" onSubmit={handleLookup}>
        <FormField
          id="customer-id"
          label="Customer ID"
          hint="Example: CUST-TEST01"
        >
          <input
            type="text"
            value={customerId}
            onChange={(event) =>
              setCustomerId(event.target.value.toUpperCase())
            }
            placeholder="CUST-TEST01"
            autoComplete="off"
          />
        </FormField>

        <Button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'View wallet'}
        </Button>
      </form>

      {error && (
        <StatusPanel variant="error" title="Could not load wallet">
          <p>{error}</p>
        </StatusPanel>
      )}

      {balance && !loading && (
        <>
          {balance.balance < 100 && (
            <StatusPanel variant="error" title="Low wallet balance">
              <p>
                This customer has only {formatRupees(balance.balance)} remaining.
                Please ask the customer to visit the Agent Centre to add cash.
              </p>
            </StatusPanel>
          )}

          <section
            className="customer-wallet-summary"
            aria-label="Customer wallet summary"
          >
            <div className="batwa-result-card">
              <div className="result-grid">
                <div>
                  <span>Customer</span>
                  <strong>{balance.customer_id}</strong>
                </div>

                <div>
                  <span>Available balance</span>
                  <strong>{formatRupees(balance.balance)}</strong>
                </div>

                <div>
                  <span>Card status</span>
                  <strong>{balance.card_status}</strong>
                </div>
              </div>
            </div>
          </section>

          <section
            className="customer-wallet-history"
            aria-labelledby="customer-wallet-history-title"
          >
            <div className="form-section-heading">
              <p className="batwa-eyebrow">Wallet statement</p>

              <h2 id="customer-wallet-history-title">
                Transaction history
              </h2>

              <p>
                {filteredTransactions.length === 0
                  ? transactions.length === 0
                    ? 'No transactions recorded for this customer.'
                    : 'No transactions match the selected filters.'
                  : `${filteredTransactions.length} of ${
                      transactions.length
                    } transaction${
                      transactions.length === 1 ? '' : 's'
                    } shown.`}
              </p>
            </div>

            {transactions.length > 0 && (
              <div
                className="customer-wallet-filters"
                aria-label="Transaction filters"
              >
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transaction ID or type"
                  aria-label="Search transactions"
                />

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value as 'ALL' | 'TOPUP' | 'PAYMENT',
                    )
                  }
                  aria-label="Filter by transaction type"
                >
                  <option value="ALL">All types</option>
                  <option value="TOPUP">Top-ups</option>
                  <option value="PAYMENT">Payments</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as 'ALL' | 'SUCCESS' | 'FAILED',
                    )
                  }
                  aria-label="Filter by transaction status"
                >
                  <option value="ALL">All status</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(
                      event.target.value as 'NEWEST' | 'OLDEST',
                    )
                  }
                  aria-label="Sort transactions"
                >
                  <option value="NEWEST">Newest first</option>
                  <option value="OLDEST">Oldest first</option>
                </select>
              </div>
            )}

            {filteredTransactions.length > 0 && (
              <div className="customer-wallet-table-wrap">
                <table className="customer-wallet-table">
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Date & time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.txn_id}>
                        <td>
                          <strong>{transaction.type}</strong>
                          <small>{transaction.txn_id}</small>
                        </td>

                        <td>
                          {formatRupees(transaction.amount)}
                        </td>

                        <td>
                          <strong>{transaction.status}</strong>

                          {transaction.failure_reason && (
                            <small>
                              {transaction.failure_reason.replaceAll(
                                '_',
                                ' ',
                              )}
                            </small>
                          )}
                        </td>

                        <td>
                          {formatTimestamp(transaction.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </PortalFrame>
  )
}