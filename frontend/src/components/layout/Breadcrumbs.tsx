import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Map URLs to Romanian names
  const routeMap: Record<string, string> = {
    'vault': 'Password Vault',
    'personal': 'Personal Vault',
    'users': 'Utilizatori',
    'audit': 'Loguri de Audit',
    'settings': 'Setări Sistem',
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 select-none">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-sidesi-500 dark:hover:text-sidesi-400 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Corporatia SIDESI</span>
      </Link>
      
      {pathnames.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const name = routeMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <React.Fragment key={to}>
            {isLast ? (
              <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[120px] sm:max-w-none">
                {name}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-sidesi-500 dark:hover:text-sidesi-400 transition-colors truncate max-w-[120px] sm:max-w-none"
              >
                {name}
              </Link>
            )}
            {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
export default Breadcrumbs;
