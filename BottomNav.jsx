export default function BottomNav({ tabs, activeTab, onChange, hideOnMobile }) {
  return (
    <nav className={`bottom-nav ${hideOnMobile ? 'bottom-nav-hide-mobile' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
