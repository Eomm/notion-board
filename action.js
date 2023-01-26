
import { GitHubWrapper } from './github-wrapper.js'
import { NpmWrapper } from './npm-wrapper.js'
import { NotionWrapper } from './notion-wrapper.js'
import * as fs from 'fs'
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

  const githubRepos = await github.searchRepositories(githubRepositoryQuery)
  logger.info('Found %d repositories', githubRepos.length)

  const npmPackages = await npm.searchPackages(githubRepos)
  logger.info('Found %d npm packages', npmPackages.length)
  fs.writeFileSync('./npmPackages-no-meta.json', JSON.stringify(npmPackages, null, 2))
  const notionLines = await notion.readAllDatabase()
  logger.info('Read %d records from notion', notionLines.length)

  const todoList = buildActions({
    githubRepos,
    npmPackages,
    notionLines
  })
  logger.info('Found %d actions to perform', todoList.length)

  for (const item of todoList) {
    switch (item.action) {
      case 'add':
        {
          const result = await notion.addItem(item.payload)
          logger.info('Added item %s', result.url)
        }
        break

      case 'update':
        {
          // todo
          const result = await notion.addItem(item.payload)
          logger.info('Updated item %s', result.url)
        }
        break
      case 'delete':
        // todo
        break
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
  notionLines
}) {
  const githubReposMap = toMap(githubRepos, ghSharedKey)
  const npmPackagesMap = toMap(npmPackages, npmSharedKey)
  const notionLinesMap = toMap(notionLines, notionSharedKey)

  const addAndUpdateActions = githubRepos
    .map(github => ({ github }))
    .map(decorateWith(npmPackagesMap, 'npm'))
    .map(decorateWith(notionLinesMap, 'notion'))
    .map(convertToAction)

  const deleteActions = notionLines
    .filter(removeOldLines(githubReposMap))
    .map(line => ({ action: 'delete', payload: line }))

  return addAndUpdateActions.concat(deleteActions)
}

function removeOldLines (githubReposMap) {
  return function removeOldLines (line) {
    const key = notionSharedKey(line)
    return !githubReposMap.has(key)
  }
}

function convertToAction ({ github, npm, notion }) {
  let action = 'add'

  if (notion) {
    action = 'update'
  }

  return {
    action,
    payload: {
      title: github.name,
      version: npm?.version || github.pkg?.version,
      stars: github.stargazerCount,
      repositoryUrl: github.url,
      packageUrl: npm?.name ? `https://www.npmjs.com/package/${npm?.name}` : undefined,
      issues: 0, // todo
      prs: 0, // todo
      downloads: 0, // todo
      packageSizeBytes: npm?.manifest?.dist.unpackedSize || undefined,
      lastCommitAt: undefined, // todo
      archived: github.isArchived
    }
  }
}

function decorateWith (map, key) {
  return function decorateWithNpmPackage (wrapper) {
    wrapper[key] = map.get(ghSharedKey(wrapper.github))
    return wrapper
  }
}

function ghSharedKey (repo) {
  // todo: what if the repo occurs multiple times?
  // return `${repo.owner.login}/${repo.name}`
  return repo.name
}

function npmSharedKey (pkg) {
  return pkg.name
}

function notionSharedKey (line) {
  // todo use `id` instead of `Project`
  return line.properties.Project.title[0].plain_text
}

function toMap (array, genKey) {
  return array.reduce((acc, item) => {
    acc.set(genKey(item), item)
    return acc
  }, new Map())
}
