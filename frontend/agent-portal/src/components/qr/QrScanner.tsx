import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Button from '../ui/Button'
import FormField from '../ui/FormField'
import LoadingState from '../ui/LoadingState'
import StatusPanel from '../ui/StatusPanel'

const DEFAULT_LABELS = {
  instruction: 'Point the camera at the QR code.',
  manualLabel: 'Enter code manually',
  manualPlaceholder: 'CARD-XXXXXX',
  manualHint: 'Use this option if the camera is unavailable.',
  cameraStarting: 'Starting camera…',
  cameraReady: 'Camera ready. Align the QR code inside the frame.',
  permissionDenied: 'Camera permission was denied. Enter the code below.',
  noCamera: 'No camera was found. Enter the code below.',
  unsupported: 'This browser cannot access a camera. Enter the code below.',
  startFailed: 'The camera could not start. Retry or enter the code below.',
  invalid: 'That QR code is not supported.',
  retryCamera: 'Retry camera',
  useCard: 'Use this card',
  qrLabel: 'QR card scanner',
  qrNotRecognised: 'QR code not recognised',
  cameraUnavailable: 'Camera unavailable',
  or: 'or',
}

export type QrScannerLabels = Partial<typeof DEFAULT_LABELS>

type CameraErrorKind = 'permission-denied' | 'no-camera' | 'start-failed'

type ScannerStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'decoded'
  | 'invalid'
  | 'unsupported'
  | CameraErrorKind

function errorKind(error: unknown): CameraErrorKind {
  const message = String(
    (error as { message?: string })?.message || error || '',
  ).toLowerCase()

  if (
    message.includes('notallowed') ||
    message.includes('permission') ||
    message.includes('denied')
  ) {
    return 'permission-denied'
  }

  if (
    message.includes('notfound') ||
    message.includes('no camera') ||
    message.includes('camera device')
  ) {
    return 'no-camera'
  }

  return 'start-failed'
}

async function stopScannerInstance(scanner: Html5Qrcode | null) {
  if (!scanner) return

  await new Promise((resolve) => setTimeout(resolve, 120))

  try {
    await scanner.stop()
  } catch {
    // The scanner may not have reached its running state yet.
  }

  try {
    scanner.clear()
  } catch {
    // Clearing an already-cleared reader is safe to ignore.
  }
}

export interface QrScannerProps {
  active?: boolean
  onValue: (value: string) => void
  validate?: (value: string) => boolean
  invalidMessage?: string
  labels?: QrScannerLabels
  showCamera?: boolean
}

