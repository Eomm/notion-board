# notion-board

Monitor your Node.js modules and repositories from a [Notion] page!

[![status board on notion](./images/preview.png)](./images/preview.png)


## How it works

This project is a GitHub Action that exports a set of data gathered from GitHub and NPM to publish it your [Notion].

Doing so you will be able to monitor and filter your Node.js modules and repositories from a single page and much more.  
Here an example of the [Fastify organization's status board](https://eomm.notion.site/7a064537ee794af698684df68e215b54?v=a660ff01ca5344769a5f2b1a1c4eeda4)!

The collected data are:

- GitHub repository name
- NPM downloads per month
- GitHub stars
- GitHub topics
- Number of open issues, optionally filtered by labels
- Number of open pull requests
- Latest version published on NPM
- Checkbox to mark archived repositories
- Direct link to the repository
- Direct link to the NPM page
- NPM package size in bytes
- Last commit date
- Last edited date

Here is a sample [database template] it will be used to store the data.

> **Note**  
> The project is still in early development and the data exported are not yet customizable nor configurable.  
> I aim to make this application available from the [Notion Connections](https://www.notion.so/integrations/all) marketplace.


### How it works in details

This GitHub Action will:

- Create all the missing columns into the Notion database
- Fetch the list of repositories from GitHub using the provided `github-repository-query` input. You can test the query on [GitHub Search]
- For each repository will check if it's a Node.js module and if it's published on NPM collecting additional data
- Read the Notion database and update the existing rows or create new ones

#### Known behaviors

- Unrecognized columns will be **untouched**
- If the row's data is not changed, the row will not be updated to minimize the API calls


## Usage

To install this GitHub Action, you need to create a new GitHub repository and add a `.github/workflows/notion-board.yml` file with the following content:

```yml
name: Notion Board

on:
  workflow_dispatch: # Allow manual trigger to force the update
  schedule:
    - cron: "0 12 * * *" # Sync it "Everyday at 12:00 UTC (5:00 PT)" https://crontab.guru/#0_12_*_*_*

jobs:
  update-notion-board:
    runs-on: ubuntu-latest

    steps:
      - name: Update Notion
        uses: Eomm/notion-board@v0
        with:
          github-repository-query: user:Eomm is:public # Replace with your query eg: "org:fastify"
          notion-token: ${{ secrets.NOTION_TOKEN }}
          notion-database-id: ${{ secrets.NOTION_DATABASE_ID }}
```


### How to configure Notion

In order to use this GitHub Action, you need to create:

1. A notion integration token to allow the GitHub Action to update the database
2. An empty notion database to store the data

#### Create the Notion API token

To get the token, you must follow the [official Notion documentation][1] to create the required resources.  
Note that you must add the following `Capabilities` to the integration:

- _Read content_: to read the database and skip the unchanged rows
- _Update content_: to update existing rows, minimizing the payload
- _Insert content_: to insert new rows

#### Create the Notion database

To create the database, you can follow the [official Notion documentation][2] or follow this quick guide:

Step | Description
--- | ---
![](./images/step-1.png) | Create an empty page
![](./images/step-2.png) | Create an empty inline database
![](./images/step-3.png) | Add to the page, the connection you created to get the API token
![](./images/step-4.png) | Share the database link to get a link that [contains the ID][3]
Last step | Add the database ID to the GitHub Action secrets

> **Note**  
> The Action will add to the database all the necessary columns.
> If you rename the columns or change the column's type, the columns will be added again.
> So, **right now you can't change the columns' name** or type.


## Inputs

| Input | Description | Required | Default |
| --- | --- | --- | --- |
| `github-repository-query` | The GitHub repository query to fetch the repositories to monitor. You can test the query on [GitHub Search] | Yes | |
| `github-issue-labels`     | Filter the issues counter by labels. Example: `good first issue` | No | |
| `github-issue-columns`    | Add one Notion column per label with the open issues count for that label. Comma-separated list. Example: `good first issue,triage,stale` | No | |
| `notion-token`            | The Notion API key to use to update the database | Yes | |
| `notion-database-id`      | The Notion database ID to update | Yes | |
| `github-token`            | The GitHub token to use to fetch the repositories | No | `${{github.token}}` |
| `delete-additional-rows`  | Delete Notion database's rows if they are not present in the GitHub query. | No | `true` |
| `log-level`               | The log level to use | No | `info` |
| `page-size`               | Initial GitHub query page size (1-100). Automatically reduced on GitHub 502/504 timeouts. | No | `10` |

### Troubleshooting network failures

The request sequence is: Notion database retrieval (and schema update if columns
are missing), GitHub GraphQL repository search (one request per page), npm
registry manifests and download counts, Notion row queries (paginated), then
Notion row creates, updates and deletes. Each stage logs its start, completion
and failure. GitHub page diagnostics include the cursor, page size, elapsed time,
HTTP status and request ID when available; they do not log tokens or request headers.

An HTML `502 Bad Gateway` after `DB Mapping ready` but before `Found ... repositories`
comes from the GitHub search stage, not a subsequent Notion request. GitHub
[terminates queries that take more than 10 seconds][graphql-limits], returning
502 or 504. Large repository pages with nested issue, release, topic, commit and
package queries can reach this limit. The default page size is 10. If a page
times out, the action halves its size at the same cursor and retains the smaller
size for later pages. It stops if a single-repository request still fails; it
does not blindly retry the same expensive query or accept partial results.
Other errors fail immediately.

### Notion API compatibility

This action currently uses SDK v2 and its `2022-06-28` API version for
single-data-source databases. The [official SDK compatibility table][notion-sdk]
and [v5 migration notes][notion-v5] distinguish this API from `2025-09-03`.
The latter separates database containers from data sources: retrieve the
database to discover its `data_sources`, retrieve/update properties and query
rows through `dataSources.*`, and create pages with a `data_source_id` parent.
Page updates use `page_id` and properties, not a new parent.
The existing `databases.retrieve` properties, `databases.update` schema,
`databases.query` and `database_id` create parent must not be carried unchanged
into an SDK v5 upgrade. Multi-data-source databases require that coordinated
migration and explicit source selection; they are not supported by this action.
The GitHub timeout fix intentionally does not change the Notion API version.


## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).


  [1]: https://developers.notion.com/docs/create-a-notion-integration#step-1-create-an-integration
  [2]: https://developers.notion.com/docs/create-a-notion-integration#step-2-share-a-database-with-your-integration
  [3]: https://developers.notion.com/docs/create-a-notion-integration#step-3-save-the-database-id
  [database template]: https://eomm.notion.site/repository-name-259756cfa17b4ec18f2a9d3e6f66c562
  [Notion]: https://www.notion.so/
  [GitHub Search]: https://github.com/search/
  [graphql-limits]: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api#timeouts
  [notion-sdk]: https://github.com/makenotion/notion-sdk-js#requirements-and-compatibility
  [notion-v5]: https://github.com/makenotion/notion-sdk-js/releases/tag/v5.0.0
