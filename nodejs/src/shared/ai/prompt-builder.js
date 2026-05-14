export function buildGroundedAssistantMessages({ question, grounding }) {
  const factsText = grounding.facts.length > 0
    ? grounding.facts.map((f, i) => `[Fact ${i + 1}] ${JSON.stringify(f)}`).join("\n")
    : "No specific data facts were retrieved for this query.";

  const notesText = grounding.notes.length > 0
    ? grounding.notes.map((n) => `- ${n}`).join("\n")
    : "No internal retrieval notes available.";

  return [
    {
      role: "system",
      content: `You are the JRSPC Trading Assistant. Answer questions based on the provided data.
Keep responses professional, concise, and accurate.

RETRIEVED DATA CONTEXT:
${factsText}

INTERNAL NOTES:
${notesText}

DRAFT DETERMINISTIC ANSWER:
${grounding.draftAnswer || "None"}

If the retrieved data is insufficient, state that you don't have enough information.`
    },
    {
      role: "user",
      content: question
    }
  ];
}
