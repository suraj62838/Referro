/**
 * Shared layout component that wraps authenticated pages
 * with Sidebar + main content area.
 */

import Sidebar from "./Sidebar.jsx";

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content scrollbar-thin">{children}</div>
    </div>
  );
}
