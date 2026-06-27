import './NavBar.css'

/**
 * Top navigation. Pages are hash routes (#/overview, #/map, …) so the URL and
 * the browser back button work without pulling in a router dependency.
 */
function NavBar({ pages, active }) {
  return (
    <nav className="navbar">
      {pages.map((p) => (
        <a
          key={p.id}
          href={`#/${p.id}`}
          className={`nav-link ${active === p.id ? 'active' : ''}`}
          aria-current={active === p.id ? 'page' : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{p.icon}</span>
          <span className="nav-label">{p.label}</span>
        </a>
      ))}
    </nav>
  )
}

export default NavBar
