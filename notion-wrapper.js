
// import fs from 'fs'

import https from 'https'
import PQueue from 'p-queue'
import { Client } from '@notionhq/client'

class NotionWrapper {
  constructor ({ auth, databaseId }) {
    this.notion = new Client({
      auth,
      agent: new https.Agent({ keepAlive: true })
    })

    // https://developers.notion.com/reference/request-limits
    this.queue = new PQueue({
      concurrency: 1,
      intervalCap: 3, // max 3 requests
      interval: 1000 // per 1 second
    })

    this.databaseId = databaseId
  }

  async readAllDatabase ({ pageSize = 100 } = { }) {
    let lastCursor

    const allRecords = []
    let pageResults
    do {
      pageResults = await this.queue.add(() => this.notion.databases.query({
        database_id: this.databaseId,
        start_cursor: lastCursor,
        page_size: pageSize
      }))

      allRecords.push(...pageResults.results)

      lastCursor = pageResults.next_cursor
    } while (pageResults.has_more)

    return allRecords
  }

  async addItem (item) {
    const toInsert = toNotionProperties(item)
    const result = await this.queue.add(() => this.notion.pages.create({
      parent: { database_id: this.databaseId },
      properties: toInsert
    }))

    return result
  }
}

export { NotionWrapper }

function toNotionProperties ({
  title,
  version,
  stars,
  issues,
  prs,
  archived,
  downloads,
  repositoryUrl,
  packageUrl,
  packageSizeBytes,
  lastCommitAt
}) {
  return {
    Project: {
      title: [
        { text: { content: title } }
      ]
    },
    Issues: { number: issues },
    PRs: { number: prs },
    Downloads: { number: downloads },
    NPM: { url: packageUrl },
    GitHub: { url: repositoryUrl },
    Version: {
      rich_text: [
        { type: 'text', text: { content: version } }
      ]
    },
    Stars: { number: stars },
    Size: { number: packageSizeBytes },
    'Last Commit': {
      date: {
        start: lastCommitAt
      }
    },
    Archived: { checkbox: archived }
  }
}
