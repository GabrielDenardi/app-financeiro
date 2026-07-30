import { useAuthenticatedUser } from '../auth/hooks/useAuthenticatedUser';
import { useRevenueCatBootstrap } from './hooks';

export function RevenueCatBootstrap() {
  const user = useAuthenticatedUser();
  useRevenueCatBootstrap(user?.id);

  return null;
}
