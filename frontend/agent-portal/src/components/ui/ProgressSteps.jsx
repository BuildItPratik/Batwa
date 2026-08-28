export default function ProgressSteps({ steps, currentStep }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep),
  )

  return (
    <ol className="batwa-progress" aria-label="Payment progress">
      {steps.map((step, index) => {
        const complete = index < currentIndex
        const active = index === currentIndex
        return (
          <li
            className={
              'batwa-progress-step' +
              (complete ? ' is-complete' : '') +
              (active ? ' is-active' : '')
            }
            key={step.id}
            aria-current={active ? 'step' : undefined}
          >
            <span className="batwa-progress-marker" aria-hidden="true">
              {complete ? '✓' : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
