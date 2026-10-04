/**
 * Utilities for formatting and handling Study Lounge Desks / Cabins across Halls
 */

/**
 * Extracts the short display number/identifier of a desk within its hall.
 * e.g., "Black Hall - Desk 5" -> "5"
 * e.g., "Brown Hall - Desk 12" -> "12"
 * e.g., "D-05" -> "5"
 */
export function getDeskDisplayNumber(seatNumber: string, hallName?: string): string {
  if (!seatNumber || seatNumber === 'Unassigned') return seatNumber || 'Unassigned'

  let clean = seatNumber.trim()
  if (hallName && clean.toLowerCase().startsWith(hallName.toLowerCase())) {
    clean = clean.slice(hallName.length).replace(/^[\s\-#:]+/, '')
  } else if (clean.includes(' - ')) {
    const parts = clean.split(' - ')
    clean = parts[parts.length - 1].trim()
  }

  // Remove "Desk " or "D-" prefix if present
  clean = clean.replace(/^(?:Desk|Cabin|Seat)[\s\-_]*/i, '')
  clean = clean.replace(/^[DF]-0*/i, '')

  return clean || seatNumber
}

/**
 * Returns formatted label like "Desk 5"
 */
export function getDeskLabel(seatNumber: string, hallName?: string): string {
  if (!seatNumber || seatNumber === 'Unassigned') return 'Unassigned'
  const num = getDeskDisplayNumber(seatNumber, hallName)
  if (/^\d+[A-Za-z]?$/.test(num)) {
    return `Desk ${num}`
  }
  return num.startsWith('Desk ') ? num : `Desk ${num}`
}

/**
 * Returns full descriptive label with Hall Name, e.g. "Desk 5 (Black Hall)"
 */
export function getDeskFullLabel(seatNumber: string, hallName?: string): string {
  if (!seatNumber || seatNumber === 'Unassigned') return 'Unassigned'
  const label = getDeskLabel(seatNumber, hallName)
  if (hallName && !label.toLowerCase().includes(hallName.toLowerCase())) {
    return `${label} (${hallName})`
  }
  return label
}
