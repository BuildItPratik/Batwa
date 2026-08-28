import Button from './Button.jsx'

export default function LoadingState({ title, message, retryLabel, onRetry }) {
  return (
    <div className="batwa-loading" role="status" aria-live="polite">
      <span className="batwa-spinner" aria-hidden="true" />
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <Button variant="quiet" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
