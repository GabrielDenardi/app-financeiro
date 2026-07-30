import { Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  STORE_REPLACEMENT_MODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

import { appEnv, hasRevenueCatGoogleEnv } from '../../config/env';
import { supabase } from '../../lib/supabase';
import {
  getGooglePlaySubscriptionId,
  getPlanIdFromProduct,
  PAID_PLAN_RANK,
  REVENUECAT_ENTITLEMENT_ID,
  type PaidSubscriptionPlanId,
} from './revenuecatProducts';

export type RevenueCatPlanPackage = {
  planId: PaidSubscriptionPlanId;
  localizedPrice: string;
  package: PurchasesPackage;
};

function assertAndroidBillingAvailable() {
  if (Platform.OS !== 'android') {
    throw new Error('As assinaturas estao disponiveis apenas no aplicativo Android.');
  }

  if (!hasRevenueCatGoogleEnv) {
    throw new Error(
      'A chave publica do RevenueCat para Google Play ainda nao foi configurada.',
    );
  }
}

export async function ensureRevenueCatConfigured(userId: string): Promise<void> {
  assertAndroidBillingAvailable();

  if (!(await Purchases.isConfigured())) {
    Purchases.configure({
      apiKey: appEnv.revenueCatGoogleApiKey,
      appUserID: userId,
    });

    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    return;
  }

  const configuredUserId = await Purchases.getAppUserID();
  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
  }
}

export async function listRevenueCatPlanPackages(
  userId: string,
): Promise<Partial<Record<PaidSubscriptionPlanId, RevenueCatPlanPackage>>> {
  await ensureRevenueCatConfigured(userId);
  const offerings = await Purchases.getOfferings();
  const currentOffering = offerings.current;

  if (!currentOffering) {
    throw new Error('Nenhuma oferta de assinatura foi publicada no RevenueCat.');
  }

  return currentOffering.availablePackages.reduce<
    Partial<Record<PaidSubscriptionPlanId, RevenueCatPlanPackage>>
  >((packages, item) => {
    const planId = getPlanIdFromProduct(item.product.identifier);
    if (planId) {
      packages[planId] = {
        planId,
        localizedPrice: item.product.priceString,
        package: item,
      };
    }
    return packages;
  }, {});
}

function findActivePaidPlan(customerInfo: CustomerInfo) {
  const configuredEntitlement =
    customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  const candidates = configuredEntitlement
    ? [configuredEntitlement]
    : Object.values(customerInfo.entitlements.active);

  for (const entitlement of candidates) {
    const planId = getPlanIdFromProduct(entitlement.productIdentifier);
    if (planId) {
      return {
        planId,
        productIdentifier: entitlement.productIdentifier,
      };
    }
  }

  return null;
}

export async function purchaseRevenueCatPlan(
  userId: string,
  selectedPackage: RevenueCatPlanPackage,
): Promise<{ scheduled: boolean }> {
  await ensureRevenueCatConfigured(userId);
  const beforePurchase = await Purchases.getCustomerInfo();
  const activePlan = findActivePaidPlan(beforePurchase);
  const targetPlanId = selectedPackage.planId;

  const productChangeInfo =
    activePlan && activePlan.planId !== targetPlanId
      ? {
          oldProductIdentifier: getGooglePlaySubscriptionId(
            activePlan.productIdentifier,
          ),
          replacementMode:
            PAID_PLAN_RANK[targetPlanId] > PAID_PLAN_RANK[activePlan.planId]
              ? STORE_REPLACEMENT_MODE.CHARGE_PRORATED_PRICE
              : STORE_REPLACEMENT_MODE.DEFERRED,
        }
      : null;

  try {
    const result = await Purchases.purchasePackage(
      selectedPackage.package,
      null,
      productChangeInfo,
    );
    const activeAfterPurchase = findActivePaidPlan(result.customerInfo);

    await syncRevenueCatSubscription();

    return {
      scheduled:
        Boolean(activePlan) &&
        activeAfterPurchase?.planId !== targetPlanId,
    };
  } catch (error) {
    const purchasesError = error as Partial<PurchasesError>;
    if (
      purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
      purchasesError.userCancelled
    ) {
      throw new Error('Compra cancelada.');
    }

    throw new Error(
      purchasesError.message || 'Nao foi possivel concluir a assinatura pela Google Play.',
    );
  }
}

export async function restoreRevenueCatPurchases(userId: string): Promise<boolean> {
  await ensureRevenueCatConfigured(userId);
  const customerInfo = await Purchases.restorePurchases();
  await syncRevenueCatSubscription();
  return Boolean(findActivePaidPlan(customerInfo));
}

export async function syncRevenueCatSubscription(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
  }>('sync-revenuecat-subscription');

  if (error) {
    throw new Error(error.message);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
}

export async function openGooglePlaySubscriptionManagement(): Promise<void> {
  const supported = await Linking.canOpenURL(
    'https://play.google.com/store/account/subscriptions',
  );
  if (!supported) {
    throw new Error('Nao foi possivel abrir o gerenciamento da Google Play.');
  }

  await Linking.openURL('https://play.google.com/store/account/subscriptions');
}
