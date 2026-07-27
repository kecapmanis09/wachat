export default function Navbar({ user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">💬</span>
        <span>ChatKu</span>
      </div>
      <div className="navbar-user">
        <div className="navbar-avatar">{user.username[0].toUpperCase()}</div>
        <span className="navbar-username">@{user.username}</span>
        <button className="navbar-logout" onClick={onLogout} title="Keluar">
          Keluar
        </button>
      </div>
    </header>
  )
}