export default function QrScanner({
  active = true,
  onValue,
  validate = (value) => Boolean(value),
  invalidMessage,
  labels = DEFAULT_LABELS,
  showCamera = true,
}: QrScannerProps) {
  const readerId = 'batwa-qr-reader-' + useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerStartRef = useRef<Promise<unknown> | null>(null)
  const decodedRef = useRef(false)

  const [manualValue, setManualValue] = useState('')
  const [status, setStatus] = useState<ScannerStatus>(
    active ? 'starting' : 'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  const copy = { ...DEFAULT_LABELS, ...labels }

  const stopScanner = useCallback(async () => {
    const pendingStart = scannerStartRef.current

    if (pendingStart) {
      try {
        await pendingStart
      } catch {
        // Startup errors are surfaced by the start effect.
      }
    }

    const scanner = scannerRef.current
    scannerRef.current = null

    await stopScannerInstance(scanner)
  }, [])

  const handleValue = useCallback(
    (rawValue: unknown) => {
      const value = String(rawValue || '').trim()

      let valid = Boolean(value)

      try {
        valid = valid && validate(value)
      } catch {
        valid = false
      }

      if (!valid) {
        setStatus('invalid')
        setErrorMessage(invalidMessage || copy.invalid)
        return false
      }

      if (decodedRef.current) return true

      decodedRef.current = true
      setStatus('decoded')

      void stopScanner().finally(() => onValue(value))

      return true
    },
    [copy.invalid, invalidMessage, onValue, stopScanner, validate],
  )

  useEffect(() => {
    let alive = true
    decodedRef.current = false

    if (!active || !showCamera) {
      setStatus('idle')
      void stopScanner()

      return () => {
        alive = false
        void stopScanner()
      }
    }

    async function startCamera() {
      setStatus('starting')
      setErrorMessage('')

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        setErrorMessage(copy.unsupported)
        return
      }

      try {
        const cameras = await Html5Qrcode.getCameras()

        if (!alive) return

        if (!cameras?.length) {
          setStatus('no-camera')
          setErrorMessage(copy.noCamera)
          return
        }

        const scanner = new Html5Qrcode(readerId)
        scannerRef.current = scanner

        const startRequest = scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (alive) {
              handleValue(decodedText)
            }
          },
          () => {
            // Per-frame decode misses are expected and should not interrupt scanning.
          },
        )

        scannerStartRef.current = startRequest

        try {
          await startRequest
        } finally {
          if (scannerStartRef.current === startRequest) {
            scannerStartRef.current = null
          }
        }

        if (!alive || decodedRef.current) {
          await stopScannerInstance(scanner)
          return
        }

        setStatus('ready')
      } catch (error) {
        if (!alive) return

        await stopScanner()

        const kind = errorKind(error)

        const kindMessages: Record<CameraErrorKind, string> = {
          'permission-denied': copy.permissionDenied,
          'no-camera': copy.noCamera,
          'start-failed': copy.startFailed,
        }

        setStatus(kind)
        setErrorMessage(kindMessages[kind] || copy.startFailed)
      }
    }

    void startCamera()

    return () => {
      alive = false
      void stopScanner()
    }
  }, [
    active,
    copy.noCamera,
    copy.startFailed,
    copy.unsupported,
    handleValue,
    readerId,
    retryCount,
    stopScanner,
    showCamera,
  ])

  function retryCamera() {
    decodedRef.current = false
    setManualValue('')
    setErrorMessage('')
    setRetryCount((count) => count + 1)
  }

  const canRetry = [
    'permission-denied',
    'no-camera',
    'unsupported',
    'start-failed',
    'invalid',
  ].includes(status)

  return (
    <section className="batwa-qr-scanner" aria-label={copy.qrLabel}>
      {showCamera && (
        <>
          <p className="batwa-scanner-instruction">
            {copy.instruction}
          </p>

          <div className="batwa-qr-reader-wrap">
            <div id={readerId} className="batwa-qr-reader" />

            {status === 'starting' && (
              <div className="batwa-reader-overlay">
                <LoadingState title={copy.cameraStarting} />
              </div>
            )}
          </div>

          {status === 'ready' && (
            <p className="batwa-scanner-ready">
              {copy.cameraReady}
            </p>
          )}

          {errorMessage && status !== 'starting' && (
            <StatusPanel
              variant={status === 'invalid' ? 'warning' : 'error'}
              title={
                status === 'invalid'
                  ? copy.qrNotRecognised
                  : copy.cameraUnavailable
              }
            >
              <p>{errorMessage}</p>
            </StatusPanel>
          )}

          {canRetry && (
            <Button variant="quiet" onClick={retryCamera}>
              {copy.retryCamera}
            </Button>
          )}
        </>
      )}

      <div className="batwa-manual-entry">
        {showCamera && (
          <div className="batwa-divider">
            <span>{copy.or}</span>
          </div>
        )}
        <div className="batwa-manual-entry-fields">
          <FormField id="manual-card-id" label={copy.manualLabel} hint={copy.manualHint}>
            <input
              type="text"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleValue(manualValue)
                }
              }}
              placeholder={copy.manualPlaceholder}
              autoComplete="off"
              spellCheck="false"
              autoCapitalize="characters"
            />
          </FormField>
          <Button
            variant="secondary"
            type="button"
            disabled={!manualValue.trim()}
            onClick={() => handleValue(manualValue)}
          >
            {copy.useCard}
          </Button>
        </div>
      </div>
    </section>
  )
}