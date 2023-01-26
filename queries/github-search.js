
export const querySearch = `#graphql
  query ($searchQuery: String!, $first: Int!, $after: String) {
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
          repositoryTopics(first: 100) {
            nodes {
              ... on RepositoryTopic {
                topic {
                  name
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
