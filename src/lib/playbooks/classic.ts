// The classic trip (a city break, a tour): today's behaviour, unchanged. Nothing opened besides the stays and the
// flights, nothing blocked, no list, no tip, no questions of its own.
import type { Playbook } from "./index";

export const classic: Playbook = {
  kind: "classic",
  skeleton: () => [],
  blocked: {},
  prep: () => [],
  tip: () => "",
  questions: [],
  tone: () => "",
};
