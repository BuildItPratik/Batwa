import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'

const root = process.cwd()
const backend = join(root, 'backend')
const frontend = join(root, 'frontend', 'agent-portal')
const isWindows = process.platform === 'win32'
const venvPython = join(backend, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python')
const python = process.env.BATWA_PYTHON || (existsSync(venvPython) ? venvPython : isWindows ? 'python' : 'python3')
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm'
const backendOnly = process.argv.includes('--backend-only')

const children = [
  spawn(python, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
    cwd: backend,
    stdio: 'inherit',
  }),
]

if (!backendOnly) {
  children.push(
    spawn(pnpm, ['--dir', frontend, 'dev'], {
      cwd: root,
      stdio: 'inherit',
    }),
  )
}

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 500)
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`[batwa] failed to start a service: ${error.message}`)
    shutdown(1)
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    const failure = signal ? 1 : code ?? 1
    console.error(`[batwa] a service stopped${signal ? ` (${signal})` : ` with code ${failure}`}`)
    shutdown(failure)
  })
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))

console.log('[batwa] backend: http://localhost:8000')
if (!backendOnly) console.log('[batwa] frontend: http://localhost:5173')
console.log(`[batwa] press Ctrl+C to stop ${backendOnly ? 'the backend' : 'both services'}`)
