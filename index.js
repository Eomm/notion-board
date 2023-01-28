
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
    const githubIssueQuery = core.getInput('github-issue-query')

    const notionToken = core.getInput('notion-token')
    const databaseId = core.getInput('notion-database-id')

    // github.context.payload
    await upsertStatusBoard({
      logger,

      githubToken,
      githubRepositoryQuery,
      githubIssueQuery,

      notionToken,
      databaseId
    })

    logger.info('Completed')
  } catch (error) {
    core.setFailed(error.message)
  }
}
