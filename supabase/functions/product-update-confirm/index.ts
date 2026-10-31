/// <reference path="../deno-globals.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleConfirm, readProductUpdateConfig } from '../_shared/productUpdateSubscriptions.ts';

const config = readProductUpdateConfig((key) => Deno.env.get(key));
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((request) => handleConfirm(request, { db, config }));
