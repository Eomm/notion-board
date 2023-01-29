# notion-board

Monitor your Node.js modules and repositories from a [Notion] page!

![status board on notion](./images/preview.png)


## How it works

This project is a GitHub Action that exports a set of data gathered from GitHub and NPM to publish it your [Notion].

The collected data are:

- GitHub repository name
- NPM downloads per month
- GitHub stars
- Number of open issues, optionally filtered by labels
- Number of open pull requests
- Latesr version published on NPM
- Checkbox to mark archived repositories
- Direct link to the repository
- Direct link to the NPM page
- NPM package size in bytes
- Last commit date
- Last edited date

> **Note**  
> The project is still in early development and the data exported are not yet customizable nor configurable.  
> I aim to make this application available from the [Notion Connections](https://www.notion.so/integrations/all) marketplace.


### How it works in details

This GitHub Action will:

- Fetch the list of repositories from GitHub using the provided `github-repository-query` input. You can test the query on [GitHub Search]
- For each repository will check if it's a Node.js module and if it's published on NPM collecting additional data
- Read the Notion database and update the existing rows or create new ones. Unrecognized rows will **be deleted**.

If the row's data is not changed, the row will not be updated.


## Usage

To install this GitHub Action, you need to create a new GitHub repository and add a `.github/workflows/notion-board.yml` file with the following content:

```yml
name: Notion Board

on:
  workflow_dispatch: # Allow manual trigger
  schedule:
    - cron: "0 12 * * *" # "Everyday at 12:00 UTC (5:00 PT)" https://crontab.guru/#0_12_*_*_*

jobs:
  update-notion-board:
    runs-on: ubuntu-latest

    steps:
      - name: Update Notion
        uses: Eomm/notion-board@v0
        with:
          github-repository-query: user:Eomm is:public
          notion-token: ${{ secrets.NOTION_TOKEN }}
          notion-database-id: ${{ secrets.NOTION_DATABASE_ID }}
```


### How to configure Notion

In order to use this GitHub Action, you need to create:

1. A notion integration token to allow the GitHub Action to update the database
2. A notion database to store the data

To get the token, you must follow the [official Notion documentation to create the required resources](https://developers.notion.com/docs/create-a-notion-integration).  
Note that you must add the following `Capabilities` to the integration:
- Read content
- Update content
- Insert content

You can stop at the _"Step 4: Add an item to the database"_ section.

Finally, when you are about to create the new database, you need to use the following [database template].

> **Warning**  
> The database template can't be modified otherwise the GitHub Action will not work. The columns' name and type are important.


## Inputs

| Input | Description | Required | Default |
| --- | --- | --- | --- |
| `github-repository-query` | The GitHub repository query to fetch the repositories to monitor. You can test the query on [GitHub Search] | Yes | |
| `github-issue-labels`     | Filter the issues counter by labels. Example: `good first issue` | No | |
| `notion-token`            | The Notion API key to use to update the database | Yes | |
| `notion-database-id`      | The Notion database ID to update | Yes | |
| `github-token`            | The GitHub token to use to fetch the repositories | No | `${{github.token}}` |
| `log-level`               | The log level to use | No | `info` |


## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).


  [database template]: https://eomm.notion.site/repository-name-259756cfa17b4ec18f2a9d3e6f66c562
  [Notion]: https://www.notion.so/
  [GitHub Search]: https://github.com/search/
