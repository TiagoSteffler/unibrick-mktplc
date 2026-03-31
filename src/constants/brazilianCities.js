const CITY_CACHE_KEY = 'marketplace_brazilian_cities_v2'
const CITY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 dias
const IBGE_MUNICIPALITIES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'

const REGION_PRIORITY = ['Sul', 'Sudeste', 'Centro-Oeste', 'Nordeste', 'Norte']

const BRAZILIAN_STATES = {
  AC: { name: 'Acre', region: 'Norte' },
  AL: { name: 'Alagoas', region: 'Nordeste' },
  AP: { name: 'Amapa', region: 'Norte' },
  AM: { name: 'Amazonas', region: 'Norte' },
  BA: { name: 'Bahia', region: 'Nordeste' },
  CE: { name: 'Ceara', region: 'Nordeste' },
  DF: { name: 'Distrito Federal', region: 'Centro-Oeste' },
  ES: { name: 'Espirito Santo', region: 'Sudeste' },
  GO: { name: 'Goias', region: 'Centro-Oeste' },
  MA: { name: 'Maranhao', region: 'Nordeste' },
  MT: { name: 'Mato Grosso', region: 'Centro-Oeste' },
  MS: { name: 'Mato Grosso do Sul', region: 'Centro-Oeste' },
  MG: { name: 'Minas Gerais', region: 'Sudeste' },
  PA: { name: 'Para', region: 'Norte' },
  PB: { name: 'Paraiba', region: 'Nordeste' },
  PR: { name: 'Parana', region: 'Sul' },
  PE: { name: 'Pernambuco', region: 'Nordeste' },
  PI: { name: 'Piaui', region: 'Nordeste' },
  RJ: { name: 'Rio de Janeiro', region: 'Sudeste' },
  RN: { name: 'Rio Grande do Norte', region: 'Nordeste' },
  RS: { name: 'Rio Grande do Sul', region: 'Sul' },
  RO: { name: 'Rondonia', region: 'Norte' },
  RR: { name: 'Roraima', region: 'Norte' },
  SC: { name: 'Santa Catarina', region: 'Sul' },
  SP: { name: 'Sao Paulo', region: 'Sudeste' },
  SE: { name: 'Sergipe', region: 'Nordeste' },
  TO: { name: 'Tocantins', region: 'Norte' },
}

const brazilianCapitals = [
  { city: 'Aracaju', uf: 'SE' },
  { city: 'Belem', uf: 'PA' },
  { city: 'Belo Horizonte', uf: 'MG' },
  { city: 'Boa Vista', uf: 'RR' },
  { city: 'Brasilia', uf: 'DF' },
  { city: 'Campo Grande', uf: 'MS' },
  { city: 'Cuiaba', uf: 'MT' },
  { city: 'Curitiba', uf: 'PR' },
  { city: 'Florianopolis', uf: 'SC' },
  { city: 'Fortaleza', uf: 'CE' },
  { city: 'Goiania', uf: 'GO' },
  { city: 'Joao Pessoa', uf: 'PB' },
  { city: 'Macapa', uf: 'AP' },
  { city: 'Maceio', uf: 'AL' },
  { city: 'Manaus', uf: 'AM' },
  { city: 'Natal', uf: 'RN' },
  { city: 'Palmas', uf: 'TO' },
  { city: 'Porto Alegre', uf: 'RS' },
  { city: 'Porto Velho', uf: 'RO' },
  { city: 'Recife', uf: 'PE' },
  { city: 'Rio Branco', uf: 'AC' },
  { city: 'Rio de Janeiro', uf: 'RJ' },
  { city: 'Salvador', uf: 'BA' },
  { city: 'Sao Luis', uf: 'MA' },
  { city: 'Sao Paulo', uf: 'SP' },
  { city: 'Teresina', uf: 'PI' },
  { city: 'Vitoria', uf: 'ES' },
]

function formatCityLabel(city, uf) {
  const normalizedCity = String(city || '').trim()
  const normalizedUf = String(uf || '').trim().toUpperCase()

  if (!normalizedCity) {
    return ''
  }

  return normalizedUf ? `${normalizedCity} - ${normalizedUf}` : normalizedCity
}

