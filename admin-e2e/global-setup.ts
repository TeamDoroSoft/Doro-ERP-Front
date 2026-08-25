import { spawn } from 'node:child_process'
import process from 'node:process'

const baseUrl = 'http://127.0.0.1:5174/admin.html'

export default async function globalSetup() {
  const vite = spawn(
    process.execPath,
    [
      './node_modules/vite/bin/vite.js',
      '--config',
      'vite.admin.config.ts',
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
      '--strictPort',
    ],
    { cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true },
  )

  try {
    await waitForServer(vite)
  } catch (error) {
    vite.kill()
    throw error
  }

  return async () => {
    if (vite.exitCode === null) {
      vite.kill()
      await Promise.race([
        new Promise<void>((resolve) => vite.once('exit', () => resolve())),
        delay(3_000),
      ])
    }
  }
}

async function waitForServer(vite: ReturnType<typeof spawn>) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Admin Vite E2E server exited with code ${vite.exitCode}.`)
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // The server is still starting.
    }
    await delay(100)
  }
  throw new Error(`Admin Vite E2E server did not start at ${baseUrl}.`)
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
