import { useEffect, useState } from 'react'
import xpStyles from 'xp.css/dist/XP.css?inline'
import './XpDesktop.scss'

type AppId = 'welcome' | 'computer' | 'documents' | 'browser'

const apps: Array<{ id: AppId; label: string; icon: string }> = [
  { id: 'computer', label: 'My Computer', icon: '\u{1F5A5}\u{FE0F}' },
  { id: 'documents', label: 'My Documents', icon: '\u{1F4C1}' },
  { id: 'browser', label: 'Internet Explorer', icon: '\u{1F310}' },
  { id: 'welcome', label: 'Welcome', icon: '\u{2753}' },
]

const windowContent: Record<AppId, { title: string; icon: string; body: React.ReactNode }> = {
  welcome: {
    title: 'Welcome to Windows XP',
    icon: '\u{2753}',
    body: (
      <div className="xp-welcome">
        <span className="xp-welcome__mark">xp</span>
        <div>
          <h2>Welcome</h2>
          <p>Your Windows XP desktop is ready to use.</p>
          <p>Double-click a desktop icon or choose a program from the Start menu.</p>
        </div>
      </div>
    ),
  },
  computer: {
    title: 'My Computer',
    icon: '\u{1F5A5}\u{FE0F}',
    body: (
      <div className="xp-explorer">
        <aside>
          <strong>System Tasks</strong>
          <a href="#system">View system information</a>
          <a href="#settings">Change a setting</a>
        </aside>
        <section>
          <h3>Files Stored on This Computer</h3>
          <div className="xp-drive"><span>{'\u{1F4C1}'}</span><div><b>Shared Documents</b><small>File Folder</small></div></div>
          <h3>Hard Disk Drives</h3>
          <div className="xp-drive"><span>{'\u{1F4BE}'}</span><div><b>Local Disk (C:)</b><small>42.7 GB free</small></div></div>
        </section>
      </div>
    ),
  },
  documents: {
    title: 'My Documents',
    icon: '\u{1F4C1}',
    body: (
      <div className="xp-files">
        <div><span>{'\u{1F4C1}'}</span><b>My Music</b></div>
        <div><span>{'\u{1F4C1}'}</span><b>My Pictures</b></div>
        <div><span>{'\u{1F4C4}'}</span><b>Welcome.txt</b></div>
      </div>
    ),
  },
  browser: {
    title: 'Internet Explorer',
    icon: '\u{1F310}',
    body: (
      <div className="xp-browser">
        <div className="xp-address"><span>Address</span><input value="https://www.microsoft.com" readOnly /></div>
        <div className="xp-browser__page">
          <span className="xp-browser__logo">e</span>
          <h2>Welcome to the Internet</h2>
          <p>This simulated browser is safely offline.</p>
        </div>
      </div>
    ),
  },
}

function WindowsLogo() {
  return <span className="xp-windows-logo" aria-hidden="true"><i /><i /><i /><i /></span>
}

function Home() {
  const [openApps, setOpenApps] = useState<AppId[]>(['welcome'])
  const [activeApp, setActiveApp] = useState<AppId | null>('welcome')
  const [maximized, setMaximized] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.xpStylesheet = 'true'
    style.textContent = xpStyles
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  function openApp(id: AppId) {
    setOpenApps((current) => current.includes(id) ? current : [...current, id])
    setActiveApp(id)
    setMaximized(false)
    setStartOpen(false)
  }

  function closeApp(id: AppId) {
    setOpenApps((current) => current.filter((app) => app !== id))
    setActiveApp(null)
    setMaximized(false)
  }

  const activeWindow = activeApp ? windowContent[activeApp] : null

  return (
    <main className="xp-desktop" onClick={() => startOpen && setStartOpen(false)}>
      <div className="xp-desktop-icons" aria-label="Desktop shortcuts">
        {apps.map((app) => (
          <button key={app.id} type="button" className="xp-desktop-icon" onDoubleClick={() => openApp(app.id)} onClick={(event) => event.stopPropagation()}>
            <span>{app.icon}</span><b>{app.label}</b>
          </button>
        ))}
      </div>

      {activeWindow && activeApp && (
        <section className={`window xp-app-window${maximized ? ' xp-app-window--maximized' : ''}`} onClick={(event) => event.stopPropagation()}>
          <div className="title-bar">
            <div className="title-bar-text"><span>{activeWindow.icon}</span>{activeWindow.title}</div>
            <div className="title-bar-controls">
              <button type="button" aria-label="Minimize" onClick={() => setActiveApp(null)} />
              <button type="button" aria-label="Maximize" onClick={() => setMaximized((value) => !value)} />
              <button type="button" aria-label="Close" onClick={() => closeApp(activeApp)} />
            </div>
          </div>
          <div className="xp-menu-bar"><button type="button"><u>F</u>ile</button><button type="button"><u>E</u>dit</button><button type="button"><u>V</u>iew</button><button type="button"><u>H</u>elp</button></div>
          <div className="window-body">{activeWindow.body}</div>
          <div className="status-bar"><p className="status-bar-field">Ready</p><p className="status-bar-field">My Computer</p></div>
        </section>
      )}

      {startOpen && (
        <section className="xp-start-menu" onClick={(event) => event.stopPropagation()}>
          <header><span className="xp-user-avatar">A</span><strong>Administrator</strong></header>
          <div className="xp-start-menu__body">
            <div className="xp-start-menu__programs">
              {apps.slice().reverse().map((app) => <button type="button" key={app.id} onClick={() => openApp(app.id)}><span>{app.icon}</span>{app.label}</button>)}
            </div>
            <div className="xp-start-menu__places">
              <button type="button" onClick={() => openApp('documents')}><b>My Documents</b></button>
              <button type="button" onClick={() => openApp('computer')}><b>My Computer</b></button>
              <hr />
              <button type="button">Control Panel</button>
              <button type="button">Help and Support</button>
            </div>
          </div>
          <footer><button type="button"><span>{'\u{1F512}'}</span> Log Off</button><button type="button"><span>{'\u{23FB}'}</span> Turn Off Computer</button></footer>
        </section>
      )}

      <footer className="xp-taskbar" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="xp-start-button" onClick={() => setStartOpen((value) => !value)}><WindowsLogo /><i>start</i></button>
        <div className="xp-taskbar__apps">
          {openApps.map((id) => <button type="button" className={activeApp === id ? 'active' : ''} key={id} onClick={() => setActiveApp(activeApp === id ? null : id)}><span>{windowContent[id].icon}</span>{windowContent[id].title}</button>)}
        </div>
        <div className="xp-tray"><span aria-label="Volume">{'\u{1F50A}'}</span><time>{time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>
      </footer>
    </main>
  )
}

export { Home as Component }
