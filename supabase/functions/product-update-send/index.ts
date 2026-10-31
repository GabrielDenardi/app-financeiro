/// <reference path="../deno-globals.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  createResendSender,
  handleSend,
  readProductUpdateConfig,
} from '../_shared/productUpdateSubscriptions.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const config = readProductUpdateConfig((key) => Deno.env.get(key));
const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sendEmail = createResendSender(config);
const createUserClient = (authorization: string) =>
  createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

Deno.serve((request) => handleSend(request, { db, config, sendEmail, createUserClient }));