function toCityRecord(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const normalizedText = String(entry).trim()
    if (!normalizedText) {
      return null
    }

    const parsedLabel = normalizedText.match(/^(.*)\s-\s([A-Za-z]{2})$/)
    if (parsedLabel) {
      return {
        city: String(parsedLabel[1] || '').trim(),
        uf: String(parsedLabel[2] || '').trim().toUpperCase(),
      }
    }

    return {
      city: normalizedText,
      uf: '',
    }
  }

  const city = String(entry.city || entry.nome || entry.name || '').trim()
  const uf = String(
    entry.uf || entry.state || entry.sigla || entry?.microrregiao?.mesorregiao?.UF?.sigla || '',
  )
    .trim()
    .toUpperCase()

  if (!city) {
    return null
  }

  return { city, uf }
}

function getRegionRank(uf) {
  if (uf === 'RS') {
    return 0
  }

  const stateInfo = BRAZILIAN_STATES[uf]

  if (!stateInfo) {
    return REGION_PRIORITY.length + 3
  }

  if (stateInfo.region === 'Sul') {
    return 1
  }

  const regionIndex = REGION_PRIORITY.indexOf(stateInfo.region)
  return regionIndex === -1 ? REGION_PRIORITY.length + 3 : regionIndex + 2
}

function getStateName(uf) {
  if (!uf) {
    return ''
  }

  return BRAZILIAN_STATES[uf]?.name || uf
}

function normalizeCityList(cities) {
  const normalized = Array.isArray(cities) ? cities.map((city) => toCityRecord(city)).filter(Boolean) : []

  const uniqueByLabel = new Map()

  for (const city of normalized) {
    const label = formatCityLabel(city.city, city.uf)
    const normalizedLabel = label.toLocaleLowerCase('pt-BR')

    if (!label || uniqueByLabel.has(normalizedLabel)) {
      continue
    }

    uniqueByLabel.set(normalizedLabel, {
      city: city.city,
      uf: city.uf,
      label,
    })
  }

  return Array.from(uniqueByLabel.values())
    .sort((first, second) => {
      const regionDiff = getRegionRank(first.uf) - getRegionRank(second.uf)
      if (regionDiff !== 0) {
        return regionDiff
      }

      const stateDiff = getStateName(first.uf).localeCompare(getStateName(second.uf), 'pt-BR')
      if (stateDiff !== 0) {
        return stateDiff
      }

      return first.city.localeCompare(second.city, 'pt-BR')
    })
    .map((city) => city.label)
}

function readCachedCities() {
  const raw = localStorage.getItem(CITY_CACHE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    const timestamp = Number(parsed?.timestamp || 0)
    const cities = normalizeCityList(parsed?.cities)

    if (!timestamp || Date.now() - timestamp > CITY_CACHE_TTL || !cities.length) {
      localStorage.removeItem(CITY_CACHE_KEY)
      return null
    }

    return cities
  } catch {
    localStorage.removeItem(CITY_CACHE_KEY)
    return null
  }
}

function saveCachedCities(cities) {
  if (!cities.length) {
    return
  }

  localStorage.setItem(
    CITY_CACHE_KEY,
    JSON.stringify({
      timestamp: Date.now(),
      cities,
    }),
  )
}

function fetchWithTimeout(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Tempo limite ao carregar cidades do Brasil.'))
    }, timeoutMs)

    fetch(url, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer)
        resolve(response)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

async function fetchBrazilianCitiesFromIbge() {
  const response = await fetchWithTimeout(IBGE_MUNICIPALITIES_URL)

  if (!response.ok) {
    throw new Error('Falha ao consultar cidades do Brasil.')
  }

  const payload = await response.json()
  const cities = normalizeCityList(payload)

  if (!cities.length) {
    throw new Error('Nenhuma cidade retornada pela API.')
  }

  return cities
}

export async function getBrazilianCities() {
  const cached = readCachedCities()

  if (cached?.length) {
    return cached
  }

  try {
    const cities = await fetchBrazilianCitiesFromIbge()
    saveCachedCities(cities)
    return cities
  } catch {
    return normalizeCityList(brazilianCapitals)
  }
}

export { brazilianCapitals }
