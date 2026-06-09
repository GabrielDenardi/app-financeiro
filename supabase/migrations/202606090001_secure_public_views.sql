alter view public.v_account_current_balance set (security_invoker = true);
alter view public.v_goal_progress set (security_invoker = true);
alter view public.v_budget_progress set (security_invoker = true);
alter view public.v_card_installment_feed set (security_invoker = true);
alter view public.v_card_invoice_summary set (security_invoker = true);
