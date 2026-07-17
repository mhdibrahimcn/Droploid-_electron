import { app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'

export const kDroploidPATH =
  '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'

export const kRubyPATH = [
  `${homedir()}/.rbenv/shims`,
  `${homedir()}/.rbenv/bin`,
  `${homedir()}/.rvm/rubies/default/bin`,
  `${homedir()}/.rvm/bin`,
  kDroploidPATH
].join(':')

export const kUserDataDir = app.getPath('userData')
export const kOrgPhotosDir = join(kUserDataDir, 'org_photos')
export const kLogsDir = join(kUserDataDir, 'logs')
export const kArchiveCacheDir = join(homedir(), '.cache', 'droploid', 'ios')

export const kKeychainService = 'Droploid'
