-- Security settings and password changes are observed at their persisted source.
create function public.notify_security_preferences() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.biometric_enabled is distinct from old.biometric_enabled then
    perform public.emit_notification(new.user_id, 'biometric:' || gen_random_uuid(), 'security', 'Proteção do aplicativo alterada',
      case when new.biometric_enabled then 'O bloqueio biométrico foi ativado.' else 'O bloqueio biométrico foi desativado.' end,
      'security', jsonb_build_object('screen', 'Privacy'));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_security_preferences() from public, anon, authenticated;
create trigger notification_security_preferences after update on public.user_preferences
for each row execute function public.notify_security_preferences();

create function public.notify_password_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password and exists(select 1 from public.profiles where id = new.id) then
    perform public.emit_notification(new.id, 'password:' || gen_random_uuid(), 'security', 'Senha alterada',
      'A senha da sua conta foi alterada. Se você não reconhece essa alteração, confira a segurança da conta.',
      'security', jsonb_build_object('screen', 'Privacy'));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_password_change() from public, anon, authenticated;
create trigger notification_password_change after update of encrypted_password on auth.users
for each row execute function public.notify_password_change();
