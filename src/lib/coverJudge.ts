// The model's look at a cover's candidates (coverPhoto.ts): one call with the traveller's own key, the photos small.
// No key or a failure throws, and the cover goes the old way.
import { COVER_JUDGE_SYSTEM, coverPickSchema, coverQuestion, type CoverJudge } from "./coverPhoto";
import { getProvider } from "./llm";

export const modelCoverJudge: CoverJudge = async (subject, photos, how) => {
  // (behind the chat and the review: a cover can wait a moment)
  const provider = await getProvider({ priority: "ahead" });
  const prompt = coverQuestion(subject, photos.length, how);
  const { best } = await provider.generateJson(COVER_JUDGE_SYSTEM, prompt, coverPickSchema, photos, { maxRetries: 0 });
  return best;
};
