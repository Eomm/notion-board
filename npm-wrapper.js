
import pacote from 'pacote'

class NpmWrapper {
  constructor ({ logger }) {
    this.logger = logger

    this._packumentCache = new Map()
  }

  async searchPackages (githubRepos) {
    const packageJsons = githubRepos
      .filter(({ pkg }) => !pkg?.private && pkg?.name) // todo we need to manage { token: npm-token } in the config
      .map(({ pkg }) => pkg)

    return Promise.all(packageJsons.map(this._appendManifest.bind(this)))
  }

  async _appendManifest (pkg, opts) {
    const manifest = await this.getPackageManifest(pkg, opts).catch((err) => {
      this.logger.warn('Error fetching manifest for %s: %s', pkg.name, err.message)
      return null
    })
    return { ...pkg, manifest }
  }

  async getPackageManifest (pkg, opts = { fullMetadata: true }) {
    this.logger.debug('Fetching manifest for %s', pkg.name)

    return pacote.manifest(pkg.name, {
      ...opts,
      packumentCache: this._packumentCache,
      verifySignatures: false
    })
  }
}

export { NpmWrapper }
