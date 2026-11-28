import { describe, expect, it } from "vitest";
import { CUT_MARK, pruned, savedTranscript, type AiTranscriptEntry } from "./useAiAssistant";
import type { AiMessage } from "./interfaces/AiMessage.interface";

describe("conversations enregistrées de l'assistant", () => {
  it("gardent les réponses entières (plus de coupure à 6 000 caractères avec « … »)", () => {
    const answer = `## 4. Ce que cela implique pour la suite et les niveaux à surveiller\n${"porté par l'ouverture de Wall Street. ".repeat(400)}FIN`;
    const saved = savedTranscript([
      { id: "u", role: "user", text: "Expliquer ce mouvement de prix" },
      { id: "a", role: "assistant", text: answer },
      { id: "t", role: "tool", toolName: "lire_une_zone", text: "x".repeat(10_000) },
    ] satisfies AiTranscriptEntry[]);
    expect(saved[1]!.text).toBe(answer);
    // Le détail d'une étape reste borné, et la coupure est marquée.
    expect(saved[2]!.text.endsWith(CUT_MARK)).toBe(true);
  });

  it("bornent l'historique relu par le modèle (40 messages, commençant par une question)", () => {
    const history: AiMessage[] = [];
    for (let i = 0; i < 60; i++) history.push({ role: i % 2 ? "assistant" : "user", content: [{ type: "text", text: `m${i}` }] });
    const kept = pruned(history);
    expect(kept.length).toBeLessThanOrEqual(40);
    expect(kept[0]!.role).toBe("user");
  });
});
