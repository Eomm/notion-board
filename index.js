
import * as core from '@actions/core'
import * as format from 'quick-format-unescaped'

import { upsertStatusBoard } from './action.js'

main()

async function main () {
  try {
    const { debug, error, info, warning } = core
    const logger = {
      debug: log(debug),
      info: log(info),
      warning: log(warning),
      error: log(error)
    }

    const githubToken = process.env['INPUT_GITHUB-TOKEN']
    const githubRepositoryQuery = process.env['INPUT_GITHUB-REPOSITORY-QUERY']
    const githubIssueQuery = process.env['INPUT_GITHUB-ISSUE-QUERY']

    const notionToken = process.env['INPUT_NOTION-TOKEN']
    const databaseId = process.env['INPUT_NOTION-DATABASE-ID']

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
    return format.defaul(msg, ...args)
  }

  function log (logger) {
    return (message, ...args) => logger(stringify(message, args))
  }
}
