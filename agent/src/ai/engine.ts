import Anthropic from "@anthropic-ai/sdk";
import { AgentContext, StrategyProposal, buildStrategyPrompt } from "./prompts";

function getMockProposal(context: AgentContext): StrategyProposal {
  const currentApy = context.current_allocation.length > 0
    ? context.current_allocation.reduce((sum, a) => sum + a.current_apy * (a.percent / 100), 0)
    : 4.2;

  return {
    should_rebalance: true,
    reason: "Tropykus USDRIF offers 9.1% vs current weighted average. Diversifying across protocols reduces risk while increasing yield.",
    new_allocation: [
      { protocol: "sovryn", asset: "DOC", percent: 40, apy: 8.7 },
      { protocol: "tropykus", asset: "USDRIF", percent: 40, apy: 9.1 },
      { protocol: "moneyonchain", asset: "DOC", percent: 20, apy: 6.2 },
    ],
    estimated_apy: 8.4,
    current_apy: parseFloat(currentApy.toFixed(2)),
    risk_level: context.user_profile.risk,
    confidence: 0.82,
  };
}

export async function analyzeAndPropose(context: AgentContext): Promise<StrategyProposal> {
  // If no API key, return mock strategy
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`[${new Date().toISOString()}] [AI Engine] No API key — returning mock strategy`);
    return getMockProposal(context);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { system, user } = buildStrategyPrompt(context);

  console.log(`[${new Date().toISOString()}] [AI Engine] Requesting strategy analysis from Claude...`);

  let attempts = 0;
  const maxAttempts = 2;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: user },
      ];

      if (attempts > 1 && lastError) {
        messages.push({
          role: "assistant",
          content: "I apologize, let me provide a valid JSON response.",
        });
        messages.push({
          role: "user",
          content: `Your previous response was not valid JSON. Error: ${lastError.message}. Please respond with ONLY valid JSON matching the required format.`,
        });
      }

      const response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
        max_tokens: 1024,
        system,
        messages,
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Clean potential markdown wrapping
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const proposal: StrategyProposal = JSON.parse(cleaned);

      // Validate required fields
      if (typeof proposal.should_rebalance !== "boolean") {
        throw new Error("Missing should_rebalance field");
      }
      if (!Array.isArray(proposal.new_allocation)) {
        throw new Error("Missing new_allocation array");
      }

      // Validate percentages sum to 100
      if (proposal.should_rebalance) {
        const totalPercent = proposal.new_allocation.reduce((sum, a) => sum + a.percent, 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          throw new Error(`Allocation percentages sum to ${totalPercent}, not 100`);
        }
      }

      console.log(`[${new Date().toISOString()}] [AI Engine] Strategy received — should_rebalance: ${proposal.should_rebalance}, estimated APY: ${proposal.estimated_apy}%`);

      return proposal;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[${new Date().toISOString()}] [AI Engine] Attempt ${attempts} failed: ${lastError.message}`);
    }
  }

  // Fallback: return a safe no-rebalance proposal with actual current APY
  console.log(`[${new Date().toISOString()}] [AI Engine] All attempts failed, returning safe fallback`);

  const actualCurrentApy = context.current_allocation.length > 0
    ? context.current_allocation.reduce((sum, a) => sum + a.current_apy * (a.percent / 100), 0)
    : 0;

  return {
    should_rebalance: false,
    reason: "AI analysis unavailable — keeping current allocation as a safety measure.",
    new_allocation: context.current_allocation.map((a) => ({
      protocol: a.protocol,
      asset: a.asset,
      percent: a.percent,
      apy: a.current_apy,
    })),
    estimated_apy: parseFloat(actualCurrentApy.toFixed(2)),
    current_apy: parseFloat(actualCurrentApy.toFixed(2)),
    risk_level: context.user_profile.risk,
    confidence: 0,
  };
}
