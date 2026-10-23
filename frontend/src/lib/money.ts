const fcfaFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

function quantityInMilliunits(quantity: string | number) {
  const [integer, fraction = ''] = String(quantity).split('.')
  if (!/^\d+$/.test(integer) || !/^\d{0,3}$/.test(fraction)) {
    throw new RangeError('La quantité doit avoir au plus trois décimales.')
  }
  return BigInt(integer) * 1000n + BigInt(fraction.padEnd(3, '0') || '0')
}

export function calculateFcfaLineAmount(quantity: string | number, unitPrice: string | number) {
  const cents = priceInCentimes(unitPrice)
  const product = quantityInMilliunits(quantity) * cents
  return (product + 50_000n) / 100_000n
}

export function formatFcfa(amount: bigint | number | string) {
  return `${fcfaFormat.format(typeof amount === 'bigint' ? amount : BigInt(amount))} F CFA`
}

export function formatFcfaUnitPrice(amount: string | number) {
  return `${fcfaFormat.format((priceInCentimes(amount) + 50n) / 100n)} F CFA`
}

function priceInCentimes(value: string | number) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) throw new RangeError('Le prix stocké est invalide.')
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0')
}
