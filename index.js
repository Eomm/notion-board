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

    const pageSize = parseInt(core.getInput('page-size'), 10)
    if (pageSize < 1 || pageSize > 100) {
      throw new Error('page-size must be between 1 and 100')
    }

    const behavior = {
      pageSize,
      deleteAdditionalRows: core.getInput('delete-additional-rows') === 'true'
    }

    await upsertStatusBoard({
      logger,

      githubToken,
      githubRepositoryQuery,
      githubIssueLabels,

      notionToken,
      databaseId,

      options: behavior
    })

    logger.info('Completed')
  } catch (error) {
    core.setFailed(error.message)
  }
}
