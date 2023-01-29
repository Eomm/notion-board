
import pacote from 'pacote'
import fetch from 'node-fetch'

class NpmWrapper {
  constructor ({ logger }) {
    this.logger = logger

    this._packumentCache = new Map()
  }

  async searchPackages (githubRepos) {
    const packageJsons = githubRepos
      .filter(({ pkg }) => !pkg?.private && pkg?.name) // todo we need to manage { token: npm-token } in the config
      .map(({ pkg }) => pkg)

    return Promise.all(packageJsons.map(this._appendExternalData.bind(this)))
  }

  async _appendExternalData (pkg, opts) {
    const manifest = await this.getPackageManifest(pkg, opts).catch((err) => {
      this.logger.warn('Error fetching manifest for %s: %s', pkg.name, err.message)
      return null
    })

    let downloads
    if (manifest) {
      downloads = await this.getPackageDownloads(pkg.name)
    }

    return { ...pkg, manifest, downloads }
  }

  async getPackageManifest (pkg, opts = { fullMetadata: true }) {
    this.logger.debug('Fetching manifest for %s', pkg.name)

    return pacote.manifest(pkg.name, {
      ...opts,
      packumentCache: this._packumentCache,
      verifySignatures: false
    })
  }

  async getPackageDownloads (name) {
    return await fetch(`https://api.npmjs.org/downloads/point/last-month/${name}`)
      .then((res) => res.ok ? res.json() : null)
      .catch((err) => {
        this.logger.warn('Error fetching downloads for %s: %s', name, err.message)
        return null
      })
  }
}

export { NpmWrapper }
