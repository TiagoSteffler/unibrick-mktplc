const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../src/services/marketplaceService.js')
let content = fs.readFileSync(file, 'utf8')

// Remove unused variables
content = content.replace(/const EXTRA_PRODUCTS_KEY = '.*?'\r?\n/, '')
content = content.replace(/const USER_PROFILE_KEY = '.*?'\r?\n/, '')
content = content.replace(/const BLACKLIST_USERS_KEY = '.*?'\r?\n/, '')
content = content.replace(/const ADMIN_USERS_KEY = '.*?'\r?\n/, '')
content = content.replace(/const HOME_MESSAGE_KEY = '.*?'\r?\n/, '')
content = content.replace(/const ACCESS_CACHE_TTL = 60 \* 1000\r?\n/, '')

// Remove seeds
content = content.replace(/const seedSellers = {[\s\S]*?}\r?\n\r?\n/, '')
content = content.replace(/const seedProducts = \[\]\r?\n\r?\n/, '')

// Remove safeRead / safeWrite
content = content.replace(/function safeRead\([\s\S]*?^}\r?\n\r?\n/m, '')
content = content.replace(/function safeWrite\([\s\S]*?^}\r?\n\r?\n/m, '')

// Remove local admin/blacklist functions
content = content.replace(/function readLocalAdminEmails\([\s\S]*?^}\r?\n\r?\n/m, '')
content = content.replace(/function readLocalBlacklist\([\s\S]*?^}\r?\n\r?\n/m, '')
content = content.replace(/function saveLocalBlacklist\([\s\S]*?^}\r?\n\r?\n/m, '')
content = content.replace(/function findLocalBlacklistEntry\([\s\S]*?^}\r?\n\r?\n/m, '')
content = content.replace(/function parseHomeMessageTemplate\([\s\S]*?^}\r?\n\r?\n/m, '')

// Update resolveUserAccess
content = content.replace(
/  const localAdminEmails = readLocalAdminEmails\(\)[\s\S]*?    if \(\!isAdmin\) {/m,
`  const canBeAdmin = isAdminDomainEmail(normalizedUser.email)
  let isAdmin = false

  if (canBeAdmin) {`
)

content = content.replace(
/  const localBlacklistEntry = findLocalBlacklistEntry\(normalizedUser\)[\s\S]*?  const blacklistEntry = localBlacklistEntry \|\| firestoreBlacklistEntry/m,
`  const firestoreBlacklistEntry = await findFirestoreBlacklistEntry(normalizedUser)
  const blacklistEntry = firestoreBlacklistEntry`
)

fs.writeFileSync(file, content)
console.log('marketplaceService part 1 cleaned!')
