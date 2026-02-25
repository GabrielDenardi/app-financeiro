import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BalanceCard } from '../components/BalanceCard';
import { BOTTOM_TAB_BAR_HEIGHT } from '../components/BottomTabBarMock';
import { Card } from '../components/Card';
import { FAB_SIZE, FloatingActionButton } from '../components/FloatingActionButton';
import { SectionHeader } from '../components/SectionHeader';
import { SummaryStatCard } from '../components/SummaryStatCard';
import { TransactionListItem } from '../components/TransactionListItem';
import { homeDashboardMock } from '../data/homeMock';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrencyBRL, HIDDEN_CURRENCY_TEXT } from '../utils/format';

const MODAL_SHEET_CLOSED_TRANSLATE_Y = 420;
const MODAL_DRAG_DISMISS_DISTANCE = 160;
const MODAL_DRAG_DISMISS_VELOCITY = 1.45;
const MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE = 56;
const MODAL_DRAG_RESISTANCE_START = 72;
const MODAL_DRAG_RESISTANCE_FACTOR = 0.62;
const QUICK_ADD_CATEGORY_OPTIONS = [
  'Alimentacao',
  'Transporte',
  'Moradia',
  'Saude',
  'Lazer',
  'Salario',
  'Freelance',
] as const;
const QUICK_ADD_ACCOUNT_OPTIONS = ['Carteira', 'Nubank', 'Inter', 'Itau'] as const;
const QUICK_ADD_PAYMENT_OPTIONS = [
  'Pix',
  'Cartao de credito',
  'Cartao de debito',
  'Dinheiro',
  'Boleto',
] as const;
const HOME_ACCOUNTS = [
  {
    id: 'acc-1',
    bank: 'Nubank',
    nickname: 'Conta principal',
    typeLabel: 'Conta corrente',
    balance: 2500,
  },
] as const;
const HOME_KPI_CARDS = [
  {
    id: 'goals',
    label: 'Metas',
    value: '1',
    icon: 'trophy-outline',
    iconColor: '#D97706',
    iconSurface: '#FEF3C7',
  },
  {
    id: 'groups',
    label: 'Grupos',
    value: '2',
    icon: 'people-outline',
    iconColor: '#9333EA',
    iconSurface: '#F3E8FF',
  },
  {
    id: 'networth',
    label: 'Patrimonio',
    value: '2.5k',
    icon: 'wallet-outline',
    iconColor: '#2563EB',
    iconSurface: '#DBEAFE',
  },
] as const;
const HOME_CATEGORY_SPENDING = [
  { id: 'fuel', label: 'Combustivel', amount: 1250, color: '#10B981' },
  { id: 'market', label: 'Supermercado', amount: 1000, color: '#3B82F6' },
] as const;
const HOME_CATEGORY_DONUT_SIZE = 112;
const HOME_CATEGORY_DONUT_STROKE_WIDTH = 12;
const HOME_CATEGORY_DONUT_RADIUS = (HOME_CATEGORY_DONUT_SIZE - HOME_CATEGORY_DONUT_STROKE_WIDTH) / 2;

function applyModalDragResistance(offset: number): number {
  if (offset <= 0) {
    return 0;
  }

  if (offset <= MODAL_DRAG_RESISTANCE_START) {
    return offset;
  }

  const extraOffset = offset - MODAL_DRAG_RESISTANCE_START;
  return MODAL_DRAG_RESISTANCE_START + extraOffset * MODAL_DRAG_RESISTANCE_FACTOR;
}

function formatQuickAddDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatHiddenOrVisibleCurrency(value: number, hideAmounts: boolean): string {
  return hideAmounts ? HIDDEN_CURRENCY_TEXT : formatCurrencyBRL(value);
}

function buildCategorySpendingDonutSegments(
  items: ReadonlyArray<{ id: string; amount: number; color: string }>,
) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const circumference = 2 * Math.PI * HOME_CATEGORY_DONUT_RADIUS;
  let currentOffset = 0;

  const segments = items.map((item) => {
    const ratio = total > 0 ? item.amount / total : 0;
    const length = circumference * ratio;
    const segment = {
      id: item.id,
      color: item.color,
      dashLength: length,
      dashOffset: currentOffset,
    };

    currentOffset += length;
    return segment;
  });

  return {
    segments,
    total,
    circumference,
    center: HOME_CATEGORY_DONUT_SIZE / 2,
  };
}

