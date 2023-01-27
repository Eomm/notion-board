
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

  async createItem (item) {
    const toInsert = toNotionProperties(item)
    const result = await this.queue.add(() => this.notion.pages.create({
      parent: { database_id: this.databaseId },
      properties: toInsert
    }))

    return result
  }

  async updateItem (oldItem, newItem) {
    const asLocal = toHumanProperties(oldItem.properties)
    console.log('asLocal', asLocal)

    // todo diff asLocal and newItem

    const toUpdate = toNotionProperties(newItem)
    const result = await this.queue.add(() => this.notion.pages.update({
      parent: { database_id: this.databaseId },
      page_id: oldItem.id,
      properties: toUpdate
    }))

    return result
  }

  async deleteItem (item) {
    const result = await this.queue.add(() => this.notion.blocks.delete({
      block_id: item.id
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
  const mandatory = {
    Project: {
      title: [
        { text: { content: title } }
      ]
    },
    Issues: { number: issues },
    PRs: { number: prs },
    GitHub: { url: repositoryUrl },
    Stars: { number: stars },
    Archived: { checkbox: archived }
  }

  if (lastCommitAt) {
    mandatory['Last Commit'] = {
      date: {
        start: lastCommitAt
      }
    }
  }

  if (version) {
    mandatory.Version = {
      rich_text: [
        { type: 'text', text: { content: version } }
      ]
    }
  }

  if (packageUrl) {
    mandatory.NPM = { url: packageUrl }
  }

  if (downloads) {
    mandatory.Downloads = { number: downloads }
  }

  if (packageSizeBytes) {
    mandatory.Size = { number: packageSizeBytes }
  }

  return mandatory
}

function toHumanProperties (properties) {
  return {
    title: properties.Project.title[0].plain_text,
    version: properties.Version.rich_text[0].plain_text,
    stars: properties.Stars?.number,
    issues: properties.Issues?.number,
    prs: properties.PRs?.number,
    archived: properties.Archived?.checkbox,
    downloads: properties.Downloads?.number,
    repositoryUrl: properties.GitHub?.url,
    packageUrl: properties.NPM?.url,
    packageSizeBytes: properties.Size?.number,
    lastCommitAt: properties['Last Commit']?.date.start
  }
}
