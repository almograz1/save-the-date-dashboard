import './NavBar.css'

/**
 * Application navigation. Uses hash links so route changes remain dependency-free.
 */
function NavBar({ pages, active, variant = 'sidebar' }) {
  return (
    <nav className={`navbar navbar-${variant}`} aria-label="Dashboard sections">
      {pages.map((page) => {
        const isActive = active === page.id
        return (
          <a
            key={page.id}
            href={`#/${page.id}`}
            className={`nav-link ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{page.icon}</span>
            <span className="nav-copy">
              <span className="nav-label">{page.label}</span>
              {variant === 'sidebar' && <span className="nav-description">{page.eyebrow}</span>}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

export default NavBar
