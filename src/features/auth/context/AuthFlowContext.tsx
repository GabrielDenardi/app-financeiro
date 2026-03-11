import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  createEmptyRegistrationDraft,
  type ExistingAccountInfo,
  type RegistrationDraft,
} from '../../../types/auth';

type AuthFlowContextValue = {
  draft: RegistrationDraft;
  setField: <K extends keyof RegistrationDraft>(field: K, value: RegistrationDraft[K]) => void;
  mergeDraft: (partial: Partial<RegistrationDraft>) => void;
  resetDraft: () => void;
  existingAccount: ExistingAccountInfo | null;
  setExistingAccount: (value: ExistingAccountInfo | null) => void;
};

const AuthFlowContext = createContext<AuthFlowContextValue | null>(null);

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(createEmptyRegistrationDraft);
  const [existingAccount, setExistingAccount] = useState<ExistingAccountInfo | null>(null);

  const value = useMemo<AuthFlowContextValue>(
    () => ({
      draft,
      setField: (field, valueToSet) => {
        setDraft((current) => ({ ...current, [field]: valueToSet }));
      },
      mergeDraft: (partial) => {
        setDraft((current) => ({ ...current, ...partial }));
      },
      resetDraft: () => {
        setDraft(createEmptyRegistrationDraft());
      },
      existingAccount,
      setExistingAccount,
    }),
    [draft, existingAccount],
  );

  return <AuthFlowContext.Provider value={value}>{children}</AuthFlowContext.Provider>;
}

export function useAuthFlow(): AuthFlowContextValue {
  const context = useContext(AuthFlowContext);

  if (!context) {
    throw new Error('useAuthFlow deve ser usado dentro de AuthFlowProvider');
  }

  return context;
}