export function HomeScreen() {
  const data = homeDashboardMock;
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const [isQuickAddModalVisible, setIsQuickAddModalVisible] = useState(false);
  const [isQuickAddModalMounted, setIsQuickAddModalMounted] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('expense');
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null);
  const [quickAddDate, setQuickAddDate] = useState(new Date());
  const [quickAddAccount, setQuickAddAccount] = useState<string | null>(null);
  const [quickAddPaymentMethod, setQuickAddPaymentMethod] = useState<string>('Pix');
  const [quickAddDescription, setQuickAddDescription] = useState('');
  const [quickAddIsRecurring, setQuickAddIsRecurring] = useState(false);
  const [isQuickAddCategoryPickerOpen, setIsQuickAddCategoryPickerOpen] = useState(false);
  const [isQuickAddAccountPickerOpen, setIsQuickAddAccountPickerOpen] = useState(false);
  const [isQuickAddPaymentPickerOpen, setIsQuickAddPaymentPickerOpen] = useState(false);
  const [isQuickAddDatePickerOpen, setIsQuickAddDatePickerOpen] = useState(false);
  const [isQuickAddNativeDatePickerVisible, setIsQuickAddNativeDatePickerVisible] =
    useState(false);
  const [isTransactionsModalVisible, setIsTransactionsModalVisible] = useState(false);
  const [isTransactionsModalMounted, setIsTransactionsModalMounted] = useState(false);
  const [isAccountsModalVisible, setIsAccountsModalVisible] = useState(false);
  const [isAccountsModalMounted, setIsAccountsModalMounted] = useState(false);
  const [isCategorySpendingModalVisible, setIsCategorySpendingModalVisible] = useState(false);
  const [isCategorySpendingModalMounted, setIsCategorySpendingModalMounted] = useState(false);
  const modalSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;
  const modalDragStartY = useRef(0);
  const quickAddSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;
  const quickAddModalDragStartY = useRef(0);
  const accountsSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;
  const categorySpendingSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;

  const handleFabPress = () => {
    quickAddSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsQuickAddModalMounted(true);
    setIsQuickAddModalVisible(true);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
    console.log('[Home] add-transaction');
  };

  const handleSeeAllPress = () => {
    modalSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsTransactionsModalMounted(true);
    setIsTransactionsModalVisible(true);
    console.log('[Home] see-all-transactions');
  };

  const handleSeeAllAccountsPress = () => {
    accountsSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsAccountsModalMounted(true);
    setIsAccountsModalVisible(true);
    console.log('[Home] see-all-accounts');
  };

  const handleSeeMoreCategorySpendingPress = () => {
    categorySpendingSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsCategorySpendingModalMounted(true);
    setIsCategorySpendingModalVisible(true);
    console.log('[Home] see-more-category-spending');
  };

  const handleCloseAccountsModal = () => {
    setIsAccountsModalVisible(false);
  };

  const handleCloseCategorySpendingModal = () => {
    setIsCategorySpendingModalVisible(false);
  };

  const toggleAmountsVisibility = () => {
    setIsAmountsVisible((current) => !current);
  };

  const handleCloseTransactionsModal = () => {
    setIsTransactionsModalVisible(false);
  };

  const handleCloseQuickAddModal = () => {
    setIsQuickAddModalVisible(false);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleConfirmQuickAdd = () => {
    console.log(
      `[Home] quick-add type=${quickAddType} amount=${quickAddAmount || '0'} category=${quickAddCategory ?? 'none'
      } account=${quickAddAccount ?? 'none'} payment=${quickAddPaymentMethod} recurring=${quickAddIsRecurring ? 'yes' : 'no'
      } description=${quickAddDescription.trim() || 'none'} date=${quickAddDate.toISOString()}`
    );
    setIsQuickAddModalVisible(false);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleQuickAddAmountChange = (value: string) => {
    const normalized = value.replace(',', '.');
    const cleaned = normalized.replace(/[^0-9.]/g, '');

    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }

    const integerPart = parts[0] ?? '';
    const decimalPart = parts[1] ?? '';
    const nextValue =
      parts.length === 1 ? integerPart : `${integerPart}.${decimalPart.slice(0, 2)}`;

    setQuickAddAmount(nextValue);
  };

  const handleSelectQuickAddCategory = (category: string) => {
    setQuickAddCategory(category);
    setIsQuickAddCategoryPickerOpen(false);
  };

  const handleSelectQuickAddAccount = (account: string | null) => {
    setQuickAddAccount(account);
    setIsQuickAddAccountPickerOpen(false);
  };

  const handleSelectQuickAddPaymentMethod = (paymentMethod: string) => {
    setQuickAddPaymentMethod(paymentMethod);
    setIsQuickAddPaymentPickerOpen(false);
  };

  const handleToggleQuickAddCategoryPicker = () => {
    setIsQuickAddCategoryPickerOpen((current) => !current);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleToggleQuickAddAccountPicker = () => {
    setIsQuickAddAccountPickerOpen((current) => !current);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleToggleQuickAddPaymentPicker = () => {
    setIsQuickAddPaymentPickerOpen((current) => !current);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleToggleQuickAddDatePicker = () => {
    setIsQuickAddDatePickerOpen((current) => !current);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const setQuickAddDatePreset = (preset: 'today' | 'yesterday' | 'tomorrow') => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    if (preset === 'yesterday') {
      base.setDate(base.getDate() - 1);
    }

    if (preset === 'tomorrow') {
      base.setDate(base.getDate() + 1);
    }

    setQuickAddDate(base);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const adjustQuickAddDateByDays = (days: number) => {
    setQuickAddDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const handleOpenQuickAddNativeDatePicker = () => {
    setIsQuickAddDatePickerOpen(true);
    setIsQuickAddNativeDatePickerVisible(true);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddAccountPickerOpen(false);
    setIsQuickAddPaymentPickerOpen(false);
  };

  const handleQuickAddNativeDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (event.type === 'set' && selectedDate) {
      const normalizedDate = new Date(selectedDate);
      normalizedDate.setHours(12, 0, 0, 0);
      setQuickAddDate(normalizedDate);
    }

    if (Platform.OS === 'android') {
      setIsQuickAddNativeDatePickerVisible(false);
    }
  };

  const animateModalDragBack = () => {
    Animated.spring(modalSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 170,
      friction: 11,
    }).start();
  };

  const animateQuickAddModalDragBack = () => {
    Animated.spring(quickAddSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 170,
      friction: 11,
    }).start();
  };

  useEffect(() => {
    if (!isTransactionsModalMounted && !isTransactionsModalVisible) {
      return;
    }

    if (isTransactionsModalVisible) {
      Animated.timing(modalSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(modalSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        modalSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsTransactionsModalMounted(false);
      }
    });
  }, [isTransactionsModalMounted, isTransactionsModalVisible, modalSheetTranslateY]);

  useEffect(() => {
    if (!isQuickAddModalMounted && !isQuickAddModalVisible) {
      return;
    }

    if (isQuickAddModalVisible) {
      Animated.timing(quickAddSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(quickAddSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        quickAddSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsQuickAddModalMounted(false);
      }
    });
  }, [isQuickAddModalMounted, isQuickAddModalVisible, quickAddSheetTranslateY]);

  useEffect(() => {
    if (!isAccountsModalMounted && !isAccountsModalVisible) {
      return;
    }

    if (isAccountsModalVisible) {
      Animated.timing(accountsSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(accountsSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        accountsSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsAccountsModalMounted(false);
      }
    });
  }, [accountsSheetTranslateY, isAccountsModalMounted, isAccountsModalVisible]);

  useEffect(() => {
    if (!isCategorySpendingModalMounted && !isCategorySpendingModalVisible) {
      return;
    }

    if (isCategorySpendingModalVisible) {
      Animated.timing(categorySpendingSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(categorySpendingSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        categorySpendingSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsCategorySpendingModalMounted(false);
      }
    });
  }, [
    categorySpendingSheetTranslateY,
    isCategorySpendingModalMounted,
    isCategorySpendingModalVisible,
  ]);

  const modalPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isPullingDown = gestureState.dy > 6;
        return isVertical && isPullingDown;
      },
      onPanResponderGrant: () => {
        modalSheetTranslateY.stopAnimation((value) => {
          modalDragStartY.current = value;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const rawOffset = Math.max(0, modalDragStartY.current + gestureState.dy);
        modalSheetTranslateY.setValue(applyModalDragResistance(rawOffset));
      },
      onPanResponderRelease: (_event, gestureState) => {
        const currentOffset = Math.max(0, modalDragStartY.current + gestureState.dy);
        const shouldDismiss =
          currentOffset > MODAL_DRAG_DISMISS_DISTANCE ||
          (currentOffset > MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE &&
            gestureState.vy > MODAL_DRAG_DISMISS_VELOCITY);

        if (shouldDismiss) {
          handleCloseTransactionsModal();
          return;
        }

        animateModalDragBack();
      },
      onPanResponderTerminate: () => {
        animateModalDragBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const quickAddModalPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isPullingDown = gestureState.dy > 6;
        return isVertical && isPullingDown;
      },
      onPanResponderGrant: () => {
        quickAddSheetTranslateY.stopAnimation((value) => {
          quickAddModalDragStartY.current = value;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const rawOffset = Math.max(0, quickAddModalDragStartY.current + gestureState.dy);
        quickAddSheetTranslateY.setValue(applyModalDragResistance(rawOffset));
      },
      onPanResponderRelease: (_event, gestureState) => {
        const currentOffset = Math.max(0, quickAddModalDragStartY.current + gestureState.dy);
        const shouldDismiss =
          currentOffset > MODAL_DRAG_DISMISS_DISTANCE ||
          (currentOffset > MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE &&
            gestureState.vy > MODAL_DRAG_DISMISS_VELOCITY);

        if (shouldDismiss) {
          handleCloseQuickAddModal();
          return;
        }

        animateQuickAddModalDragBack();
      },
      onPanResponderTerminate: () => {
        animateQuickAddModalDragBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const modalBackdropBaseOpacity = modalSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backdropOpacity = modalBackdropBaseOpacity;
  const sheetTranslateY = modalSheetTranslateY;
  const quickAddBackdropOpacity = quickAddSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const accountsBackdropOpacity = accountsSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const categorySpendingBackdropOpacity = categorySpendingSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const primaryAccount = HOME_ACCOUNTS[0];
  const totalCategorySpending = HOME_CATEGORY_SPENDING.reduce((sum, item) => sum + item.amount, 0);
  const categoryDonut = buildCategorySpendingDonutSegments(HOME_CATEGORY_SPENDING);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerGreeting}>Boa tarde,</Text>
                  <Text style={styles.headerName}>João Silva</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAmountsVisible ? 'Ocultar saldos da tela' : 'Mostrar saldos da tela'
                  }
                  onPress={toggleAmountsVisibility}
                  style={({ pressed }) => [
                    styles.visibilityButton,
                    pressed && styles.visibilityButtonPressed,
                  ]}
                >
                  <Ionicons
                    name={isAmountsVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.dashboardStack}>
              <BalanceCard
                summary={data.summary}
                variationLabel="+8,4% vs mes anterior"
                hideAmounts={!isAmountsVisible}
              />

              <View style={styles.statsRow}>
                <SummaryStatCard
                  label="Entradas"
                  amount={data.summary.income}
                  type="income"
                  style={styles.statCard}
                  hideAmounts={!isAmountsVisible}
                />
                <SummaryStatCard
                  label="Saidas"
                  amount={data.summary.expense}
                  type="expense"
                  style={styles.statCard}
                  hideAmounts={!isAmountsVisible}
                />
              </View>
              <View style={styles.accountsSection}>
                <SectionHeader
                  title="Minhas Contas"
                  actionLabel="Ver todas"
                  onActionPress={handleSeeAllAccountsPress}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={handleSeeAllAccountsPress}
                  style={({ pressed }) => [
                    styles.accountCardButton,
                    pressed && styles.accountCardButtonPressed,
                  ]}
                >
                  <Card style={styles.accountCard}>
                    <View style={styles.accountCardDecorLarge} />
                    <View style={styles.accountCardDecorSmall} />

                    <View style={styles.accountCardHeader}>
                      <View style={styles.accountCardIconBubble}>
                        <Ionicons name="card-outline" size={14} color={colors.white} />
                      </View>
                      <Text style={styles.accountCardBank} numberOfLines={1}>
                        {primaryAccount.bank}
                      </Text>
                    </View>

                    <Text style={styles.accountCardNickname} numberOfLines={1}>
                      {primaryAccount.nickname}
                    </Text>

                    <Text style={styles.accountCardAmount} numberOfLines={1}>
                      {formatHiddenOrVisibleCurrency(primaryAccount.balance, !isAmountsVisible)}
                    </Text>

                    <View style={styles.accountCardFooter}>
                      <Text style={styles.accountCardType} numberOfLines={1}>
                        {primaryAccount.typeLabel}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.9)" />
                    </View>
                  </Card>
                </Pressable>
              </View>

              <View style={styles.kpiRow}>
                {HOME_KPI_CARDS.map((metric) => (
                  <Pressable
                    key={metric.id}
                    accessibilityRole="button"
                    onPress={() => console.log(`[Home] open-${metric.id}`)}
                    style={({ pressed }) => [styles.kpiCardPressable, pressed && styles.kpiCardPressed]}
                  >
                    <Card style={styles.kpiCard}>
                      <View style={[styles.kpiIconBubble, { backgroundColor: metric.iconSurface }]}>
                        <Ionicons name={metric.icon} size={16} color={metric.iconColor} />
                      </View>
                      <Text style={styles.kpiLabel} numberOfLines={1}>
                        {metric.label}
                      </Text>
                      <Text style={styles.kpiValue} numberOfLines={1}>
                        {metric.value}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>

              <View style={styles.categorySpendingSection}>
                <SectionHeader
                  title="Gastos por Categoria"
                  actionLabel="Ver mais"
                  onActionPress={handleSeeMoreCategorySpendingPress}
                />

                <Card style={styles.categorySpendingCard}>
                  <View style={styles.categoryDonutSection}>
                    <View style={styles.categoryDonutWrap}>
                      <Svg
                        width={HOME_CATEGORY_DONUT_SIZE}
                        height={HOME_CATEGORY_DONUT_SIZE}
                        style={styles.categoryDonutSvg}
                      >
                        <Circle
                          cx={categoryDonut.center}
                          cy={categoryDonut.center}
                          r={HOME_CATEGORY_DONUT_RADIUS}
                          fill="none"
                          stroke={colors.mutedSurface}
                          strokeWidth={HOME_CATEGORY_DONUT_STROKE_WIDTH}
                        />
                        {categoryDonut.segments.map((segment) => (
                          <Circle
                            key={segment.id}
                            cx={categoryDonut.center}
                            cy={categoryDonut.center}
                            r={HOME_CATEGORY_DONUT_RADIUS}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={HOME_CATEGORY_DONUT_STROKE_WIDTH}
                            strokeDasharray={`${segment.dashLength} ${Math.max(
                              categoryDonut.circumference - segment.dashLength,
                              0
                            )}`}
                            strokeDashoffset={-segment.dashOffset}
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${categoryDonut.center} ${categoryDonut.center})`}
                          />
                        ))}
                      </Svg>

                      <View style={styles.categoryDonutCenter}>
                        <Text style={styles.categoryDonutCenterLabel}>Total</Text>
                        <Text style={styles.categoryDonutCenterValue} numberOfLines={1}>
                          {isAmountsVisible ? `R$ ${Math.round(totalCategorySpending)}` : 'R$ ***'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.categoryLegendList}>
                    {HOME_CATEGORY_SPENDING.map((item) => {
                      const percent = totalCategorySpending
                        ? Math.round((item.amount / totalCategorySpending) * 100)
                        : 0;

                      return (
                        <View key={item.id} style={styles.categoryLegendRow}>
                          <View style={styles.categoryLegendLeft}>
                            <View style={[styles.categoryLegendDot, { backgroundColor: item.color }]} />
                            <Text style={styles.categoryLegendLabel} numberOfLines={1}>
                              {item.label}
                            </Text>
                          </View>

                          <View style={styles.categoryLegendRight}>
                            <Text style={styles.categoryLegendPercent}>{percent}%</Text>
                            <Text style={styles.categoryLegendAmount} numberOfLines={1}>
                              {formatHiddenOrVisibleCurrency(item.amount, !isAmountsVisible)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </View>

              <View style={styles.recentSection}>
                <SectionHeader
                  title="Transações Recentes"
                  actionLabel="Ver todos"
                  onActionPress={handleSeeAllPress}
                />

                <Card noPadding style={styles.transactionsCard}>
                  {data.recentTransactions.map((transaction, index) => (
                    <TransactionListItem
                      key={transaction.id}
                      item={transaction}
                      showDivider={index < data.recentTransactions.length - 1}
                      hideAmounts={!isAmountsVisible}
                    />
                  ))}
                </Card>
              </View>
            </View>
          </ScrollView>

          <Modal
            visible={isTransactionsModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseTransactionsModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de lancamentos"
                onPress={handleCloseTransactionsModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: backdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  {
                    transform: [{ translateY: sheetTranslateY }],
                  },
                ]}
              >
                <View {...modalPanResponder.panHandlers} style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Todos os lancamentos</Text>
                      <Text style={styles.modalSubtitle}>{data.summary.monthLabel}</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseTransactionsModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Card noPadding style={styles.modalTransactionsCard}>
                    {data.recentTransactions.map((transaction, index) => (
                      <TransactionListItem
                        key={`modal-${transaction.id}`}
                        item={transaction}
                        showDivider={index < data.recentTransactions.length - 1}
                        hideAmounts={!isAmountsVisible}
                      />
                    ))}
                  </Card>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCloseTransactionsModal}
                    style={({ pressed }) => [
                      styles.modalDoneButton,
                      pressed && styles.modalDoneButtonPressed,
                    ]}
                  >
                    <Text style={styles.modalDoneButtonText}>Fechar</Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>

          <Modal
            visible={isAccountsModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseAccountsModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de contas"
                onPress={handleCloseAccountsModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: accountsBackdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  styles.infoModalSheet,
                  { transform: [{ translateY: accountsSheetTranslateY }] },
                ]}
              >
                <View style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Minhas contas</Text>
                      <Text style={styles.modalSubtitle}>{HOME_ACCOUNTS.length} conta(s)</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseAccountsModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.infoModalScrollContent}
                >
                  <Card style={styles.accountsModalSummaryCard}>
                    <Text style={styles.accountsModalSummaryLabel}>Saldo total em contas</Text>
                    <Text style={styles.accountsModalSummaryAmount}>
                      {formatHiddenOrVisibleCurrency(
                        HOME_ACCOUNTS.reduce((sum, account) => sum + account.balance, 0),
                        !isAmountsVisible
                      )}
                    </Text>
                  </Card>

                  <Card noPadding style={styles.accountsModalListCard}>
                    {HOME_ACCOUNTS.map((account, index) => (
                      <View key={account.id}>
                        <View style={styles.accountsModalRow}>
                          <View style={styles.accountsModalRowLeft}>
                            <View style={styles.accountsModalBankIcon}>
                              <Ionicons name="card-outline" size={14} color={colors.primaryLight} />
                            </View>

                            <View style={styles.accountsModalRowTexts}>
                              <Text style={styles.accountsModalBankName} numberOfLines={1}>
                                {account.bank}
                              </Text>
                              <Text style={styles.accountsModalRowMeta} numberOfLines={1}>
                                {account.nickname} • {account.typeLabel}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.accountsModalRowAmount} numberOfLines={1}>
                            {formatHiddenOrVisibleCurrency(account.balance, !isAmountsVisible)}
                          </Text>
                        </View>

                        {index < HOME_ACCOUNTS.length - 1 ? (
                          <View style={styles.accountsModalDivider} />
                        ) : null}
                      </View>
                    ))}
                  </Card>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCloseAccountsModal}
                    style={({ pressed }) => [
                      styles.modalDoneButton,
                      pressed && styles.modalDoneButtonPressed,
                    ]}
                  >
                    <Text style={styles.modalDoneButtonText}>Fechar</Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>

          <Modal
            visible={isCategorySpendingModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseCategorySpendingModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de gastos por categoria"
                onPress={handleCloseCategorySpendingModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: categorySpendingBackdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  styles.infoModalSheet,
                  { transform: [{ translateY: categorySpendingSheetTranslateY }] },
                ]}
              >
                <View style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Gastos por categoria</Text>
                      <Text style={styles.modalSubtitle}>{data.summary.monthLabel}</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseCategorySpendingModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.infoModalScrollContent}
                >
                  <Card style={styles.categoryModalOverviewCard}>
                    <View style={styles.categoryModalOverviewChartWrap}>
                      <Svg
                        width={HOME_CATEGORY_DONUT_SIZE}
                        height={HOME_CATEGORY_DONUT_SIZE}
                        style={styles.categoryDonutSvg}
                      >
                        <Circle
                          cx={categoryDonut.center}
                          cy={categoryDonut.center}
                          r={HOME_CATEGORY_DONUT_RADIUS}
                          fill="none"
                          stroke={colors.mutedSurface}
                          strokeWidth={HOME_CATEGORY_DONUT_STROKE_WIDTH}
                        />
                        {categoryDonut.segments.map((segment) => (
                          <Circle
                            key={`modal-${segment.id}`}
                            cx={categoryDonut.center}
                            cy={categoryDonut.center}
                            r={HOME_CATEGORY_DONUT_RADIUS}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={HOME_CATEGORY_DONUT_STROKE_WIDTH}
                            strokeDasharray={`${segment.dashLength} ${Math.max(
                              categoryDonut.circumference - segment.dashLength,
                              0
                            )}`}
                            strokeDashoffset={-segment.dashOffset}
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${categoryDonut.center} ${categoryDonut.center})`}
                          />
                        ))}
                      </Svg>

                      <View style={styles.categoryDonutCenter}>
                        <Text style={styles.categoryDonutCenterLabel}>Total</Text>
                        <Text style={styles.categoryDonutCenterValue} numberOfLines={1}>
                          {isAmountsVisible ? `R$ ${Math.round(totalCategorySpending)}` : 'R$ ***'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.categoryModalOverviewTextBlock}>
                      <Text style={styles.categoryModalOverviewTitle}>Resumo do mês</Text>
                      <Text style={styles.categoryModalOverviewText}>
                        Categorias com maior impacto nas despesas do período.
                      </Text>
                    </View>
                  </Card>

                  <Card noPadding style={styles.categoryModalListCard}>
                    {HOME_CATEGORY_SPENDING.map((item, index) => {
                      const percent = totalCategorySpending
                        ? Math.round((item.amount / totalCategorySpending) * 100)
                        : 0;

                      return (
                        <View key={`category-modal-${item.id}`} style={styles.categoryModalRow}>
                          <View style={styles.categoryModalRowHeader}>
                            <View style={styles.categoryLegendLeft}>
                              <View
                                style={[styles.categoryLegendDot, { backgroundColor: item.color }]}
                              />
                              <Text style={styles.categoryLegendLabel} numberOfLines={1}>
                                {item.label}
                              </Text>
                            </View>

                            <View style={styles.categoryLegendRight}>
                              <Text style={styles.categoryLegendPercent}>{percent}%</Text>
                              <Text style={styles.categoryLegendAmount} numberOfLines={1}>
                                {formatHiddenOrVisibleCurrency(item.amount, !isAmountsVisible)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.categoryModalBarTrack}>
                            <View
                              style={[
                                styles.categoryModalBarFill,
                                {
                                  width: `${percent}%`,
                                  backgroundColor: item.color,
                                },
                              ]}
                            />
                          </View>

                          {index < HOME_CATEGORY_SPENDING.length - 1 ? (
                            <View style={styles.accountsModalDivider} />
                          ) : null}
                        </View>
                      );
                    })}
                  </Card>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCloseCategorySpendingModal}
                    style={({ pressed }) => [
                      styles.modalDoneButton,
                      pressed && styles.modalDoneButtonPressed,
                    ]}
                  >
                    <Text style={styles.modalDoneButtonText}>Fechar</Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>

          <Modal
            visible={isQuickAddModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseQuickAddModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de novo lançamento"
                onPress={handleCloseQuickAddModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: quickAddBackdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  styles.quickAddSheet,
                  {
                    transform: [{ translateY: quickAddSheetTranslateY }],
                  },
                ]}
              >
                <View {...quickAddModalPanResponder.panHandlers} style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Novo lançamento</Text>
                      <Text style={styles.modalSubtitle}>Adicione uma movimentacao rapidamente</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseQuickAddModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.quickAddBody}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.quickAddScroll}
                    contentContainerStyle={styles.quickAddScrollContent}
                  >
                    <View style={styles.quickAddContent}>
                      <Text style={styles.quickAddSectionLabel}>Tipo</Text>

                      <View style={styles.quickAddTypeRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setQuickAddType('income')}
                          style={({ pressed }) => [
                            styles.quickAddTypeButton,
                            quickAddType === 'income' && styles.quickAddTypeButtonIncomeActive,
                            pressed && styles.quickAddTypeButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="trending-up"
                            size={16}
                            color={quickAddType === 'income' ? colors.success : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.quickAddTypeButtonText,
                              quickAddType === 'income' &&
                              styles.quickAddTypeButtonTextIncomeActive,
                            ]}
                          >
                            Receita
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setQuickAddType('expense')}
                          style={({ pressed }) => [
                            styles.quickAddTypeButton,
                            quickAddType === 'expense' && styles.quickAddTypeButtonExpenseActive,
                            pressed && styles.quickAddTypeButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="trending-down"
                            size={16}
                            color={quickAddType === 'expense' ? colors.danger : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.quickAddTypeButtonText,
                              quickAddType === 'expense' &&
                              styles.quickAddTypeButtonTextExpenseActive,
                            ]}
                          >
                            Despesa
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.quickAddPreviewCard}>
                        <View style={styles.quickAddPreviewRow}>
                          <Text style={styles.quickAddPreviewLabel}>Valor</Text>
                          <View style={styles.quickAddAmountInputWrap}>
                            <Text style={styles.quickAddAmountPrefix}>R$</Text>
                            <TextInput
                              value={quickAddAmount}
                              onChangeText={handleQuickAddAmountChange}
                              placeholder="0.00"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="decimal-pad"
                              style={styles.quickAddAmountInput}
                              textAlign="right"
                              returnKeyType="done"
                            />
                          </View>
                        </View>
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddCategoryPicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Categoria</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                quickAddCategory && styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {quickAddCategory ?? 'Selecionar'}
                            </Text>
                            <Ionicons
                              name={isQuickAddCategoryPickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                        {isQuickAddCategoryPickerOpen ? (
                          <View style={styles.quickAddInlineDropdownPanel}>
                            <Text style={styles.quickAddDropdownTitle}>Categorias</Text>
                            <View style={styles.quickAddCategoryChips}>
                              {QUICK_ADD_CATEGORY_OPTIONS.map((category) => {
                                const selected = quickAddCategory === category;

                                return (
                                  <Pressable
                                    key={category}
                                    accessibilityRole="button"
                                    onPress={() => handleSelectQuickAddCategory(category)}
                                    style={({ pressed }) => [
                                      styles.quickAddCategoryChip,
                                      selected && styles.quickAddCategoryChipActive,
                                      pressed && styles.quickAddCategoryChipPressed,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.quickAddCategoryChipText,
                                        selected && styles.quickAddCategoryChipTextActive,
                                      ]}
                                    >
                                      {category}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddDatePicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Data</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {formatQuickAddDate(quickAddDate)}
                            </Text>
                            <Ionicons
                              name={isQuickAddDatePickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                        {isQuickAddDatePickerOpen ? (
                          <View style={styles.quickAddInlineDropdownPanel}>
                            <Text style={styles.quickAddDropdownTitle}>Data do lancamento</Text>

                            <View style={styles.quickAddDatePresets}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => setQuickAddDatePreset('yesterday')}
                                style={({ pressed }) => [
                                  styles.quickAddDatePresetChip,
                                  pressed && styles.quickAddDatePresetChipPressed,
                                ]}
                              >
                                <Text style={styles.quickAddDatePresetChipText}>Ontem</Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => setQuickAddDatePreset('today')}
                                style={({ pressed }) => [
                                  styles.quickAddDatePresetChip,
                                  styles.quickAddDatePresetChipPrimary,
                                  pressed && styles.quickAddDatePresetChipPressed,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.quickAddDatePresetChipText,
                                    styles.quickAddDatePresetChipTextPrimary,
                                  ]}
                                >
                                  Hoje
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => setQuickAddDatePreset('tomorrow')}
                                style={({ pressed }) => [
                                  styles.quickAddDatePresetChip,
                                  pressed && styles.quickAddDatePresetChipPressed,
                                ]}
                              >
                                <Text style={styles.quickAddDatePresetChipText}>Amanha</Text>
                              </Pressable>
                            </View>

                            <View style={styles.quickAddDateStepper}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => adjustQuickAddDateByDays(-1)}
                                style={({ pressed }) => [
                                  styles.quickAddDateStepButton,
                                  pressed && styles.quickAddDateStepButtonPressed,
                                ]}
                              >
                                <Ionicons name="remove" size={18} color={colors.textPrimary} />
                              </Pressable>

                              <Text style={styles.quickAddDateStepperText}>
                                {formatQuickAddDate(quickAddDate)}
                              </Text>

                              <Pressable
                                accessibilityRole="button"
                                onPress={() => adjustQuickAddDateByDays(1)}
                                style={({ pressed }) => [
                                  styles.quickAddDateStepButton,
                                  pressed && styles.quickAddDateStepButtonPressed,
                                ]}
                              >
                                <Ionicons name="add" size={18} color={colors.textPrimary} />
                              </Pressable>
                            </View>

                            <Pressable
                              accessibilityRole="button"
                              onPress={handleOpenQuickAddNativeDatePicker}
                              style={({ pressed }) => [
                                styles.quickAddOpenCalendarButton,
                                pressed && styles.quickAddOpenCalendarButtonPressed,
                              ]}
                            >
                              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                              <Text style={styles.quickAddOpenCalendarButtonText}>
                                Escolher no calendario
                              </Text>
                            </Pressable>

                            {isQuickAddNativeDatePickerVisible ? (
                              <View style={styles.quickAddNativeDatePickerWrap}>
                                <DateTimePicker
                                  value={quickAddDate}
                                  mode="date"
                                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                                  onChange={handleQuickAddNativeDateChange}
                                />

                                {Platform.OS === 'ios' ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setIsQuickAddNativeDatePickerVisible(false)}
                                    style={({ pressed }) => [
                                      styles.quickAddCalendarDoneButton,
                                      pressed && styles.quickAddCalendarDoneButtonPressed,
                                    ]}
                                  >
                                    <Text style={styles.quickAddCalendarDoneButtonText}>
                                      Concluir
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddAccountPicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Conta (opcional)</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                quickAddAccount && styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {quickAddAccount ?? 'Selecionar'}
                            </Text>
                            <Ionicons
                              name={isQuickAddAccountPickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                        {isQuickAddAccountPickerOpen ? (
                          <View style={styles.quickAddInlineDropdownPanel}>
                            <Text style={styles.quickAddDropdownTitle}>Conta</Text>
                            <View style={styles.quickAddCategoryChips}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => handleSelectQuickAddAccount(null)}
                                style={({ pressed }) => [
                                  styles.quickAddCategoryChip,
                                  quickAddAccount === null && styles.quickAddCategoryChipActive,
                                  pressed && styles.quickAddCategoryChipPressed,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.quickAddCategoryChipText,
                                    quickAddAccount === null &&
                                    styles.quickAddCategoryChipTextActive,
                                  ]}
                                >
                                  Nenhuma
                                </Text>
                              </Pressable>

                              {QUICK_ADD_ACCOUNT_OPTIONS.map((account) => {
                                const selected = quickAddAccount === account;

                                return (
                                  <Pressable
                                    key={account}
                                    accessibilityRole="button"
                                    onPress={() => handleSelectQuickAddAccount(account)}
                                    style={({ pressed }) => [
                                      styles.quickAddCategoryChip,
                                      selected && styles.quickAddCategoryChipActive,
                                      pressed && styles.quickAddCategoryChipPressed,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.quickAddCategoryChipText,
                                        selected && styles.quickAddCategoryChipTextActive,
                                      ]}
                                    >
                                      {account}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddPaymentPicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Pagamento</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {quickAddPaymentMethod}
                            </Text>
                            <Ionicons
                              name={isQuickAddPaymentPickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                        {isQuickAddPaymentPickerOpen ? (
                          <View style={styles.quickAddInlineDropdownPanel}>
                            <Text style={styles.quickAddDropdownTitle}>Pagamento</Text>
                            <View style={styles.quickAddCategoryChips}>
                              {QUICK_ADD_PAYMENT_OPTIONS.map((paymentMethod) => {
                                const selected = quickAddPaymentMethod === paymentMethod;

                                return (
                                  <Pressable
                                    key={paymentMethod}
                                    accessibilityRole="button"
                                    onPress={() =>
                                      handleSelectQuickAddPaymentMethod(paymentMethod)
                                    }
                                    style={({ pressed }) => [
                                      styles.quickAddCategoryChip,
                                      selected && styles.quickAddCategoryChipActive,
                                      pressed && styles.quickAddCategoryChipPressed,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.quickAddCategoryChipText,
                                        selected && styles.quickAddCategoryChipTextActive,
                                      ]}
                                    >
                                      {paymentMethod}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.quickAddPreviewDivider} />
                        <View style={styles.quickAddPreviewRow}>
                          <View style={styles.quickAddRecurringTextBlock}>
                            <Text style={styles.quickAddPreviewLabel}>Transação recorrente</Text>
                            <Text style={styles.quickAddRecurringHint}>Repetir todo mes</Text>
                          </View>
                          <Switch
                            value={quickAddIsRecurring}
                            onValueChange={setQuickAddIsRecurring}
                            trackColor={{
                              false: colors.border,
                              true: 'rgba(37, 99, 235, 0.35)',
                            }}
                            thumbColor={quickAddIsRecurring ? colors.primaryLight : colors.white}
                            ios_backgroundColor={colors.border}
                          />
                        </View>
                      </View>

                      <Card style={styles.quickAddDescriptionCard}>
                        <View style={styles.quickAddDescriptionHeader}>
                          <Text style={styles.quickAddDropdownTitle}>Descrição</Text>
                        </View>
                        <TextInput
                          value={quickAddDescription}
                          onChangeText={setQuickAddDescription}
                          placeholder="Adicione uma descricao..."
                          placeholderTextColor={colors.textSecondary}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                          style={styles.quickAddDescriptionInput}
                        />
                      </Card>

                    </View>
                  </ScrollView>

                  <View style={styles.quickAddFooter}>
                    <View style={styles.quickAddActions}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleCloseQuickAddModal}
                        style={({ pressed }) => [
                          styles.quickAddSecondaryButton,
                          pressed && styles.quickAddSecondaryButtonPressed,
                        ]}
                      >
                        <Text style={styles.quickAddSecondaryButtonText}>Cancelar</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={handleConfirmQuickAdd}
                        style={({ pressed }) => [
                          styles.quickAddPrimaryButton,
                          pressed && styles.quickAddPrimaryButtonPressed,
                        ]}
                      >
                        <Text style={styles.quickAddPrimaryButtonText}>Continuar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <FloatingActionButton onPress={handleFabPress} style={styles.fab} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: BOTTOM_TAB_BAR_HEIGHT + FAB_SIZE + spacing.xl + spacing.lg,
  },
  header: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerGreeting: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerName: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  visibilityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visibilityButtonPressed: {
    opacity: 0.75,
  },
  dashboardStack: {
    gap: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
  },
  accountsSection: {
    gap: spacing.md,
  },
  accountCardButton: {
    alignSelf: 'flex-start',
    width: '100%',
  },
  accountCardButtonPressed: {
    opacity: 0.9,
  },
  accountCard: {
    backgroundColor: '#2563EB',
    borderColor: 'rgba(37, 99, 235, 0.2)',
    overflow: 'hidden',
    minHeight: 132,
  },
  accountCardDecorLarge: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -16,
    right: -18,
  },
  accountCardDecorSmall: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    bottom: -12,
    right: -10,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountCardIconBubble: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  accountCardBank: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    opacity: 0.95,
    flexShrink: 1,
  },
  accountCardNickname: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.md,
  },
  accountCardAmount: {
    ...typography.value,
    color: colors.white,
    marginTop: spacing.xs,
  },
  accountCardFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  accountCardType: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: '500',
    flexShrink: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kpiCardPressable: {
    flex: 1,
  },
  kpiCardPressed: {
    opacity: 0.85,
  },
  kpiCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  kpiIconBubble: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  kpiValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  categorySpendingSection: {
    gap: spacing.md,
  },
  categorySpendingCard: {
    gap: spacing.lg,
  },
  categoryDonutSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  categoryDonutWrap: {
    width: HOME_CATEGORY_DONUT_SIZE,
    height: HOME_CATEGORY_DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryDonutSvg: {
    position: 'absolute',
  },
  categoryDonutCenter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  categoryDonutCenterLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryDonutCenterValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  categoryLegendList: {
    gap: spacing.sm,
  },
  categoryLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryLegendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  categoryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  categoryLegendLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  categoryLegendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  categoryLegendPercent: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryLegendAmount: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  recentSection: {
    gap: spacing.lg,
  },
  transactionsCard: {
    overflow: 'hidden',
  },
  moreButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.mutedSurface,
  },
  moreButtonPressed: {
    opacity: 0.8,
  },
  moreButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: BOTTOM_TAB_BAR_HEIGHT - FAB_SIZE / 1,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalDragRegion: {
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalHeaderTextBlock: {
    flex: 1,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseButtonPressed: {
    opacity: 0.75,
  },
  modalScrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalTransactionsCard: {
    overflow: 'hidden',
  },
  infoModalSheet: {
    maxHeight: '82%',
  },
  infoModalScrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  accountsModalSummaryCard: {
    gap: spacing.xs,
  },
  accountsModalSummaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  accountsModalSummaryAmount: {
    ...typography.value,
    color: colors.textPrimary,
  },
  accountsModalListCard: {
    overflow: 'hidden',
  },
  accountsModalRow: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountsModalRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountsModalBankIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    flexShrink: 0,
  },
  accountsModalRowTexts: {
    flex: 1,
    minWidth: 0,
  },
  accountsModalBankName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  accountsModalRowMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  accountsModalRowAmount: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    flexShrink: 0,
  },
  accountsModalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  categoryModalOverviewCard: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  categoryModalOverviewChartWrap: {
    width: HOME_CATEGORY_DONUT_SIZE,
    height: HOME_CATEGORY_DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryModalOverviewTextBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryModalOverviewTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  categoryModalOverviewText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categoryModalListCard: {
    overflow: 'hidden',
  },
  categoryModalRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryModalRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryModalBarTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    overflow: 'hidden',
  },
  categoryModalBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    minWidth: 8,
  },
  modalDoneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  modalDoneButtonPressed: {
    opacity: 0.9,
  },
  modalDoneButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  quickAddSheet: {
    maxHeight: '96%',
    minHeight: '78%',
    overflow: 'hidden',
  },
  quickAddBody: {
    flex: 1,
  },
  quickAddScroll: {
    flex: 1,
  },
  quickAddScrollContent: {
    paddingBottom: spacing.lg,
  },
  quickAddContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  quickAddSectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickAddTypeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickAddTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickAddTypeButtonIncomeActive: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderColor: 'rgba(22, 163, 74, 0.28)',
  },
  quickAddTypeButtonExpenseActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.28)',
  },
  quickAddTypeButtonPressed: {
    opacity: 0.85,
  },
  quickAddTypeButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddTypeButtonTextIncomeActive: {
    color: colors.success,
  },
  quickAddTypeButtonTextExpenseActive: {
    color: colors.danger,
  },
  quickAddPreviewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  quickAddPreviewRow: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quickAddPreviewRowPressed: {
    backgroundColor: colors.mutedSurface,
  },
  quickAddPreviewLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  quickAddAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    minWidth: 120,
  },
  quickAddAmountPrefix: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickAddAmountInput: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    minWidth: 68,
    paddingVertical: 0,
  },
  quickAddPreviewValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddPreviewPlaceholder: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddPreviewValueSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddPreviewTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickAddPreviewDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  quickAddInlineDropdownPanel: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  quickAddRecurringTextBlock: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  quickAddRecurringHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickAddDescriptionCard: {
    gap: spacing.sm,
  },
  quickAddDescriptionHeader: {
    marginBottom: 2,
  },
  quickAddDescriptionInput: {
    ...typography.body,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAddDropdownCard: {
    gap: spacing.md,
  },
  quickAddDropdownTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddCategoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddCategoryChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAddCategoryChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  quickAddCategoryChipPressed: {
    opacity: 0.85,
  },
  quickAddCategoryChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddCategoryChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddDatePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddDatePresetChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAddDatePresetChipPrimary: {
    backgroundColor: '#DBEAFE',
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  quickAddDatePresetChipPressed: {
    opacity: 0.85,
  },
  quickAddDatePresetChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddDatePresetChipTextPrimary: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddDateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  quickAddNativeDatePickerWrap: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  quickAddDateStepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mutedSurface,
  },
  quickAddDateStepButtonPressed: {
    opacity: 0.8,
  },
  quickAddDateStepperText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddOpenCalendarButton: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickAddOpenCalendarButtonPressed: {
    opacity: 0.85,
  },
  quickAddOpenCalendarButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddCalendarDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  quickAddCalendarDoneButtonPressed: {
    opacity: 0.85,
  },
  quickAddCalendarDoneButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickAddFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  quickAddSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddSecondaryButtonPressed: {
    opacity: 0.8,
  },
  quickAddSecondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddPrimaryButtonPressed: {
    opacity: 0.92,
  },
  quickAddPrimaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});

