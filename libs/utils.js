
export function toJsDateString (date) {
  if (date) {
    const d = new Date(date)

    // notion dates are rounded to the minute
    d.setSeconds(0)

    return d.toISOString()
  }
}
