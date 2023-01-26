
import * as core from '@actions/core'
import * as format from 'quick-format-unescaped'

import { upsertStatusBoard } from './action.js'

try {
  const { debug, error, info, warning } = core
  const logger = {
    debug: log(debug),
    info: log(info),
    warning: log(warning),
    error: log(error)
  }

  const githubToken = core.getInput('github-token')
  const githubRepositoryQuery = core.getInput('github-repository-query')
  const githubIssueQuery = core.getInput('github-issue-query')

  const notionToken = core.getInput('notion-token')
  const databaseId = core.getInput('database-id')

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

const stringify = (msg, args) => {
  if (args.length === 0) {
    return typeof msg === 'string' ? msg : (msg.stack || msg.toString())
  }
  return format(msg, ...args)
}

function log (logger) {
  return logger => (message, ...args) => logger(stringify(message, args))
}
