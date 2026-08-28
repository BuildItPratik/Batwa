import { forwardRef } from 'react'

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'regular', className = '', type = 'button', ...props },
  ref,
) {
  const classes = [
    'batwa-button',
    'batwa-button-' + variant,
    'batwa-button-' + size,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button ref={ref} type={type} className={classes} {...props} />
})

export default Button
