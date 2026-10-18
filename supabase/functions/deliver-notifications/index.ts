/// <reference path="../deno-globals.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2";

type Delivery = {
  id: string;
  notification_id: string;
  user_id: string;
  token: string;
};

// Called by a private scheduler, never by an app client.
Deno.serve(async (request) => {
  const secret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  try {
    const generation = await db.rpc("refresh_all_user_notifications");
    check(generation.error);
    const claims = await db.rpc("claim_notification_deliveries");
    check(claims.error);
    let accepted = 0;
    const deliveries = (claims.data ?? []) as Delivery[];
    for (let offset = 0; offset < deliveries.length; offset += 10) {
      const results = await Promise.allSettled(
        deliveries.slice(offset, offset + 10).map(async (delivery) => {
          const [
            { data: notification, error: notificationError },
            { data: prefs, error: prefsError },
            { data: device, error: deviceError },
          ] = await Promise.all([
            db.from("user_notifications").select("*").eq(
              "id",
              delivery.notification_id,
            ).single(),
            db.from("notification_preferences").select("*").eq(
              "user_id",
              delivery.user_id,
            ).single(),
            db.from("notification_devices").select("user_id").eq(
              "token",
              delivery.token,
            ).maybeSingle(),
          ]);
          check(notificationError);
          check(prefsError);
          check(deviceError);
          const enabled = notification && prefs && prefs.push_enabled &&
            (notification.source_type === "system" ||
              prefs[notification.source_type] === true);
          if (
            !enabled || notification.read_at ||
            device?.user_id !== delivery.user_id
          ) {
            const result = await db.from("notification_deliveries").update({
              status: "skipped",
              completed_at: new Date().toISOString(),
            }).eq("id", delivery.id);
            check(result.error);
            return;
          }
          try {
            const response = await fetch(
              "https://exp.host/--/api/v2/push/send",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(Deno.env.get("EXPO_ACCESS_TOKEN")
                    ? {
                      Authorization: `Bearer ${
                        Deno.env.get("EXPO_ACCESS_TOKEN")
                      }`,
                    }
                    : {}),
                },
                signal: AbortSignal.timeout(15_000),
                body: JSON.stringify({
                  to: delivery.token,
                  channelId: "finance",
                  title: prefs.hide_sensitive ? "nitin" : notification.title,
                  body: prefs.hide_sensitive
                    ? "Você tem uma nova notificação. Abra o app para conferir."
                    : notification.description,
                  data: { notificationId: notification.id },
                  sound: "default",
                }),
              },
            );
            if (!response.ok) throw new Error("push_response_unavailable");
            const { data: ticket } = await response.json();
            const ok = ticket?.status === "ok" && typeof ticket.id === "string";
            const result = await db.from("notification_deliveries").update({
              status: ok ? "accepted" : "failed",
              ticket_id: ok ? ticket.id : null,
              error_code: ok
                ? null
                : (ticket?.details?.error ?? "push_rejected"),
              completed_at: ok ? null : new Date().toISOString(),
            }).eq("id", delivery.id);
            check(result.error);
            if (ok) accepted++;
            if (ticket?.details?.error === "DeviceNotRegistered") {
              check(
                (await db.from("notification_devices").delete().eq(
                  "token",
                  delivery.token,
                ).eq("user_id", delivery.user_id)).error,
              );
            }
          } catch {
            check(
              (await db.from("notification_deliveries").update({
                status: "unknown",
                error_code: "push_outcome_unknown",
              }).eq("id", delivery.id)).error,
            );
          }
        }),
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("Delivery processing failed");
      }
    }
    const receipts = await db.from("notification_deliveries").select(
      "id,ticket_id,token,user_id,attempted_at",
    )
      .eq("status", "accepted").order("attempted_at", { ascending: true })
      .limit(100);
    check(receipts.error);
    if (receipts.data?.length) {
      const response = await fetch(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(Deno.env.get("EXPO_ACCESS_TOKEN")
              ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
              : {}),
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({ ids: receipts.data.map((r) => r.ticket_id) }),
        },
      );
      if (!response.ok) throw new Error("Receipts unavailable");
      const { data } = await response.json();
      for (const receipt of receipts.data) {
        const result = data?.[receipt.ticket_id];
        if (!result) {
          if (
            Date.now() - new Date(receipt.attempted_at).getTime() >
              24 * 60 * 60_000
          ) {
            check(
              (await db.from("notification_deliveries").update({
                status: "unknown",
                error_code: "receipt_expired",
              }).eq("id", receipt.id)).error,
            );
          }
          continue;
        }
        check(
          (await db.from("notification_deliveries").update({
            status: result.status === "ok" ? "delivered" : "failed",
            error_code: result.details?.error ?? null,
            completed_at: new Date().toISOString(),
          }).eq("id", receipt.id)).error,
        );
        if (result.details?.error === "DeviceNotRegistered") {
          check(
            (await db.from("notification_devices").delete().eq(
              "token",
              receipt.token,
            ).eq("user_id", receipt.user_id)).error,
          );
        }
      }
    }
    return Response.json({ accepted });
  } catch {
    return Response.json({ error: "Falha no processamento de notificações." }, {
      status: 500,
    });
  }
});
