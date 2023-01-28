
import pino from 'pino'

import * as core from '@actions/core'

import { upsertStatusBoard } from './action.js'

main()

async function main () {
  try {
    const logger = pino({
      level: core.getInput('log-level') || 'debug',
      transport: {
        target: 'pino-pretty'
      }
    })

    const githubToken = core.getInput('github-token')
    const githubRepositoryQuery = core.getInput('github-repository-query')
    const githubIssueLabels = core.getInput('github-issue-labels')?.split(',').map(s => s.trim()).filter(e => e)

    const notionToken = core.getInput('notion-token')
    const databaseId = core.getInput('notion-database-id')

    // github.context.payload
    await upsertStatusBoard({
      logger,

      githubToken,
      githubRepositoryQuery,
      githubIssueLabels,

      notionToken,
      databaseId
    })

    logger.info('Completed')
  } catch (error) {
    core.setFailed(error.message)
  }
}
