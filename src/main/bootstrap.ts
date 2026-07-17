import { app } from 'electron'
import { join } from 'path'

// Pin a single userData dir so BOTH the GUI (dev = "Electron", packaged = "Droploid") and the
// headless `--cli` mode read/write the SAME electron-store. Without this, orgs/apps split across
// three dirs by launch method. Must run before store.ts / paths.ts evaluate → keep this the FIRST
// import in index.ts. Points at the existing real-data dir so no migration is needed.
app.setPath('userData', join(app.getPath('appData'), 'droploid-electron'))
