
import https from 'https'
import PQueue from 'p-queue'
import { Client } from '@notionhq/client'

import { toJsDateString } from './utils.js'

import DATABASE_TEMPLATE from './database-template.json' assert { type: "json" }

const COLUMN_LABLES = {
  title: 'Project',
  version: 'Version',
  stars: 'Stars',
  repositoryUrl: 'GitHub',
  prs: 'PRs',
  issues: 'Issues',
  lastCommitAt: 'Last Commit',
  lastEditedAt: 'Last edited time',
  archived: 'Archived',
  packageUrl: 'NPM',
  packageSizeBytes: 'Size',
  downloads: 'Downloads',
  topics: 'Topics'
}

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
    this.columnsMapping = null
  }

  async prepareDatabase () {
    const format = await this.notion.databases.retrieve({
      database_id: this.databaseId
    })

    const columns = Object.values(format.properties)
    this._refreshInternalMapping(columns)

    const missingColumns = this._getMissingColumns()
    if (missingColumns.length > 0) {
      this.logger.info('Adding missing columns: %o', missingColumns)

      const updatedSchema = await this.notion.databases.update({
        database_id: this.databaseId,
        properties: missingColumns.reduce((acc, curr) => {
          acc[curr.name] = curr
          return acc
        }, {})
      })

      this._refreshInternalMapping(Object.values(updatedSchema.properties))
      if (this._getMissingColumns().length > 0) {
        throw new Error(`Failed to add missing columns: ${missingColumns}`)
      }
    } else {
      this.logger.debug('DB Mapping ready %o', this.columnsMapping)
    }

    return true
  }

  async readAllDatabase ({ pageSize = 100 } = {}) {
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
    const toInsert = this.toNotionProperties(item, { trimNull: true })

    const result = await this._thottle(this.notion.pages.create, {
      parent: { database_id: this.databaseId },
      properties: toInsert
    })

    return result
  }

  async updateItem (oldItem, newItem) {
    const toUpdate = this.toNotionProperties(newItem, { trimNull: false })

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

  toHumanProperties (properties) {
    return {
      title: properties[this.columnsMapping.title.name].title[0].plain_text,
      version: properties[this.columnsMapping.version.name].rich_text[0]?.plain_text || undefined,
      stars: properties[this.columnsMapping.stars.name]?.number,
      repositoryUrl: properties[this.columnsMapping.repositoryUrl.name]?.url,
      prs: properties[this.columnsMapping.prs.name]?.number,
      issues: properties[this.columnsMapping.issues.name]?.number,
      lastCommitAt: toJsDateString(properties[this.columnsMapping.lastCommitAt.name]?.date?.start),
      archived: properties[this.columnsMapping.archived.name]?.checkbox,
      packageUrl: properties[this.columnsMapping.packageUrl.name]?.url || undefined,
      packageSizeBytes: properties[this.columnsMapping.packageSizeBytes.name]?.number || undefined,
      downloads: properties[this.columnsMapping.downloads.name]?.number || undefined,
      topics: properties[this.columnsMapping.topics.name]?.multi_select?.map(x => x.name) || undefined
    }
  }

  toNotionProperties (input, { trimNull }) {
    const out = {
      [this.columnsMapping.title.id]: {
        title: [
          { text: { content: input.title } }
        ]
      }
    }

    ifThenSet(input, 'stars', out, 'number', this.columnsMapping.stars.id, trimNull)
    ifThenSet(input, 'issues', out, 'number', this.columnsMapping.issues.id, trimNull)
    ifThenSet(input, 'prs', out, 'number', this.columnsMapping.prs.id, trimNull)
    ifThenSet(input, 'archived', out, 'checkbox', this.columnsMapping.archived.id, trimNull)
    ifThenSet(input, 'repositoryUrl', out, 'url', this.columnsMapping.repositoryUrl.id, trimNull)
    ifThenSet(input, 'packageUrl', out, 'url', this.columnsMapping.packageUrl.id, trimNull)
    ifThenSet(input, 'downloads', out, 'number', this.columnsMapping.downloads.id, trimNull)
    ifThenSet(input, 'packageSizeBytes', out, 'number', this.columnsMapping.packageSizeBytes.id, trimNull)
    ifThenSet(input, 'lastCommitAt', out, 'date', this.columnsMapping.lastCommitAt.id, trimNull)
    ifThenSet(input, 'version', out, 'rich_text', this.columnsMapping.version.id, trimNull)
    ifThenSet(input, 'topics', out, 'multi_select', this.columnsMapping.topics.id, trimNull)

    return out
  }

  _refreshInternalMapping (columns) {
    this.columnsMapping = {
      title: columns.find(c => c.id === 'title'),
      version: columns.find(c => c.name === COLUMN_LABLES.version),
      stars: columns.find(c => c.name === COLUMN_LABLES.stars),
      repositoryUrl: columns.find(c => c.name === COLUMN_LABLES.repositoryUrl),
      prs: columns.find(c => c.name === COLUMN_LABLES.prs),
      issues: columns.find(c => c.name === COLUMN_LABLES.issues),
      lastCommitAt: columns.find(c => c.name === COLUMN_LABLES.lastCommitAt),
      lastEditedAt: columns.find(c => c.name === COLUMN_LABLES.lastEditedAt),
      archived: columns.find(c => c.name === COLUMN_LABLES.archived),
      packageUrl: columns.find(c => c.name === COLUMN_LABLES.packageUrl),
      packageSizeBytes: columns.find(c => c.name === COLUMN_LABLES.packageSizeBytes),
      downloads: columns.find(c => c.name === COLUMN_LABLES.downloads),
      topics: columns.find(c => c.name === COLUMN_LABLES.topics)
    }
  }

  _getMissingColumns () {
    return Object.entries(this.columnsMapping)
      .filter(([, value]) => !value) //
      .map(([key]) => DATABASE_TEMPLATE[COLUMN_LABLES[key]])
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
  NotionWrapper
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
