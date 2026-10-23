import assert from 'node:assert/strict'

import { buildQuery, toGraphqlAlias } from './queries/github-search.js'
import { GitHubWrapper } from './libs/github-wrapper.js'
import { NpmWrapper } from './libs/npm-wrapper.js'
import { NotionWrapper } from './libs/notion-wrapper.js'
import { upsertStatusBoard } from './action.js'

// alias sanitization: spaces, hyphens, leading digit, emoji, empty
assert.equal(toGraphqlAlias('good first issue'), 'goodFirstIssue')
assert.equal(toGraphqlAlias('needs-triage'), 'needsTriage')
assert.equal(toGraphqlAlias('1.0'), 'x10')
assert.equal(toGraphqlAlias('bug'), 'bug')
assert.equal(toGraphqlAlias(''), 'x')
assert.equal(toGraphqlAlias('🚨 urgent'), 'urgent')

// query: empty columns preserves the original shape
const empty = buildQuery()
assert.ok(empty.includes('issues(states: OPEN, labels: $issueLabels)'))
assert.ok(!empty.includes(': issues(states: OPEN, labels: ['))

// query: each label becomes an aliased field
const q = buildQuery(['good first issue', 'triage', 'stale'])
assert.ok(q.includes('goodFirstIssue: issues(states: OPEN, labels: ["good first issue"])'))
assert.ok(q.includes('triage: issues(states: OPEN, labels: ["triage"])'))
assert.ok(q.includes('stale: issues(states: OPEN, labels: ["stale"])'))

// query: a quote in a label must be escaped
const escaped = buildQuery(['he said "hi"'])
assert.ok(escaped.includes('labels: ["he said \\"hi\\""]'))

function makeLogger () {
  const entries = []
  const logger = { entries }
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level] = (...args) => entries.push({ level, args })
  }
  return logger
}

function makeGithub (pageSize = 30) {
  const logger = makeLogger()
  return new GitHubWrapper({ auth: 'test-token', logger, options: { pageSize } })
}

function page (nodes, endCursor, hasNextPage = false) {
  return { search: { nodes, pageInfo: { endCursor, hasNextPage } } }
}

function httpError (status) {
  return Object.assign(new Error('<html>Bad Gateway</html>'), {
    status,
    response: { headers: { 'x-github-request-id': 'request-123' } },
    request: { headers: { authorization: 'secret-token' } },
    data: page([{ name: 'partial-result-must-not-be-used' }], 'bad-cursor')
  })
}

// Successful pagination preserves filters, dynamic columns and package normalization.
{
  const github = makeGithub()
  const calls = []
  github.octokit = {
    async graphql (query, variables) {
      calls.push({ query, variables })
      return calls.length === 1
        ? page([{ name: 'one', pkg: { text: '{"name":"one","version":"1.0.0"}' } }], 'cursor-1', true)
        : page([{ name: 'two' }], 'cursor-2')
    }
  }
  const repos = await github.searchRepositories('user:example', ['bug'], ['triage'])
  assert.deepEqual(repos, [{ name: 'one', pkg: { name: 'one', version: '1.0.0' } }, { name: 'two' }])
  assert.deepEqual(calls.map(c => c.variables), [
    { searchQuery: 'user:example', issueLabels: ['bug'], first: 30, after: undefined },
    { searchQuery: 'user:example', issueLabels: ['bug'], first: 30, after: 'cursor-1' }
  ])
  assert.equal(calls[0].query, buildQuery(['triage']))
  assert.equal(github.logger.entries.filter(e => e.args[1] === 'GitHub GraphQL search page completed').length, 2)
}

// Timeouts at both the first and a later page shrink work, keeping the cursor
// and successful nodes. Neither failed partial results nor duplicates escape.
{
  const github = makeGithub()
  const calls = []
  github.octokit = {
    async graphql (query, variables) {
      calls.push(variables)
      switch (calls.length) {
        case 1: throw httpError(502)
        case 2: return page([{ name: 'one' }], 'cursor-1', true)
        case 3: throw httpError(504)
        case 4: return page([{ name: 'two' }], 'cursor-2', true)
        case 5: return page([{ name: 'three' }], 'cursor-3')
        default: assert.fail('Unexpected extra request')
      }
    }
  }
  assert.deepEqual(await github.searchRepositories('user:example'), [
    { name: 'one' }, { name: 'two' }, { name: 'three' }
  ])
  assert.deepEqual(calls.map(({ first, after }) => [first, after]), [
    [30, undefined], [15, undefined], [15, 'cursor-1'], [7, 'cursor-1'], [7, 'cursor-2']
  ])
  assert.ok(calls.every(c => c.issueLabels === undefined))
  const warnings = github.logger.entries.filter(e => e.level === 'warn')
  assert.equal(warnings.length, 2)
  assert.equal(warnings[1].args[0].status, 504)
  assert.equal(warnings[1].args[0].requestId, 'request-123')
  assert.equal(warnings[1].args[0].cursor, 'cursor-1')
  assert.equal(warnings[1].args[0].page, 2)
  assert.equal(warnings[1].args[0].nextPageSize, 7)
  assert.ok(warnings[1].args[0].elapsedMs >= 0)
  assert.ok(!JSON.stringify(github.logger.entries).includes('secret-token'))
}

