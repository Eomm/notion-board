
import pino from 'pino'
import * as core from '@actions/core'
// import * as github from '@actions/github'

import { upsertStatusBoard } from './statusboard.js'

try {
  const logger = pino({ level: 'debug' })

  const notionToken = core.getInput('notion-token')
  const databaseId = core.getInput('database-id')

  // github.context.payload
  await upsertStatusBoard({ logger, notionToken, databaseId })
} catch (error) {
  core.setFailed(error.message)
}
