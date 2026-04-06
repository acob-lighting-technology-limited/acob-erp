export function isChristmasPeriod(date = new Date()): boolean {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  return year === 2026 && month === 12
}

export function isTemporary2026LogoPeriod(date = new Date()): boolean {
  return date.getFullYear() === 2026 && !isChristmasPeriod(date)
}

export function getSeasonalLogoPaths(theme: "light" | "dark", date = new Date()) {
  const isChristmas = isChristmasPeriod(date)
  const use2026Logo = isTemporary2026LogoPeriod(date)

  if (isChristmas) {
    return {
      navbar: theme === "dark" ? "/images/acob-logo-dark-christmas.webp" : "/images/acob-logo-light-christmas.webp",
      full: "/images/acob-logo-light-christmas.webp",
      icon: "/images/acob-logo-dark-christmas.webp",
    }
  }

  if (use2026Logo) {
    return {
      navbar: theme === "dark" ? "/images/acob-logo-dark-2026.webp" : "/images/acob-logo-light-2026.webp",
      full: "/images/acob-logo-light-2026.webp",
      icon: "/images/acob-logo-dark-2026.webp",
    }
  }

  return {
    navbar: theme === "dark" ? "/images/acob-logo-dark.webp" : "/images/acob-logo-light.webp",
    full: "/images/acob-logo-light.webp",
    icon: "/images/acob-logo-dark.webp",
  }
}
