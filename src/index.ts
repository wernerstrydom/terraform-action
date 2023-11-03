import * as core from '@actions/core'
import { run } from './main'

async function init(): Promise<void> {
  try {
    await run()
  } catch (error: unknown) {
    // TypeScript 4.0 and later syntax
    if (error instanceof Error) {
      core.setFailed(error.message) // Now TypeScript knows `error` is an Error
    } else {
      // If it's not an Error, you can decide how to handle it.
      core.setFailed('An unknown error occurred')
    }
  }

  return
}

init()
