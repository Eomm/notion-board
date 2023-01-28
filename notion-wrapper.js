
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

export {
  NotionWrapper,
  toHumanProperties
}

function toNotionProperties (input) {
  const out = {
    Project: {
      title: [
        { text: { content: input.title } }
      ]
    }
  }

  ifThenSet(input, 'stars', out, 'number', 'Stars')
  ifThenSet(input, 'issues', out, 'number', 'Issues')
  ifThenSet(input, 'prs', out, 'number', 'PRs')
  ifThenSet(input, 'archived', out, 'checkbox', 'Archived')
  ifThenSet(input, 'repositoryUrl', out, 'url', 'GitHub')
  ifThenSet(input, 'packageUrl', out, 'url', 'NPM')
  ifThenSet(input, 'downloads', out, 'number', 'Downloads')
  ifThenSet(input, 'packageSizeBytes', out, 'number', 'Size')
  ifThenSet(input, 'lastCommitAt', out, 'date', 'Last Commit')
  ifThenSet(input, 'version', out, 'rich_text', 'Version')

  return out
}

function ifThenSet (input, key, output, type, keyOut, defaultValue = null) {
  if (Object.prototype.hasOwnProperty.call(input, key)) {
    if (type === 'date') {
      output[keyOut] = { [type]: { start: input[key] ?? defaultValue } }
    } else if (type === 'rich_text') {
      output[keyOut] = {
        [type]: [
          { type: 'text', text: { content: input[key] ?? defaultValue } }
        ]
      }
    } else {
      output[keyOut] = { [type]: input[key] ?? defaultValue }
    }
  }
}

function toHumanProperties (properties) {
  return {
    title: properties.Project.title[0].plain_text,
    version: properties.Version.rich_text[0]?.plain_text || undefined,
    stars: properties.Stars?.number,
    repositoryUrl: properties.GitHub?.url,
    prs: properties.PRs?.number,
    issues: properties.Issues?.number,
    lastCommitAt: properties['Last Commit']?.date?.start || undefined,
    archived: properties.Archived?.checkbox,
    packageUrl: properties.NPM?.url || undefined,
    packageSizeBytes: properties.Size?.number || undefined,
    downloads: properties.Downloads?.number || undefined
  }
}
