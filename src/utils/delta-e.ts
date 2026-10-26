/**
 * Standard CIELAB Delta E 2000 (dE00) Color Difference Algorithm
 * Implementation conforms to CIE Publication 142-2001 and Gaurav Sharma et al. (2005)
 */

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
  kL: number = 1,
  kC: number = 1,
  kH: number = 1
): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  // 1. Calculate C1, C2, and mean C
  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const meanC = (C1 + C2) / 2

  // 2. Factor G
  const meanC7 = Math.pow(meanC, 7)
  const twentyFive7 = 6103515625 // 25^7
  const G = 0.5 * (1 - Math.sqrt(meanC7 / (meanC7 + twentyFive7)))

  // 3. Adjusted a', C'
  const a1Prime = (1 + G) * a1
  const a2Prime = (1 + G) * a2
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1)
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2)

  // 4. Calculate h1', h2' (in degrees [0..360])
  let h1Prime = radToDeg(Math.atan2(b1, a1Prime))
  if (h1Prime < 0) h1Prime += 360
  let h2Prime = radToDeg(Math.atan2(b2, a2Prime))
  if (h2Prime < 0) h2Prime += 360

  // 5. Deltas
  const deltaLPrime = L2 - L1
  const deltaCPrime = C2Prime - C1Prime

  let deltahPrime = 0
  if (C1Prime * C2Prime !== 0) {
    const diff = h2Prime - h1Prime
    if (Math.abs(diff) <= 180) {
      deltahPrime = diff
    } else if (diff > 180) {
      deltahPrime = diff - 360
    } else {
      deltahPrime = diff + 360
    }
  }

  const deltaHPrime =
    2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(degToRad(deltahPrime / 2))

  // 6. Mean L', C', h'
  const meanLPrime = (L1 + L2) / 2
  const meanCPrime = (C1Prime + C2Prime) / 2

  let meanHPrime = 0
  if (C1Prime * C2Prime === 0) {
    meanHPrime = h1Prime + h2Prime
  } else {
    const diff = Math.abs(h1Prime - h2Prime)
    if (diff <= 180) {
      meanHPrime = (h1Prime + h2Prime) / 2
    } else if (h1Prime + h2Prime < 360) {
      meanHPrime = (h1Prime + h2Prime + 360) / 2
    } else {
      meanHPrime = (h1Prime + h2Prime - 360) / 2
    }
  }

  // 7. Calculate T
  const T =
    1 -
    0.17 * Math.cos(degToRad(meanHPrime - 30)) +
    0.24 * Math.cos(degToRad(2 * meanHPrime)) +
    0.32 * Math.cos(degToRad(3 * meanHPrime + 6)) -
    0.2 * Math.cos(degToRad(4 * meanHPrime - 63))

  // 8. Weighting functions SL, SC, SH
  const meanLMinus50Sq = Math.pow(meanLPrime - 50, 2)
  const SL = 1 + (0.015 * meanLMinus50Sq) / Math.sqrt(20 + meanLMinus50Sq)
  const SC = 1 + 0.045 * meanCPrime
  const SH = 1 + 0.015 * meanCPrime * T

  // 9. Rotation term RT
  const deltaTheta =
    30 * Math.exp(-Math.pow((meanHPrime - 275) / 25, 2))
  const meanCPrime7 = Math.pow(meanCPrime, 7)
  const RC = 2 * Math.sqrt(meanCPrime7 / (meanCPrime7 + twentyFive7))
  const RT = -Math.sin(degToRad(2 * deltaTheta)) * RC

  // 10. Total Delta E 2000
  const dLTerm = deltaLPrime / (kL * SL)
  const dCTerm = deltaCPrime / (kC * SC)
  const dHTerm = deltaHPrime / (kH * SH)

  const dE2000Sq =
    dLTerm * dLTerm +
    dCTerm * dCTerm +
    dHTerm * dHTerm +
    RT * dCTerm * dHTerm

  return Math.sqrt(Math.max(0, dE2000Sq))
}
