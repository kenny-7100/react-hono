import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <main className="content-page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="page-link" to="/">Return home</Link>
    </main>
  )
}

export { NotFound as Component }
