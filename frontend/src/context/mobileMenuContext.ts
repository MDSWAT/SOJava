import { createContext, useContext, useState } from 'react';

interface MobileMenuCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const MobileMenuContext = createContext<MobileMenuCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export const useMobileMenuContext = () => useContext(MobileMenuContext);

export const useMobileMenu = (): MobileMenuCtx => {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(p => !p),
  };
};
