import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { NAV } from '../utils/constants';

const NAV_CACHE_KEY = 'mollari.nav.modules.v2';

export function useNavModules() {
  const { data: session } = useSession();

  const [navItems, setNavItems] = useState(() => {
    if (typeof window === 'undefined') return NAV;
    try {
      const cached = localStorage.getItem(NAV_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.navItems?.length > 0) return parsed.navItems;
      }
    } catch { }
    return NAV;
  });

  const [userModuleCodes, setUserModuleCodes] = useState<Set<string> | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(NAV_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.isAdmin) return null;
        if (parsed.codes?.length > 0) return new Set<string>(parsed.codes);
      }
    } catch { }
    return null;
  });

  useEffect(() => {
    if (!session?.accessToken) return;
    import('@/shared/lib/apiClient').then(({ apiClient }) => {
      apiClient.get('/auth/profile').then(res => {
        const data = res.data.data;
        if (!data) return;

        const userTypeCode = data.userType?.code;
        if (userTypeCode === '1x101') {
          setNavItems(NAV);
          setUserModuleCodes(null);
          try { localStorage.setItem(NAV_CACHE_KEY, JSON.stringify({ isAdmin: true, navItems: NAV })); } catch { }
          return;
        }

        if (data.userModules && data.userModules.length > 0) {
          const codes = data.userModules.map((um: any) => um.module.code as string);
          const codeSet = new Set<string>(codes);
          setUserModuleCodes(codeSet);
          const filtered = NAV.filter(n => codeSet.has(n.id));
          const finalNav = filtered.length > 0 ? filtered : NAV;
          setNavItems(finalNav);
          try { localStorage.setItem(NAV_CACHE_KEY, JSON.stringify({ codes, navItems: finalNav })); } catch { }
        }
      }).catch(err => {
        console.error("Failed to load nav modules", err);
      });
    });
  }, [session?.accessToken]);

  return { navItems, userModuleCodes };
}
