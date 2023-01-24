
import { NotionWrapper } from './notion-wrapper.js'

export { upsertStatusBoard }

async function upsertStatusBoard ({
  logger,
  notionToken,
  databaseId
}) {
  const notion = new NotionWrapper({
    auth: notionToken,
    databaseId
  })

  const records = await notion.readAllDatabase()
  logger.info('Read %d records', records.length)

  // todo read the data from github
  // todo read the data from npm

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
