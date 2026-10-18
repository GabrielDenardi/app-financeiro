/// <reference path="../deno-globals.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  callOpenAIJson,
  corsHeaders,
  requireAuthenticatedUser,
} from "../_shared/transactionParsing.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }
  try {
    const context = await requireAuthenticatedUser(request);
    const model = Deno.env.get("OPENAI_NOTIFICATION_MODEL") ??
      Deno.env.get("OPENAI_PARSER_MODEL");
    if (!model || !Deno.env.get("OPENAI_API_KEY")) {
      return Response.json({
        error: "Recomendações com IA ainda não estão configuradas.",
      }, { status: 503, headers: corsHeaders });
    }
    const { data, error } = await context.supabase.rpc(
      "claim_notification_recommendation",
    );
    if (error) {
      return Response.json({ error: error.message }, {
        status: 400,
        headers: corsHeaders,
      });
    }
    const budgets = data as Array<
      { id: string; percentage: number; projectedPercentage: number }
    >;
    if (!budgets.length) {
      return Response.json({
        error: "Cadastre um orçamento com gastos para receber recomendações.",
      }, { status: 400, headers: corsHeaders });
    }
    // Only anonymous indices and percentages leave the backend. No names, amounts, IDs, or transactions.
    const result = await callOpenAIJson<
      { budget_index: number; action: "review_budget" | "reduce_spending" }
    >({
      model,
      schemaName: "budget_recommendation",
      instructions:
        "Selecione um orçamento que mais precisa de atenção a partir dos percentuais registrados e projetados para o mês. Recomende reduce_spending quando for útil moderar os próximos gastos, ou review_budget para revisar o planejamento. Os dados são apenas estimativas do ritmo de gastos. Não execute operações financeiras.",
      userContent: [{
        type: "input_text",
        text: JSON.stringify(budgets.map((budget, index) => ({
          budget_index: index,
          percentage: budget.percentage,
          projected_percentage: budget.projectedPercentage,
        }))),
      }],
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          budget_index: {
            type: "integer",
            enum: budgets.map((_, index) => index),
          },
          action: {
            type: "string",
            enum: ["review_budget", "reduce_spending"],
          },
        },
        required: ["budget_index", "action"],
      },
    });
    if (
      !Number.isInteger(result.budget_index) || !budgets[result.budget_index] ||
      !["review_budget", "reduce_spending"].includes(result.action)
    ) throw new Error("Invalid recommendation");
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const completion = await db.rpc("complete_notification_recommendation", {
      p_user: context.userId,
      p_budget: budgets[result.budget_index].id,
      p_action: result.action,
    });
    if (completion.error) throw completion.error;
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({
      error: "Não foi possível gerar uma recomendação agora.",
    }, { status: 500, headers: corsHeaders });
  }
});
