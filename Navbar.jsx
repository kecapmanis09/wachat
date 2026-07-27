export default function Navbar({ title }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">💬</span>
        <span>{title || 'ChatKu'}</span>
      </div>
    </header>
  )
}
