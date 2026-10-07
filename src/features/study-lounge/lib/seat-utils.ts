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

export interface DeskSlot<T = any> {
  type: 'seat' | 'missing'
  seat?: T
  displayNumber: string
  numericNumber?: number
}

export interface DeskRow<T = any> {
  rowLabel: string
  rangeLabel: string
  leftBay: DeskSlot<T>[]
  rightBay: DeskSlot<T>[]
  allSlots: DeskSlot<T>[]
  totalExistingSeats: number
}

export interface DeskZone<T = any> {
  id: string
  title: string
  rangeLabel: string
  rows: DeskRow<T>[]
  allSeats: T[]
  totalSeats: number
}

export interface DeskPod<T = any> {
  podId: string
  podLabel: string
  slots: DeskSlot<T>[]
  totalSeats: number
}

/**
 * Intelligently groups seats of a hall into logical Zones (e.g. Desks 1-30 vs Desks 80-96)
 * and rows with Left/Right bays separated by a central aisle/walkway.
 */
export function groupSeatsIntoZones<T extends { seatNumber: string; section?: string }>(
  seats: T[],
  hallName?: string
): DeskZone<T>[] {
  if (seats.length === 0) return []

  const sorted = sortSeatsNaturally(seats, hallName)

  // Partition seats into contiguous batches/zones based on numeric gaps (> 5)
  const zoneGroups: T[][] = []
  let currentGroup: T[] = []
  let prevNum: number | null = null

  for (const seat of sorted) {
    const rawNum = getDeskDisplayNumber(seat.seatNumber, hallName)
    const intNum = parseInt(rawNum, 10)

    if (!isNaN(intNum)) {
      if (prevNum !== null && intNum - prevNum > 5) {
        // Gap detected! (e.g. 30 -> 80)
        if (currentGroup.length > 0) {
          zoneGroups.push(currentGroup)
        }
        currentGroup = [seat]
      } else {
        currentGroup.push(seat)
      }
      prevNum = intNum
    } else {
      // Non-numeric desks
      if (currentGroup.length >= 10) {
        zoneGroups.push(currentGroup)
        currentGroup = [seat]
      } else {
        currentGroup.push(seat)
      }
      prevNum = null
    }
  }

  if (currentGroup.length > 0) {
    zoneGroups.push(currentGroup)
  }

  // Build DeskZone objects for each partition
  return zoneGroups.map((group, zIndex) => {
    const zoneNumList = group
      .map((s) => parseInt(getDeskDisplayNumber(s.seatNumber, hallName), 10))
      .filter((n) => !isNaN(n))

    const isNumericZone = zoneNumList.length > 0
    const minNum = isNumericZone ? Math.min(...zoneNumList) : 1
    const maxNum = isNumericZone ? Math.max(...zoneNumList) : group.length

    const zoneTitle =
      zoneGroups.length === 1
        ? 'Main Seating Area'
        : `Zone ${String.fromCharCode(65 + zIndex)}`
    const rangeLabel = isNumericZone
      ? minNum === maxNum
        ? `Desk ${minNum}`
        : `Desks ${minNum} – ${maxNum}`
      : `${group.length} Desks`

    const rows: DeskRow<T>[] = []

    if (isNumericZone) {
      // Map existing seats by integer number
      const seatMap = new Map<number, T>()
      group.forEach((s) => {
        const num = parseInt(getDeskDisplayNumber(s.seatNumber, hallName), 10)
        if (!isNaN(num)) seatMap.set(num, s)
      })

      // Group into rows of up to 10 numbers
      let rowStart = minNum
      let rowIdx = 1

      while (rowStart <= maxNum) {
        // Align rows nicely (e.g., 1..10, 11..20, 21..30 or 80..89)
        let rowEnd = Math.min(rowStart + 9, maxNum)
        // If rowStart % 10 === 1, align to next multiple of 10
        if (rowStart % 10 !== 0 && rowStart + (10 - (rowStart % 10)) - 1 <= maxNum) {
          rowEnd = rowStart + (10 - (rowStart % 10))
        }

        const slots: DeskSlot<T>[] = []
        for (let k = rowStart; k <= rowEnd; k++) {
          if (seatMap.has(k)) {
            slots.push({
              type: 'seat',
              seat: seatMap.get(k),
              displayNumber: String(k),
              numericNumber: k,
            })
          } else {
            // Missing number in range (e.g. 23)
            slots.push({
              type: 'missing',
              displayNumber: String(k),
              numericNumber: k,
            })
          }
        }

        const mid = Math.min(5, Math.ceil(slots.length / 2))
        const leftBay = slots.slice(0, mid)
        const rightBay = slots.slice(mid)
        const existingCount = slots.filter((s) => s.type === 'seat').length

        if (existingCount > 0) {
          rows.push({
            rowLabel: `Row ${rowIdx}`,
            rangeLabel: `${rowStart} – ${rowEnd}`,
            leftBay,
            rightBay,
            allSlots: slots,
            totalExistingSeats: existingCount,
          })
          rowIdx++
        }

        rowStart = rowEnd + 1
      }
    } else {
      // Non-numeric desks: simply split into chunks of 10
      const chunkSize = 10
      for (let i = 0; i < group.length; i += chunkSize) {
        const chunk = group.slice(i, i + chunkSize)
        const slots: DeskSlot<T>[] = chunk.map((s) => ({
          type: 'seat',
          seat: s,
          displayNumber: getDeskDisplayNumber(s.seatNumber, hallName),
        }))
        const mid = Math.ceil(slots.length / 2)
        rows.push({
          rowLabel: `Row ${Math.floor(i / chunkSize) + 1}`,
          rangeLabel: `${slots[0].displayNumber} – ${slots[slots.length - 1].displayNumber}`,
          leftBay: slots.slice(0, mid),
          rightBay: slots.slice(mid),
          allSlots: slots,
          totalExistingSeats: slots.length,
        })
      }
    }

    return {
      id: `zone-${zIndex}`,
      title: zoneTitle,
      rangeLabel,
      rows,
      allSeats: group,
      totalSeats: group.length,
    }
  })
}

/**
 * Groups seats into Study Pods (e.g., 4-seater facing tables)
 */
export function groupSeatsIntoPods<T extends { seatNumber: string; section?: string }>(
  seats: T[],
  hallName?: string,
  podSize = 4
): DeskPod<T>[] {
  const sorted = sortSeatsNaturally(seats, hallName)
  const pods: DeskPod<T>[] = []

  for (let i = 0; i < sorted.length; i += podSize) {
    const chunk = sorted.slice(i, i + podSize)
    const slots: DeskSlot<T>[] = chunk.map((s) => ({
      type: 'seat',
      seat: s,
      displayNumber: getDeskDisplayNumber(s.seatNumber, hallName),
    }))

    pods.push({
      podId: `pod-${Math.floor(i / podSize) + 1}`,
      podLabel: `Table Pod ${Math.floor(i / podSize) + 1}`,
      slots,
      totalSeats: slots.length,
    })
  }

  return pods
}

