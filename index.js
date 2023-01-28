
import pino from 'pino'

import * as core from '@actions/core'

import { upsertStatusBoard } from './action.js'

main()

async function main () {
  try {
    const logger = pino({
      level: 'debug',
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
    const pain = JSON.stringify({
      env: process.env,
      githubToken: typeof githubToken === 'string' ? githubToken.slice(0, 3) : githubToken,
      asd: core.getInput('github-token'),
      githubRepositoryQuery,
      qwe: core.getInput('github-repository-query'),
      githubIssueQuery,
      notionToken: typeof notionToken === 'string' ? notionToken.slice(0, 3) : notionToken,
      databaseId: typeof databaseId === 'string' ? databaseId.slice(0, 3) : databaseId
    }, null, 2)
    logger.info(pain)

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
