import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Calendar as CalIcon,
  Car,
  Home,
  Landmark,
  Plane,
  Plus,
  Target,
  Trash2,
} from "lucide-react-native";
import { Calendar, CalendarUtils } from "react-native-calendars";

import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { BottomSheet } from "../components/BottomSheet";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { FieldCard, FieldDivider, FieldRow } from "../components/FormField";
import { useAccounts } from "../features/accounts/hooks/useAccounts";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import {
  useCreateGoalMutation,
  useDeleteGoalMutation,
  useGoalContributionMutation,
  useGoals,
  useUpdateGoalMutation,
} from "../features/goals/hooks/useGoals";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import { formatCurrencyBRL } from "../utils/format";

const TODAY = CalendarUtils.getCalendarDateString(new Date());
const GOAL_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F43F5E", "#F59E0B"];
const ICONS = [
  { id: "target", label: "Geral", Icon: Target },
  { id: "car", label: "Carro", Icon: Car },
  { id: "home", label: "Casa", Icon: Home },
  { id: "plane", label: "Viagem", Icon: Plane },
  { id: "wallet", label: "Reserva", Icon: Landmark },
] as const;

function moneyMask(v: string) {
  const raw = v.replace(/\D/g, "");
  if (!raw) return "";
  return (Number(raw) / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function moneyValue(v: string) {
  return Number((v || "0").replace(/\./g, "").replace(",", "."));
}
function iconOf(id: string) {
  return ICONS.find((item) => item.id === id)?.Icon ?? Target;
}
function dateBR(v: string | null) {
  return v ? v.split("-").reverse().join("/") : "Sem prazo";
}
function monthlyNeed(current: number, target: number, due: string | null) {
  if (current >= target) return 0;
  if (!due) return (target - current) / 12;
  const now = new Date();
  const end = new Date(`${due}T00:00:00`);
  const months = Math.max(
    1,
    (end.getFullYear() - now.getFullYear()) * 12 +
      end.getMonth() -
      now.getMonth() +
      1,
  );
  return (target - current) / months;
}

export default function MetasScreen() {
  const themeColors = useThemeColors();
  const s = useMemo(() => createStyles(themeColors), [themeColors]);
  const user = useAuthenticatedUser();
  const goalsQuery = useGoals(user?.id);
  const accountsQuery = useAccounts(user?.id);
  const createGoal = useCreateGoalMutation(user?.id);
  const deleteGoal = useDeleteGoalMutation(user?.id);
  const contribute = useGoalContributionMutation(user?.id);
  const updateGoal = useUpdateGoalMutation(user?.id);

  const [tab, setTab] = useState<"active" | "completed">("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [due, setDue] = useState(TODAY);
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [icon, setIcon] = useState<(typeof ICONS)[number]["id"]>("car");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tempDue, setTempDue] = useState(TODAY);

  const goals = goalsQuery.data ?? [];
  const accounts = (accountsQuery.data ?? []).filter((item) => item.isActive);
  const activeCount = goals.filter(
    (item) => item.status !== "completed",
  ).length;
  const doneCount = goals.filter((item) => item.status === "completed").length;
  const list = goals.filter((item) =>
    tab === "active"
      ? item.status !== "completed"
      : item.status === "completed",
  );
  const selectedGoal = useMemo(
    () => goals.find((item) => item.id === goalId) ?? null,
    [goals, goalId],
  );

  const resetCreate = () => {
    setTitle("");
    setTarget("");
    setSaved("");
    setDue(TODAY);
    setColor(GOAL_COLORS[0]);
    setIcon("car");
  };

  const closeModal = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const onCreate = async () => {
    if (!title.trim() || !target) {
      Alert.alert("Atenção", "Informe nome e valor alvo.");
      return;
    }
    try {
      await createGoal.mutateAsync({
        title: title.trim(),
        targetAmount: moneyValue(target),
        initialAmount: moneyValue(saved),
        targetDate: due,
        color,
        icon,
      });
      closeModal();
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível criar a meta.",
      );
    }
  };

  const onDelete = (id: string) =>
    Alert.alert("Excluir meta", "Deseja realmente apagar esta meta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGoal.mutateAsync(id);
          } catch (error) {
            Alert.alert(
              "Erro",
              error instanceof Error
                ? error.message
                : "Não foi possível excluir a meta.",
            );
          }
        },
      },
    ]);

  const onContribute = async () => {
    if (!goalId || !accountId || moneyValue(amount) <= 0) {
      Alert.alert("Atenção", "Selecione uma conta e informe um aporte válido.");
      return;
    }
    try {
      await contribute.mutateAsync({
        goalId,
        accountId,
        amount: moneyValue(amount),
        note,
      });
      setAddOpen(false);
      setAmount("");
      setNote("");
      setGoalId(null);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o aporte.",
      );
    }
  };

  const onUpdateDeadline = async (next: string | null) => {
    if (!goalId) return;
    try {
      await updateGoal.mutateAsync({ id: goalId, targetDate: next });
      setDeadlineOpen(false);
      setGoalId(null);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o prazo.",
      );
    }
  };

  return (
    <>
      <PageShell withTabBarInset>
        <PageHeader
          title="Metas Financeiras"
          subtitle={`${activeCount} ativa(s)`}
          variant="primary"
          action={
            <Button
              label="Nova Meta"
              size="sm"
              icon={<Plus size={16} color={themeColors.white} />}
              onPress={() => {
                resetCreate();
                setCreateOpen(true);
              }}
            />
          }
        />

        <View style={s.tabs}>
          <Pressable
            style={[s.tab, tab === "active" && s.tabOn]}
            onPress={() => setTab("active")}
          >
            <Text style={[s.tabText, tab === "active" && s.tabTextOn]}>
              Ativas ({activeCount})
            </Text>
          </Pressable>
          <Pressable
            style={[s.tab, tab === "completed" && s.tabOn]}
            onPress={() => setTab("completed")}
          >
            <Text style={[s.tabText, tab === "completed" && s.tabTextOn]}>
              Concluídas ({doneCount})
            </Text>
          </Pressable>
        </View>

        {goalsQuery.isLoading ? (
          <View style={s.card}>
            <ActivityIndicator color={themeColors.primaryLight} />
          </View>
        ) : null}
        {goalsQuery.isError ? (
          <View style={s.card}>
            <Text style={s.msg}>Não foi possível carregar as metas.</Text>
            <Pressable style={s.retry} onPress={() => goalsQuery.refetch()}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {!goalsQuery.isLoading && !goalsQuery.isError && !list.length ? (
          <View style={s.card}>
            <Text style={s.msg}>Nenhuma meta nesta aba.</Text>
          </View>
        ) : null}

        {list.map((goal) => {
          const Icon = iconOf(goal.icon);
          const done = goal.status === "completed";
          return (
            <View
              key={goal.id}
              style={[
                s.card,
                s.goal,
                { borderTopColor: goal.color, borderTopWidth: 4 },
              ]}
            >
              <View style={s.row}>
                <View style={[s.iconBox, { backgroundColor: goal.color }]}>
                  <Icon size={20} color={themeColors.white} />
                </View>
                <View style={s.flex}>
                  <Text style={s.goalTitle}>{goal.title}</Text>
                  <Text style={s.goalSub}>
                    {done
                      ? "Meta concluída"
                      : `Prazo: ${dateBR(goal.targetDate)}`}
                  </Text>
                </View>
                {!done ? (
                  <Pressable
                    style={s.iconBtn}
                    onPress={() => {
                      setGoalId(goal.id);
                      setTempDue(goal.targetDate ?? TODAY);
                      setDeadlineOpen(true);
                    }}
                  >
                    <CalIcon size={18} color={themeColors.primary} />
                  </Pressable>
                ) : null}
                <Pressable style={s.iconBtn} onPress={() => onDelete(goal.id)}>
                  <Trash2 size={18} color={themeColors.danger} />
                </Pressable>
              </View>
              <View style={[s.row, s.between]}>
                <Text style={s.money}>
                  {formatCurrencyBRL(goal.currentAmount)}
                </Text>
                <Text style={s.money}>
                  {formatCurrencyBRL(goal.targetAmount)}
                </Text>
              </View>
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.min(goal.progressPercent, 100)}%`,
                      backgroundColor: done
                        ? themeColors.success
                        : themeColors.textPrimary,
                    },
                  ]}
                />
              </View>
              <Text style={s.pct}>
                {goal.progressPercent.toFixed(1)}% alcançado
              </Text>
              {!done ? (
                <View style={s.soft}>
                  <Text style={s.softText}>
                    Guarde{" "}
                    <Text style={s.softStrong}>
                      {formatCurrencyBRL(
                        monthlyNeed(
                          goal.currentAmount,
                          goal.targetAmount,
                          goal.targetDate,
                        ),
                      )}
                      /mês
                    </Text>{" "}
                    para concluir no prazo.
                  </Text>
                </View>
              ) : null}
              {!done ? (
                <Pressable
                  style={s.add}
                  onPress={() => {
                    setGoalId(goal.id);
                    setAccountId(accounts[0]?.id ?? "");
                    setAmount("");
                    setNote("");
                    setAddOpen(true);
                  }}
                >
                  <Plus size={18} color={themeColors.textPrimary} />
                  <Text style={s.addText}>Adicionar</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </PageShell>

      {/* Criar Nova Meta */}
      <BottomSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova Meta"
        maxHeightRatio={0.92}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Criar Meta"
              fullWidth
              onPress={onCreate}
              loading={createGoal.isPending}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Nome"
            placeholder="Ex: Reserva de emergência"
            value={title}
            onChangeText={setTitle}
          />
          <FieldDivider />
          <FieldRow
            label="Valor alvo"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={target}
            onChangeText={(v) => setTarget(moneyMask(v))}
          />
          <FieldDivider />
          <FieldRow
            label="Já guardado"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={saved}
            onChangeText={(v) => setSaved(moneyMask(v))}
          />
        </FieldCard>

        <Text style={s.label}>Prazo</Text>
        <View style={s.calendar}>
          <Calendar
            current={due}
            minDate={TODAY}
            markedDates={{
              [due]: {
                selected: true,
                selectedColor: themeColors.primaryLight,
              },
            }}
            onDayPress={(day) => setDue(day.dateString)}
            style={{ backgroundColor: themeColors.surface }}
            theme={{
              backgroundColor: themeColors.surface,
              calendarBackground: themeColors.surface,
              dayTextColor: themeColors.textPrimary,
              monthTextColor: themeColors.textPrimary,
              textDisabledColor: themeColors.textSecondary,
              todayTextColor: themeColors.primaryLight,
              selectedDayBackgroundColor: themeColors.primaryLight,
              selectedDayTextColor: themeColors.white,
              arrowColor: themeColors.primaryLight,
            }}
          />
        </View>

        <Text style={s.label}>Ícone</Text>
        <View style={s.wrap}>
          {ICONS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={icon === item.id}
              onPress={() => setIcon(item.id)}
            />
          ))}
        </View>

        <Text style={s.label}>Cor</Text>
        <View style={s.colors}>
          {GOAL_COLORS.map((item) => (
            <Pressable
              key={item}
              style={[
                s.colorCircle,
                { backgroundColor: item },
                color === item && s.colorOn,
              ]}
              onPress={() => setColor(item)}
            />
          ))}
        </View>

        <View style={s.bottomSpacer} />
      </BottomSheet>

      {/* Adicionar Valor */}
      <BottomSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar Valor"
        subtitle={`Adicionando a ${selectedGoal?.title ?? "Meta"}`}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Adicionar"
              fullWidth
              onPress={onContribute}
              disabled={!accounts.length}
              loading={contribute.isPending}
            />
          </>
        )}
      >
        <Text style={s.label}>Conta</Text>
        <View style={s.wrap}>
          {accounts.length ? (
            accounts.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                selected={accountId === item.id}
                onPress={() => setAccountId(item.id)}
              />
            ))
          ) : (
            <Text style={s.msg}>Crie uma conta antes de aportar.</Text>
          )}
        </View>

        <FieldCard>
          <FieldRow
            label="Valor"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={amount}
            onChangeText={(v) => setAmount(moneyMask(v))}
            autoFocus
          />
          <FieldDivider />
          <FieldRow
            label="Observação"
            placeholder="Opcional"
            value={note}
            onChangeText={setNote}
          />
        </FieldCard>

        <View style={s.bottomSpacer} />
      </BottomSheet>

      {/* Editar Prazo */}
      <BottomSheet
        visible={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        title="Editar Prazo"
        subtitle={`Nova data para ${selectedGoal?.title ?? "Meta"}`}
        footer={() => (
          <>
            <Button
              label="Limpar prazo"
              variant="secondary"
              fullWidth
              onPress={() => onUpdateDeadline(null)}
              disabled={updateGoal.isPending}
            />
            <Button
              label="Salvar Prazo"
              fullWidth
              onPress={() => onUpdateDeadline(tempDue)}
              loading={updateGoal.isPending}
            />
          </>
        )}
      >
        <View style={s.calendar}>
          <Calendar
            current={tempDue}
            minDate={TODAY}
            markedDates={{
              [tempDue]: {
                selected: true,
                selectedColor: themeColors.primaryLight,
              },
            }}
            onDayPress={(day) => setTempDue(day.dateString)}
            theme={{
              backgroundColor: themeColors.surface,
              calendarBackground: themeColors.surface,
              dayTextColor: themeColors.textPrimary,
              monthTextColor: themeColors.textPrimary,
              textDisabledColor: themeColors.textSecondary,
              todayTextColor: themeColors.primaryLight,
              selectedDayBackgroundColor: themeColors.primaryLight,
              selectedDayTextColor: themeColors.white,
              arrowColor: themeColors.primaryLight,
            }}
          />
        </View>
        <View style={s.bottomSpacer} />
      </BottomSheet>
    </>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    tabs: {
      flexDirection: "row",
      marginBottom: spacing.xs,
      padding: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: colors.mutedSurface,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: "center",
      borderRadius: radius.md,
    },
    tabOn: { backgroundColor: colors.surface },
    tabText: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    tabTextOn: { color: colors.textPrimary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    goal: {
      gap: spacing.md,
      elevation: 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    flex: { flex: 1 },
    between: { justifyContent: "space-between" },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    goalTitle: {
      ...typography.body,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    goalSub: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    money: {
      ...typography.body,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    track: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.pill },
    pct: {
      ...typography.caption,
      textAlign: "center",
      color: colors.textSecondary,
    },
    soft: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    softText: {
      ...typography.caption,
      textAlign: "center",
      color: colors.textSecondary,
      lineHeight: 18,
    },
    softStrong: { fontWeight: "800", color: colors.textPrimary },
    add: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    addText: {
      ...typography.body,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    msg: {
      ...typography.body,
      textAlign: "center",
      color: colors.textSecondary,
    },
    retry: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      alignSelf: "center",
      marginTop: spacing.md,
    },
    retryText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: "700",
    },
    label: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    calendar: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    wrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    colors: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    colorCircle: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
    },
    colorOn: { borderWidth: 3, borderColor: colors.textPrimary },
    bottomSpacer: {
      height: spacing.lg,
    },
  });
