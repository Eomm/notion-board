
import https from 'https'
import PQueue from 'p-queue'
import { Client } from '@notionhq/client'

import { toJsDateString } from './utils.js'

class NotionWrapper {
  constructor ({ auth, databaseId, logger }) {
    this.logger = logger
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
    const allRecords = []

    let lastCursor
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
    const toInsert = toNotionProperties(item, { trimNull: true })

    const result = await this._thottle(this.notion.pages.create, {
      parent: { database_id: this.databaseId },
      properties: toInsert
    })

    return result
  }

  async updateItem (oldItem, newItem) {
    const toUpdate = toNotionProperties(newItem, { trimNull: false })

    const result = await this._thottle(this.notion.pages.update, {
      parent: { database_id: this.databaseId },
      page_id: oldItem.id,
      properties: toUpdate
    })

    return result
  }

  async deleteItem (item) {
    const result = await this._thottle(this.notion.blocks.delete, {
      block_id: item.id
    })

    return result
  }

  _thottle (fn, input) {
    return this.queue.add(() => fn.call(this.notion, input)
      .catch(err => {
        this.logger.error({ input }, 'Notion error: %s', err.message)
        throw err
      })
    )
  }
}

export {
  NotionWrapper,
  toHumanProperties
}

function toNotionProperties (input, { trimNull }) {
  const out = {
    Project: {
      title: [
        { text: { content: input.title } }
      ]
    }
  }

  ifThenSet(input, 'stars', out, 'number', 'Stars', trimNull)
  ifThenSet(input, 'issues', out, 'number', 'Issues', trimNull)
  ifThenSet(input, 'prs', out, 'number', 'PRs', trimNull)
  ifThenSet(input, 'archived', out, 'checkbox', 'Archived', trimNull)
  ifThenSet(input, 'repositoryUrl', out, 'url', 'GitHub', trimNull)
  ifThenSet(input, 'packageUrl', out, 'url', 'NPM', trimNull)
  ifThenSet(input, 'downloads', out, 'number', 'Downloads', trimNull)
  ifThenSet(input, 'packageSizeBytes', out, 'number', 'Size', trimNull)
  ifThenSet(input, 'lastCommitAt', out, 'date', 'Last Commit', trimNull)
  ifThenSet(input, 'version', out, 'rich_text', 'Version', trimNull)
  ifThenSet(input, 'topics', out, 'multi_select', 'Topics', trimNull)

  return out
}

function ifThenSet (input, key, output, type, keyOut, trimNull, defaultValue = null) {
  if (!Object.prototype.hasOwnProperty.call(input, key)) {
    return
  }

  const newVal = input[key] ?? defaultValue
  if (newVal === null && trimNull) {
    return
  }

  if (type === 'date') {
    output[keyOut] = { [type]: { start: newVal } }
  } else if (type === 'rich_text') {
    output[keyOut] = {
      [type]: [
        { type: 'text', text: { content: newVal } }
      ]
    }
  } else if (type === 'multi_select') {
    output[keyOut] = {
      [type]: input[key].map(x => ({ name: x })) ?? []
    }
  } else {
    output[keyOut] = { [type]: newVal }
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
    lastCommitAt: toJsDateString(properties['Last Commit']?.date?.start),
    archived: properties.Archived?.checkbox,
    packageUrl: properties.NPM?.url || undefined,
    packageSizeBytes: properties.Size?.number || undefined,
    downloads: properties.Downloads?.number || undefined,
    topics: properties.Topics?.multi_select?.map(x => x.name) || undefined
  }
}
