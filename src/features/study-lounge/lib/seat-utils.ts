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

/**
 * Sorts seats array in natural numerical order based on their desk number.
 * e.g., 1, 2, 3, 4 ... 9, 10, 11 ... 29, 30 (instead of lexicographical 1, 10, 11, ... 2, 20)
 */
export function sortSeatsNaturally<T extends { seatNumber: string; section?: string }>(
  seats: T[],
  hallName?: string
): T[] {
  return [...seats].sort((a, b) => {
    // First, sort by section/hall if different
    const secA = (a.section || '').trim()
    const secB = (b.section || '').trim()
    if (secA && secB && secA.toLowerCase() !== secB.toLowerCase()) {
      return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' })
    }

    const numStrA = getDeskDisplayNumber(a.seatNumber, hallName || a.section)
    const numStrB = getDeskDisplayNumber(b.seatNumber, hallName || b.section)

    const intA = parseInt(numStrA, 10)
    const intB = parseInt(numStrB, 10)

    if (!isNaN(intA) && !isNaN(intB)) {
      if (intA !== intB) {
        return intA - intB
      }
    }

    return numStrA.localeCompare(numStrB, undefined, { numeric: true, sensitivity: 'base' })
  })
}

