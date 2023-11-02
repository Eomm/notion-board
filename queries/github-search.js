
export const querySearch = `#graphql
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
          }
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
