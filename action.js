
import { diff } from 'deep-object-diff'
import * as assert from 'assert'

import { GitHubWrapper } from './libs/github-wrapper.js'
import { NpmWrapper } from './libs/npm-wrapper.js'
import { NotionWrapper } from './libs/notion-wrapper.js'

import * as utils from './libs/utils.js'

export { upsertStatusBoard }

async function upsertStatusBoard ({
  logger,
  githubToken,
  githubRepositoryQuery,
  githubIssueLabels,
  notionToken,
  databaseId,
  options
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
    databaseId,
    logger
  })

  await notion.prepareDatabase()

  const githubRepos = await github.searchRepositories(githubRepositoryQuery, githubIssueLabels)
  logger.info('Found %d repositories', githubRepos.length)

  const npmPackages = await npm.searchPackages(githubRepos)
  logger.info('Found %d npm packages', npmPackages.length)

  const notionLines = await notion.readAllDatabase()
  logger.info('Read %d records from notion', notionLines.length)

  const todoList = buildActions({
    githubRepos,
    npmPackages,
    notionLines,

    notionClient: notion,
    options
  })
  logger.info('Found %d actions to perform', todoList.length)

  await Promise.all(todoList.map(executeAction))

  async function executeAction (item) {
    switch (item.action) {
      case 'add':
      {
        const result = await notion.createItem(item.payload)
        logger.info('Added item %s', result.url)
        return
      }

      case 'update':
      {
        const result = await notion.updateItem(item.previousData, item.payload)
        logger.info('Updated item %s', result.url)
        return
      }

      case 'delete':
      {
        const result = await notion.deleteItem(item.previousData)
        logger.info('Deleted item %s', result.id)
      }
    }
  }

  logger.info('Processed %d items', todoList.length)
  return {
    processedItems: todoList.length
  }
}

function buildActions ({
  githubRepos,
  npmPackages,
  notionLines,
  notionClient,
  options: { deleteAdditionalRows }
}) {
  const githubReposMap = toMap(githubRepos, ghSharedKey)
  const npmPackagesMap = toMap(npmPackages, npmSharedKey)
  const notionLinesMap = toMap(notionLines, notionSharedKey)

  const addAndUpdateActions = githubRepos
    .map(github => ({ github }))
    .map(decorateWith(npmPackagesMap, 'npm'))
    .map(decorateWith(notionLinesMap, 'notion'))
    .map(convertToAction)
    .filter(removeUnchangedLines.bind(notionClient))

  if (!deleteAdditionalRows) {
    return addAndUpdateActions
  }

  const deleteActions = notionLines
    .filter(removeOldLines(githubReposMap))
    .map(line => ({ action: 'delete', previousData: line }))

  return addAndUpdateActions.concat(deleteActions)
}

function removeOldLines (githubReposMap) {
  return function removeOldLines (line) {
    const key = notionSharedKey(line)
    return !githubReposMap.has(key)
  }
}

function removeUnchangedLines (item) {
  if (item.action !== 'update') {
    return true
  }

  const asLocal = this.toHumanProperties(item.previousData.properties)

  const changedFields = diff(asLocal, item.payload)
  assert.ok(!changedFields.title, 'title should not change')

  // no changes
  if (Object.keys(changedFields).length === 0) {
    return false
  }

  // special case for array fields
  // if the array has changed, the diff returns an indexed object
  // since we want to align the whole array, we need to restore it
  if (changedFields.topics) {
    changedFields.topics = item.payload.topics
  }

  item.payload = {
    title: item.payload.title,
    ...changedFields
  }
  return true
}

function convertToAction ({ github, npm, notion }) {
  // all the fields must be listed here
  let payload = {
    title: github.name,
    version: github.pkg?.version,
    stars: github.stargazerCount,
    repositoryUrl: github.url,

    topics: github.repositoryTopics?.nodes?.map(node => node.topic.name),

    prs: github.pullRequests.totalCount,
    issues: github.issues.totalCount,

    lastCommitAt: utils.toJsDateString(github.defaultBranchRef?.target?.history?.nodes?.[0]?.committedDate),
    archived: github.isArchived,

    packageUrl: undefined,
    packageSizeBytes: undefined,
    downloads: undefined
  }

  if (npm) {
    payload = {
      ...payload,
      version: npm.manifest.version,
      packageUrl: `https://www.npmjs.com/package/${npm?.name}`,
      packageSizeBytes: npm.manifest.dist.unpackedSize,
      downloads: npm.downloads.downloads
    }
  }

  return {
    action: notion ? 'update' : 'add',
    previousData: notion,
    payload
  }
}

function decorateWith (map, key) {
  return function decorateWithNpmPackage (wrapper) {
    wrapper[key] = map.get(ghSharedKey(wrapper.github))
    return wrapper
  }
}

function ghSharedKey (ghRepo) {
  return `/${ghRepo.owner.login}/${ghRepo.name}`
}

function npmSharedKey (pkg) {
  return `/${pkg.githubId}`
}

function notionSharedKey (line) {
  if (!line.properties.GitHub.url) {
    return null
  }
  return new URL(line.properties.GitHub.url).pathname
}

function toMap (array, genKey) {
  return array.reduce((acc, item) => {
    const key = genKey(item)
    if (key) {
      // the npm key may be undefined if the repo is not published
      acc.set(genKey(item), item)
    }
    return acc
  }, new Map())
}