// Persistent failures terminate at one repository, rather than loop/retry forever.
for (const status of [502, 504]) {
  const github = makeGithub(100)
  const sizes = []
  const error = httpError(status)
  github.octokit = {
    async graphql (query, { first }) {
      sizes.push(first)
      throw error
    }
  }
  await assert.rejects(github.searchRepositories('user:example'), err => {
    assert.equal(err.cause, error)
    assert.ok(err.message.includes(`GitHub GraphQL search failed on page 1 (page-size 1, status ${status}, request-id request-123)`))
    return true
  })
  assert.deepEqual(sizes, [100, 50, 25, 12, 6, 3, 1])
  assert.equal(github.logger.entries.filter(e => e.level === 'error').length, 1)
}

// Auth, rate limit, validation, transport and GraphQL partial-data errors fail
// immediately. Request IDs are available on different Octokit error shapes.
for (const status of [401, 403, 429, 500, 422, undefined]) {
  const github = makeGithub()
  let count = 0
  const error = Object.assign(new Error('request failed'), {
    status,
    headers: { 'x-github-request-id': 'graphql-request' },
    data: page([{ name: 'partial' }], 'cursor-1'),
    errors: [{ type: 'RATE_LIMITED' }]
  })
  github.octokit = {
    async graphql () {
      count++
      throw error
    }
  }
  await assert.rejects(github.searchRepositories('user:example'), {
    cause: error,
    message: new RegExp(`status ${status ?? 'unknown'}, request-id graphql-request`)
  })
  assert.equal(count, 1)
}

for (const pageSize of [0, 101, NaN, 1.5]) {
  assert.throws(() => makeGithub(pageSize), /page-size must be an integer between 1 and 100/)
}
assert.throws(() => new GitHubWrapper({ options: { pageSize: undefined } }), /page-size must be an integer between 1 and 100/)
{
  const github = makeGithub(1)
  let count = 0
  github.octokit = {
    async graphql () {
      count++
      return page([], 'unchanged', true)
    }
  }
  await assert.rejects(github.searchRepositories('user:example'), /non-advancing cursor on page 2/)
  assert.equal(count, 2)
}

// A failed GitHub search must not progress to npm or Notion reads/writes:
// partial search results must never cause deletion of existing board rows.
{
  const originals = {
    prepareDatabase: NotionWrapper.prototype.prepareDatabase,
    searchRepositories: GitHubWrapper.prototype.searchRepositories,
    searchPackages: NpmWrapper.prototype.searchPackages,
    readAllDatabase: NotionWrapper.prototype.readAllDatabase
  }
  const logger = makeLogger()
  const stages = []
  try {
    NotionWrapper.prototype.prepareDatabase = async () => { stages.push('notion-setup') }
    GitHubWrapper.prototype.searchRepositories = async () => {
      stages.push('github-search')
      throw new Error('GitHub GraphQL search failed: status 502')
    }
    NpmWrapper.prototype.searchPackages = async () => assert.fail('npm must not run')
    NotionWrapper.prototype.readAllDatabase = async () => assert.fail('Notion reads/writes must not run')
    await assert.rejects(upsertStatusBoard({
      logger,
      githubToken: 'test-token',
      githubRepositoryQuery: 'user:example',
      notionToken: 'test-notion-token',
      databaseId: 'test-database',
      options: { pageSize: 10, deleteAdditionalRows: true }
    }), /GitHub repository search failed: GitHub GraphQL search failed: status 502/)
    assert.deepEqual(stages, ['notion-setup', 'github-search'])
    assert.ok(logger.entries.some(e => e.level === 'error' && e.args[0].stage === 'GitHub repository search'))
  } finally {
    NotionWrapper.prototype.prepareDatabase = originals.prepareDatabase
    GitHubWrapper.prototype.searchRepositories = originals.searchRepositories
    NpmWrapper.prototype.searchPackages = originals.searchPackages
    NotionWrapper.prototype.readAllDatabase = originals.readAllDatabase
  }
}

console.log('self-check ok')
