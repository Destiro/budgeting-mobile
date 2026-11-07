/**
 * React wiring for the app state: loads saved data on start and saves your own data after each change.
 * The reducer and data shapes live in ./state.ts.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { deserialize, demoState, reducer, serialize, startOfToday, type Action, type State } from './state';
import { clearSaved, loadSaved, save } from './storage';

export { newId, todayISO, type State } from './state';

function initialState(): State {
  const today = startOfToday();
  return deserialize(loadSaved(), today) ?? demoState(today);
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Save your own data shortly after it changes. Demo data is never saved.
  useEffect(() => {
    if (state.mode !== 'mine') return;
    const timer = setTimeout(() => save(serialize(state)), 300);
    return () => clearTimeout(timer);
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch: (a: Action) => {
        if (a.type === 'resetToDemo') clearSaved();
        dispatch(a);
      },
    }),
    [state],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
