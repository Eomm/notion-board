import assert from 'node:assert/strict'

import { buildQuery, toGraphqlAlias } from './queries/github-search.js'

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

console.log('self-check ok')
