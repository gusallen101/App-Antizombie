import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

type NavigationMenuContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const NavigationMenuContext = createContext<NavigationMenuContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function NavigationMenuProvider({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    setIsOpen((value) => !value);
  }, []);

  const value = useMemo<NavigationMenuContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
    }),
    [isOpen, open, close, toggle],
  );

  return <NavigationMenuContext.Provider value={value}>{children}</NavigationMenuContext.Provider>;
}

export function useNavigationMenu() {
  const context = useContext(NavigationMenuContext);

  if (!context) {
    throw new Error('useNavigationMenu must be used within a NavigationMenuProvider');
  }

  return context;
}

