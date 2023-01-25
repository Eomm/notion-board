
import * as github from '@actions/github'

import { querySearch } from './queries/github-search.js'

class GitHubWrapper {
  constructor ({ auth, logger }) {
    this.logger = logger
    this.octokit = github.getOctokit(auth)
  }

  async searchRepositories (searchQuery) {
    const repos = await paginateQuery({
      client: this.octokit,
      logger: this.logger,
      query: querySearch,
      queryName: 'search',
      variables: { searchQuery }
    })

    return repos
  }
}

export { GitHubWrapper }

function paginateQuery (options) {
  const { client, logger, query, queryName, variables } = options

  const paginatedQuery = async ({ pageInfo = {}, nodes = [] } = {}) => {
    const res = await client.graphql(query, {
      ...variables,
      first: 100,
      after: pageInfo.endCursor
    }).then(result => result[queryName])

    nodes.push(...res.nodes)

    if (res.pageInfo.hasNextPage) {
      logger.debug('graphql:paginate nodes: %d, cursor: %s', res.nodes.length, res.pageInfo.endCursor)
      return paginatedQuery({ pageInfo: res.pageInfo, nodes })
    }

    logger.debug('graphql:paginate total %d', nodes.length)

    return nodes
  }

  return paginatedQuery()
}
