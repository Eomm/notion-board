
import { GitHubWrapper } from './github-wrapper.js'
import { NpmWrapper } from './npm-wrapper.js'
import { NotionWrapper } from './notion-wrapper.js'

export { upsertStatusBoard }

async function upsertStatusBoard ({
  logger,
  githubToken,
  githubRepositoryQuery,
  githubIssueQuery,
  notionToken,
  databaseId
}) {
  const github = new GitHubWrapper({
    auth: githubToken,
    logger
  })

  const npm = new NpmWrapper({
    logger
  })

  const notion = new NotionWrapper({
    auth: notionToken,
    databaseId
  })

  const allRepos = await github.searchRepositories(githubRepositoryQuery)
  logger.info('Found %d repositories', allRepos.length)

  const npmPackages = await npm.searchPackages(allRepos)
  console.log({ npmPackages })

  const records = await notion.readAllDatabase()
  logger.info('Read %d records from notion', records.length)

  const freshData = [
    {
      title: 'Notion API Worker',
      version: '1.0.0',
      stars: 42,
      repositoryUrl: 'https://github.com/Eomm/notion-board/issues',
      packageUrl: 'https://www.npmjs.com/package/notion-board',
      issues: 123,
      prs: 456,
      downloads: 789,
      packageSizeBytes: 123456,
      lastCommitAt: new Date().toISOString(),
      archived: true
    }
  ]

  for (const item of freshData) {
    // todo should update, delete or add the item?
    const result = await notion.addItem(item)
    logger.info('Added item %s', result.url)
  }

  return {
    statusCode: 200 // todo
  }
}
