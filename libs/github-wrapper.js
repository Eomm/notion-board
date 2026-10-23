import * as github from '@actions/github'

import { buildQuery } from '../queries/github-search.js'

class GitHubWrapper {
  constructor ({ auth, logger, options }) {
    if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 100) {
      throw new Error('page-size must be an integer between 1 and 100')
    }
    this.logger = logger
    this.octokit = github.getOctokit(auth)
    this.wrapperOpts = options
  }

  async searchRepositories (searchQuery, issueLabels, issueColumns) {
    const repos = await paginateQuery({
      client: this.octokit,
      logger: this.logger,
      query: buildQuery(issueColumns),
      queryName: 'search',
      pageSize: this.wrapperOpts.pageSize,
      variables: {
        searchQuery,
        issueLabels: issueLabels?.length ? issueLabels : undefined
      }
    })

    return repos.map(normalizeRepository)
  }
}

export { GitHubWrapper }

function normalizeRepository (repo) {
  if (repo.pkg?.text) {
    repo.pkg = JSON.parse(repo.pkg.text)
  }
  return repo
}

async function paginateQuery (options) {
  const { client, logger, query, queryName, variables } = options
  let pageSize = options.pageSize
  const nodes = []
  let after
  let page = 1

  while (true) {
    const started = Date.now()
    const context = {
      service: 'github',
      operation: 'graphql.search',
      endpoint: 'POST /graphql',
      page,
      pageSize,
      cursor: after
    }
    logger.debug(context, 'GitHub GraphQL search page started')

    let res
    try {
      const result = await client.graphql(query, {
        ...variables,
        first: pageSize,
        after
      })
      res = result[queryName]
    } catch (error) {
      const status = error.status ?? error.response?.status
      const requestId = error.response?.headers?.['x-github-request-id'] ?? error.headers?.['x-github-request-id']
      const details = { ...context, status, requestId, elapsedMs: Date.now() - started }

      // GitHub terminates expensive queries after ~10s with 502/504.
      // Reduce work at the same cursor; never append a failed/partial page.
      if ((status === 502 || status === 504) && pageSize > 1) {
        pageSize = Math.max(1, Math.floor(pageSize / 2))
        logger.warn({ ...details, nextPageSize: pageSize }, 'GitHub GraphQL timeout; reducing page size')
        continue
      }

      logger.error(details, 'GitHub GraphQL search page failed')
      throw new Error(`GitHub GraphQL search failed on page ${page} (page-size ${pageSize}, status ${status ?? 'unknown'}, request-id ${requestId ?? 'unavailable'}): ${error.message}`, { cause: error })
    }

    nodes.push(...res.nodes)
    logger.debug({ ...context, elapsedMs: Date.now() - started, count: res.nodes.length }, 'GitHub GraphQL search page completed')

    if (!res.pageInfo.hasNextPage) {
      logger.debug('graphql:paginate total %d', nodes.length)
      return nodes
    }

    if (!res.pageInfo.endCursor || res.pageInfo.endCursor === after) {
      throw new Error(`GitHub GraphQL search returned a non-advancing cursor on page ${page}`)
    }
    after = res.pageInfo.endCursor
    page++
  }
}
