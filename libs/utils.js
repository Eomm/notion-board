
import fs from 'fs'

export function toJsDateString (date) {
  if (date) {
    const d = new Date(date)

    // notion dates are rounded to the minute
    d.setSeconds(0)

    return d.toISOString()
  }
}

export function filefy (json, fileName) {
  fs.writeFileSync(`./${fileName}.json`, JSON.stringify(json, null, 2))
}
