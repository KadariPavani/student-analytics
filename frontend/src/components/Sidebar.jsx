import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const viewLinks = [
    { to: '/',            label: 'Dashboard',         icon: '📊' },
    { to: '/student-placements', label: 'Student Placements', icon: '🎓' },
    { to: '/programs',    label: 'Statistics Summary',  icon: '📈' },
  ];

  const adminLinks = [
    { to: '/admin/batches', label: 'Batch Management', icon: '📋' },
    { to: '/admin/upload',  label: 'Upload Data',      icon: '📤' },
    { to: '/admin/users',   label: 'User Management',  icon: '👥' },
  ];

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = useCallback(() => setMobileOpen(prev => !prev), []);

  return (
    <>
      {/* Hamburger button – visible only on mobile */}
      <button
        className={`hamburger ${mobileOpen ? 'hamburger--active' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
      >
        <span className="hamburger__line" />
        <span className="hamburger__line" />
        <span className="hamburger__line" />
      </button>

      {/* Overlay behind sidebar on mobile */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <h2>PlacementDB</h2>
          <span>KIET Analytics Data Mart</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Analytics</div>
          {viewLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="nav-section-label">Admin</div>
              {adminLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{link.icon}</span>
                  {link.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user?.fullName || user?.username}</span>
            <span className="sidebar-user-role">{user?.role?.toUpperCase()}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
