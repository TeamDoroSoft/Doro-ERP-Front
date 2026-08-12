import { spawn } from 'node:child_process'
import process from 'node:process'

const baseUrl = 'http://127.0.0.1:5173'

export default async function globalSetup() {
  const vite = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_TOSS_CLIENT_KEY: 'test_ck_e2e_only',
      },
      stdio: 'ignore',
      windowsHide: true,
    },
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
      await waitForExit(vite)
    }
  }
}

async function waitForServer(vite: ReturnType<typeof spawn>) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) {
      throw new Error(`Vite E2E server exited with code ${vite.exitCode}.`)
    }
    try {
      const response = await fetch(baseUrl)
      if (response.ok) {
        return
      }
    } catch {
      // The server is still starting.
    }
    await delay(100)
  }
  throw new Error(`Vite E2E server did not start at ${baseUrl}.`)
}

async function waitForExit(vite: ReturnType<typeof spawn>) {
  await Promise.race([
    new Promise<void>((resolve) => vite.once('exit', () => resolve())),
    delay(3_000),
  ])
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
