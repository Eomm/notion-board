export function buildQuery (issueColumns = []) {
  const columnFields = issueColumns.map((label) => {
    const alias = toGraphqlAlias(label)
    return `${alias}: issues(states: OPEN, labels: ["${escapeGraphqlString(label)}"]) { totalCount }`
  }).join('\n            ')

  const columnFieldsIndented = columnFields
    ? `\n            ${columnFields}\n          `
    : ''

  return `#graphql
    query ($searchQuery: String!, $first: Int!, $after: String, $issueLabels: [String!]) {
      search(query: $searchQuery, type: REPOSITORY, first: $first, after: $after) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          ... on Repository {
            name
            description
            owner { login }
            stargazerCount
            url
            isArchived
            isFork
            issues(states: OPEN, labels: $issueLabels) {
              totalCount
            }            ${columnFieldsIndented}
            pullRequests(states: OPEN) {
              totalCount
            }
            repositoryTopics(first: 100) {
              nodes {
                ... on RepositoryTopic {
                  topic {
                    name
                  }
                }
              }
            }
            releases(first:1) {
              nodes {
                publishedAt
                tagName
              }
            }
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  history(first:1) {
                    nodes {
                      committedDate
                    }
                  }
                }
              }
            }
            pkg: object(expression: "HEAD:package.json") {
              ... on Blob {
                text
              }
            }
          }
        }
      }
    }
  `
}

export function toGraphqlAlias (label) {
  const camel = label
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr) => chr ? chr.toUpperCase() : '')
  const safe = camel.length === 0 || !/^[a-zA-Z_]/.test(camel) ? `x${camel}` : camel
  return safe.charAt(0).toLowerCase() + safe.slice(1)
}

function escapeGraphqlString (value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
