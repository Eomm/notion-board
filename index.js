
import * as core from '@actions/core'
import * as format from 'quick-format-unescaped'

import { upsertStatusBoard } from './action.js'

main()

async function main () {
  try {
    const logger = {
      debug: log(core.debug.bind(core)),
      info: log(core.info.bind(core)),
      warning: log(core.warning.bind(core)),
      error: log(core.error.bind(core))
    }

    const githubToken = process.env['INPUT_GITHUB-TOKEN']
    const githubRepositoryQuery = process.env['INPUT_GITHUB-REPOSITORY-QUERY']
    const githubIssueQuery = process.env['INPUT_GITHUB-ISSUE-QUERY']

    const notionToken = process.env['INPUT_NOTION-TOKEN']
    const databaseId = process.env['INPUT_NOTION-DATABASE-ID']

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
    console.log(pain + ' by console.log')

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

function log (logger) {
  return (message, ...args) => logger(stringify(message, args))
}

function stringify (msg, args) {
  if (args.length === 0) {
    return typeof msg === 'string' ? msg : (msg.stack || msg.toString())
  }
  return format.default(msg, ...args)
}
