import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  Minus,
  Plane,
  Plus,
  Target,
  Trash2,
} from "lucide-react-native";
import { Calendar, CalendarUtils } from "react-native-calendars";
import { useNavigation } from "@react-navigation/native";

import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { useToast } from "../components/Toast";
import { FieldCard, FieldDivider, FieldRow } from "../components/FormField";
import { useAccounts } from "../features/accounts/hooks/useAccounts";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import { formatCurrencyInput, normalizeCurrencyInput } from "../features/finance/utils";
import {
  useCreateGoalMutation,
  useDeleteGoalMutation,
  useGoalContributionMutation,
  useGoalWithdrawalMutation,
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
const ICONS = [
  { id: "target", label: "Geral", Icon: Target },
  { id: "car", label: "Carro", Icon: Car },
  { id: "home", label: "Casa", Icon: Home },
  { id: "plane", label: "Viagem", Icon: Plane },
  { id: "wallet", label: "Reserva", Icon: Landmark },
] as const;

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
  const { showSuccess, showError } = useToast();
  const goalColors = useMemo(
    () => [
      themeColors.success,
      themeColors.primary,
      themeColors.primaryLight,
      themeColors.danger,
      themeColors.warning,
    ],
    [themeColors],
  );
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const goalsQuery = useGoals(user?.id);
  const accountsQuery = useAccounts(user?.id);
  const createGoal = useCreateGoalMutation(user?.id);
  const deleteGoal = useDeleteGoalMutation(user?.id);
  const contribute = useGoalContributionMutation(user?.id);
  const withdraw = useGoalWithdrawalMutation(user?.id);
  const submittingMovement = useRef(false);
  const updateGoal = useUpdateGoalMutation(user?.id);

  const [tab, setTab] = useState<"active" | "completed">("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<"contribution" | "withdrawal">("contribution");
  const [movementError, setMovementError] = useState<string | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [due, setDue] = useState(TODAY);
  const [color, setColor] = useState(themeColors.success);
  const [icon, setIcon] = useState<(typeof ICONS)[number]["id"]>("car");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [tempDue, setTempDue] = useState(TODAY);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [reachedOpen, setReachedOpen] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [newDue, setNewDue] = useState(TODAY);

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
  const isWithdrawal = movementMode === "withdrawal";
  const movementPending = contribute.isPending || withdraw.isPending;

  const openMovement = (id: string, mode: "contribution" | "withdrawal") => {
    if (submittingMovement.current) return;
    setGoalId(id);
    setMovementMode(mode);
    setMovementError(null);
    setAccountId(accounts[0]?.id ?? "");
    setAmount("");
    setNote("");
    setAddOpen(true);
  };

  const resetCreate = () => {
    setTitle("");
    setTarget("");
    setSaved("");
    setDue(TODAY);
    setColor(goalColors[0]);
    setIcon("car");
  };

  const closeModal = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const onCreate = async () => {
    if (!title.trim() || !target) {
      showError("Informe nome e valor alvo.");
      return;
    }
    try {
      await createGoal.mutateAsync({
        title: title.trim(),
        targetAmount: normalizeCurrencyInput(target),
        initialAmount: normalizeCurrencyInput(saved),
        targetDate: due,
        color,
        icon,
      });
      closeModal();
      showSuccess("Meta criada.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a meta.",
      );
    }
  };

  const onDelete = (id: string) => setGoalToDelete(id);

  const confirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    try {
      await deleteGoal.mutateAsync(goalToDelete);
      setGoalToDelete(null);
      showSuccess("Meta excluída.");
    } catch (error) {
      setGoalToDelete(null);
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a meta.",
      );
    }
  };

  const onContribute = async () => {
    if (submittingMovement.current) return;
    const value = normalizeCurrencyInput(amount);
    if (!selectedGoal || !accounts.some((account) => account.id === accountId) || !Number.isFinite(value) || value <= 0) {
      setMovementError("Selecione uma conta e informe um valor válido.");
      showError("Selecione uma conta e informe um valor válido.");
      return;
    }
    if (!isWithdrawal) {
      const remaining = Number(
        (selectedGoal.targetAmount - selectedGoal.currentAmount).toFixed(2),
      );
      if (Math.round(value * 100) > Math.round(remaining * 100)) {
        showError(
          `O aporte excede o que falta para a meta (${formatCurrencyBRL(remaining)}).`,
        );
        return;
      }
    }
    if (isWithdrawal && Math.round(value * 100) > Math.round(selectedGoal.currentAmount * 100)) {
      setMovementError("O valor da retirada não pode ser maior que o saldo da meta.");
      showError("O valor da retirada não pode ser maior que o saldo da meta.");
      return;
    }
    submittingMovement.current = true;
    setMovementError(null);
    try {
      const reachesTarget = !isWithdrawal &&
        Math.round((selectedGoal.currentAmount + value) * 100) >= Math.round(selectedGoal.targetAmount * 100);
      await (isWithdrawal ? withdraw : contribute).mutateAsync({
        goalId: selectedGoal.id,
        accountId,
        amount: value,
        note,
      });
      setAddOpen(false);
      setAmount("");
      setNote("");
      showSuccess(isWithdrawal ? "Retirada registrada." : "Aporte registrado.");
      if (reachesTarget) {
        openReachedPrompt(selectedGoal.id);
      } else {
        setGoalId(null);
      }
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : "Não foi possível registrar a movimentação.");
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a movimentação.",
      );
    } finally {
      submittingMovement.current = false;
    }
  };

  const openReachedPrompt = (id: string) => {
    setGoalId(id);
    setContinuing(false);
    setNewTarget("");
    setNewDue(TODAY);
    setReachedOpen(true);
  };

  const closeReachedPrompt = () => {
    setReachedOpen(false);
    setContinuing(false);
    setGoalId(null);
  };

  const onCompleteGoal = async () => {
    if (!goalId) return;
    try {
      await updateGoal.mutateAsync({ id: goalId, status: "completed" });
      closeReachedPrompt();
      setTab("completed");
      showSuccess("Meta concluída.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a meta.",
      );
    }
  };

  const onContinueGoal = async () => {
    if (!goalId || !selectedGoal) return;
    const value = normalizeCurrencyInput(newTarget);
    if (!Number.isFinite(value) || value <= selectedGoal.currentAmount) {
      showError(
        `Informe um valor maior que ${formatCurrencyBRL(selectedGoal.currentAmount)}.`,
      );
      return;
    }
    if (!newDue || newDue < CalendarUtils.getCalendarDateString(new Date())) {
      showError("Informe um novo prazo a partir de hoje.");
      return;
    }
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        targetAmount: value,
        targetDate: newDue,
      });
      closeReachedPrompt();
      showSuccess("Meta atualizada.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a meta.",
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
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o prazo.",
      );
    }
  };

  return (
    <>
      <PageShell
        onBackPress={() => navigation.goBack()}
        footer={
          <Button
            label="Criar"
            fullWidth
            icon={<Plus size={18} color={themeColors.white} />}
            onPress={() => {
              resetCreate();
              setCreateOpen(true);
            }}
          />
        }
      >
        <PageHeader
          title="Metas Financeiras"
          subtitle={`${activeCount} ativa(s)`}
          variant="primary"
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

        {tab === "completed" ? (
          <View style={s.notice}>
            <Text style={s.noticeText}>
              Todas as metas concluídas, irão desaparecer dentro de 30 dias
            </Text>
          </View>
        ) : null}

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
          const reached = !done && goal.currentAmount >= goal.targetAmount;
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
              {reached ? (
                <View style={s.soft}>
                  <Text style={s.softText}>
                    <Text style={s.softStrong}>Meta atingida!</Text> Deseja
                    continuar ou concluir esta meta?
                  </Text>
                </View>
              ) : null}
              {!done && !reached ? (
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
              <View style={s.actions}>
                {reached ? (
                  <Pressable
                    style={s.add}
                    accessibilityRole="button"
                    accessibilityLabel={`Continuar ou concluir ${goal.title}`}
                    onPress={() => openReachedPrompt(goal.id)}
                  >
                    <Target size={18} color={themeColors.textPrimary} />
                    <Text style={s.addText}>Continuar ou concluir</Text>
                  </Pressable>
                ) : null}
                {!done && !reached ? (
                  <Pressable
                    style={s.add}
                    accessibilityRole="button"
                    accessibilityLabel={`Adicionar valor a ${goal.title}`}
                    onPress={() => openMovement(goal.id, "contribution")}
                  >
                    <Plus size={18} color={themeColors.textPrimary} />
                    <Text style={s.addText}>Adicionar</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[s.add, goal.currentAmount <= 0 && s.disabledAction]}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirar valor de ${goal.title}`}
                  accessibilityState={{ disabled: goal.currentAmount <= 0 }}
                  disabled={goal.currentAmount <= 0}
                  onPress={() => openMovement(goal.id, "withdrawal")}
                >
                  <Minus size={18} color={themeColors.textPrimary} />
                  <Text style={s.addText}>Retirar</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </PageShell>

      <ConfirmDialog
        visible={goalToDelete !== null}
        title="Excluir meta"
        message="Deseja realmente apagar esta meta?"
        confirmLabel="Excluir"
        loading={deleteGoal.isPending}
        onConfirm={confirmDeleteGoal}
        onCancel={() => setGoalToDelete(null)}
      />

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
              label="Criar"
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
            onChangeText={(value) => setTarget(formatCurrencyInput(value))}
          />
          <FieldDivider />
          <FieldRow
            label="Já guardado"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={saved}
            onChangeText={(value) => setSaved(formatCurrencyInput(value))}
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
          {goalColors.map((item) => (
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
        title={isWithdrawal ? "Retirar Valor" : "Adicionar Valor"}
        subtitle={`${isWithdrawal ? "Retirando de" : "Adicionando a"} ${selectedGoal?.title ?? "Meta"}`}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} disabled={movementPending} />
            <Button
              label={isWithdrawal ? "Retirar" : "Adicionar"}
              accessibilityLabel={isWithdrawal ? "Confirmar retirada" : "Confirmar aporte"}
              fullWidth
              onPress={onContribute}
              disabled={!accounts.length}
              loading={movementPending}
            />
          </>
        )}
      >
        {isWithdrawal ? (
          <Text style={s.msg}>Saldo disponível: {formatCurrencyBRL(selectedGoal?.currentAmount ?? 0)}</Text>
        ) : null}
        <Text style={s.label}>{isWithdrawal ? "Conta de destino" : "Conta"}</Text>
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
            <Text style={s.msg}>Crie uma conta antes de {isWithdrawal ? "retirar" : "aportar"}.</Text>
          )}
        </View>

        <FieldCard>
          <FieldRow
            label="Valor"
            accessibilityLabel="Valor da movimentação"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={amount}
            onChangeText={(value) => { setAmount(formatCurrencyInput(value)); setMovementError(null); }}
            autoFocus
          />
          <FieldDivider />
          <FieldRow
            label="Observação"
            accessibilityLabel="Observação da movimentação"
            placeholder="Opcional"
            value={note}
            onChangeText={setNote}
          />
        </FieldCard>

        {movementError ? <Text accessibilityRole="alert" style={s.movementError}>{movementError}</Text> : null}

        <View style={s.bottomSpacer} />
      </BottomSheet>

      {/* Meta atingida: continuar ou concluir */}
      <BottomSheet
        visible={reachedOpen}
        onClose={closeReachedPrompt}
        title="Meta atingida! 🎉"
        subtitle={
          continuing
            ? `Defina o novo valor e prazo de ${selectedGoal?.title ?? "Meta"}`
            : `Você chegou ao valor de ${selectedGoal?.title ?? "Meta"}. O que deseja fazer?`
        }
        maxHeightRatio={0.92}
        footer={
          continuing ? (
            <>
              <Button
                label="Voltar"
                variant="secondary"
                fullWidth
                onPress={() => setContinuing(false)}
                disabled={updateGoal.isPending}
              />
              <Button
                label="Salvar"
                fullWidth
                onPress={onContinueGoal}
                loading={updateGoal.isPending}
              />
            </>
          ) : (
            <>
              <Button
                label="Continuar"
                variant="secondary"
                fullWidth
                onPress={() => {
                  setNewTarget("");
                  const today = CalendarUtils.getCalendarDateString(new Date());
                  setNewDue(selectedGoal?.targetDate && selectedGoal.targetDate >= today ? selectedGoal.targetDate : today);
                  setContinuing(true);
                }}
                disabled={updateGoal.isPending}
              />
              <Button
                label="Concluir"
                fullWidth
                onPress={onCompleteGoal}
                loading={updateGoal.isPending}
              />
            </>
          )
        }
      >
        {continuing ? (
          <>
            <FieldCard>
              <FieldRow
                label="Novo valor alvo"
                accessibilityLabel="Novo valor alvo"
                prefix="R$"
                placeholder="0,00"
                keyboardType="numeric"
                value={newTarget}
                onChangeText={(value) => setNewTarget(formatCurrencyInput(value))}
                autoFocus
              />
            </FieldCard>

            <Text style={s.label}>Novo prazo</Text>
            <View style={s.calendar}>
              <Calendar
                current={newDue}
                minDate={TODAY}
                markedDates={{
                  [newDue]: {
                    selected: true,
                    selectedColor: themeColors.primaryLight,
                  },
                }}
                onDayPress={(day) => setNewDue(day.dateString)}
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
          </>
        ) : (
          <Text style={s.msg}>
            Continuar mantém a meta ativa com um novo valor e prazo. Concluir
            move a meta para a aba de concluídas.
          </Text>
        )}
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
              label="Limpar"
              variant="secondary"
              fullWidth
              onPress={() => onUpdateDeadline(null)}
              disabled={updateGoal.isPending}
            />
            <Button
              label="Salvar"
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
    actions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    disabledAction: { opacity: 0.4 },
    movementError: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
    add: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.md,
    },
    addText: {
      ...typography.body,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    notice: {
      backgroundColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.md,
    },
    noticeText: {
      ...typography.caption,
      textAlign: "center",
      fontWeight: "700",
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
