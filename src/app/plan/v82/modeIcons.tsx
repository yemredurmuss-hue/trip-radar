// The kinds of travel as MingCute's filled icons (MingCute Icon, Apache-2.0, mingcute.com; onay paketi 2026-10-22: "daha büyük,
// daha net"), drawn here so nothing is fetched: dark on a soft grey tile; the colour stays for the step a row stands on.
const BODIES = {
  plane: "<path fill=\"currentColor\" d=\"M19.71 2.838c.733.147 1.306.72 1.453 1.453a3.56 3.56 0 0 1-.773 2.995l-2.751 3.252l1.944 7.131a1.25 1.25 0 0 1-.322 1.213l-1.302 1.302a1.01 1.01 0 0 1-1.597-.224l-2.993-5.387l-3.258 2.255v.787c0 .332-.132.65-.366.884l-1.683 1.683a1.01 1.01 0 0 1-1.673-.395l-.544-1.631l-1.631-.544a1.01 1.01 0 0 1-.395-1.673l1.683-1.683a1.25 1.25 0 0 1 .884-.366h.787l2.255-3.258L4.041 7.64a1.01 1.01 0 0 1-.224-1.597L5.119 4.74a1.25 1.25 0 0 1 1.213-.322l7.13 1.944l3.253-2.752a3.56 3.56 0 0 1 2.995-.772\"/>",
  hotel: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1h1a1 1 0 1 1 0 2v11a1 1 0 1 1 0 2h-6.5v-4.5a1.5 1.5 0 0 0-3 0V21H4a1 1 0 1 1 0-2V8a1 1 0 0 1 0-2h1zm2 1h10V5H7zm1 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1m1 5a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm3-5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1m5 1a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm-1 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1\" clip-rule=\"evenodd\"/>",
  train: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M1 7c0-1.101.89-2 1.998-2H12c3.224 0 5.942 1.075 7.868 2.589C21.759 9.075 23 11.085 23 13c0 .842-.258 1.56-.713 2.14c-.443.566-1.034.95-1.636 1.214c-1.186.518-2.597.646-3.651.646H2.994A1.995 1.995 0 0 1 1 15zm2 3h4V7H3zm10 0H9V7h3q.51 0 1 .04zm2 0h4.551a8 8 0 0 0-.919-.839c-.962-.756-2.19-1.395-3.632-1.778z\" clip-rule=\"evenodd\"/><path fill=\"currentColor\" d=\"M1 19a1 1 0 0 1 1-1h19a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1\"/>",
  ship: "<path fill=\"currentColor\" d=\"M14.212 17.776a4 4 0 0 1 3.577 0l2.658 1.33a1 1 0 0 1-.895 1.788l-2.658-1.329a2 2 0 0 0-1.789 0l-1.316.659a4 4 0 0 1-3.577 0l-1.318-.659a2 2 0 0 0-1.789 0l-2.658 1.33a1 1 0 0 1-.895-1.79l2.66-1.329a4 4 0 0 1 3.577 0l1.316.659a2 2 0 0 0 1.79 0zM13 2a1 1 0 0 1 1 1v1.32l3.329.554a2 2 0 0 1 1.67 1.973v3.432l2.06.687a1.25 1.25 0 0 1 .753 1.678l-2.169 5.06l-1.854-.928a4 4 0 0 0-3.577 0l-1.318.659a2 2 0 0 1-1.789 0l-1.316-.659a4 4 0 0 0-3.577 0l-1.27.635l-2.66-4.65a1.25 1.25 0 0 1 .691-1.806L5 10.28V6.847a2 2 0 0 1 1.672-1.973L10 4.319V3a1 1 0 0 1 1-1zM7 6.847v2.765l4.368-1.456a2 2 0 0 1 1.265 0L17 9.612V6.847l-5-.833z\"/>",
  bus: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M11.022 3H18a3 3 0 0 1 3 3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7a2 2 0 0 1-1 1.733v.767a1.5 1.5 0 0 1-3 0V19H7v.5a1.5 1.5 0 0 1-3 0v-.767A2 2 0 0 1 3 17v-7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1a3 3 0 0 1 3-3zm.596 2h2.764l-1.276 2.553a1 1 0 1 0 1.788.894L16.618 5H18a1 1 0 0 1 1 1v5H5V6a1 1 0 0 1 1-1h3.382L8.106 7.553a1 1 0 0 0 1.788.894zM6 15a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H7a1 1 0 0 1-1-1m9 0a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2h-1a1 1 0 0 1-1-1\" clip-rule=\"evenodd\"/>",
  taxi: "<path fill=\"currentColor\" d=\"M15.764 4a3 3 0 0 1 2.683 1.658l1.385 2.77q.367-.15.72-.323a1 1 0 0 1 .895 1.79q-.361.16-.726.311l.963 1.925A3 3 0 0 1 22 13.47V16a3 3 0 0 1-1 2.236V19.5a1.5 1.5 0 0 1-3 0V19H6v.5a1.5 1.5 0 0 1-3 0v-1.264A3 3 0 0 1 2 16v-2.528a3 3 0 0 1 .316-1.341l.955-1.91q-.363-.153-.715-.325a1.01 1.01 0 0 1-.45-1.343a1 1 0 0 1 1.341-.448q.355.173.72.324l1.386-2.77A3 3 0 0 1 8.236 4zM7.5 13a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3M8.236 6a1 1 0 0 0-.894.553L6.072 9.09C7.62 9.555 9.705 10 12 10s4.38-.445 5.928-.91l-1.27-2.537A1 1 0 0 0 15.764 6z\"/>",
  van: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M4 5a3 3 0 0 0-3 3v8a2 2 0 0 0 2 2h.17a3.001 3.001 0 0 0 5.66 0h6.34a3.001 3.001 0 0 0 5.66 0H21a2 2 0 0 0 2-2V9.606a3 3 0 0 0-.504-1.665l-1.07-1.605A3 3 0 0 0 18.93 5zM3 8a1 1 0 0 1 1-1h2v3H3zm8-1H8v3h3zm2 3h3V7h-3zm8 1V9.606a1 1 0 0 0-.168-.555l-1.07-1.606A1 1 0 0 0 18.93 7H18v4zm-3 5a1 1 0 1 1 0 2a1 1 0 0 1 0-2M7 17a1 1 0 1 0-2 0a1 1 0 0 0 2 0\" clip-rule=\"evenodd\"/>",
  scooter: "<path fill=\"currentColor\" d=\"M6 16a3 3 0 1 1 0 6a3 3 0 0 1 0-6m13 0a3 3 0 1 1 0 6a3 3 0 0 1 0-6M18 2a1 1 0 0 1 0 2h-.69l2.655 9.737A1 1 0 0 1 19 15h-.764c-.991 0-1.898.56-2.341 1.447A1 1 0 0 1 15 17h-4.172a3 3 0 0 1-2.121-.879l-.535-.535A2 2 0 0 0 6.758 15H5a1 1 0 1 1 0-2h1.758a4 4 0 0 1 2.828 1.172l.535.535a1 1 0 0 0 .707.293h3.604a4.62 4.62 0 0 1 3.267-1.967L15.236 4H14a1 1 0 1 1 0-2z\"/>",
  car: "<path fill=\"currentColor\" d=\"M15.839 4a3 3 0 0 1 2.605 1.512l1.714 3l.28.488H21.6c.22 0 .4.18.4.4v.475a.8.8 0 0 1-.606.776l-.024.006a5 5 0 0 1 .457 2.79l-.725 5.801A2 2 0 0 1 19.117 21H19a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2h-.117a2 2 0 0 1-1.985-1.752l-.725-5.8a5 5 0 0 1 .457-2.79l-.024-.007A.8.8 0 0 1 2 9.875V9.4c0-.22.18-.4.4-.4h1.163l.279-.488l1.714-3A3 3 0 0 1 8.16 4zM5.737 13.898a.5.5 0 0 0-.737.44v.701a1 1 0 0 0 .96 1l2.314.092c.424.017.58-.55.206-.752zm13.263.44a.5.5 0 0 0-.737-.44l-2.744 1.48c-.372.202-.217.77.207.753l2.314-.093a1 1 0 0 0 .96-.999zM8.161 6a1 1 0 0 0-.869.504l-1.714 3A1 1 0 0 0 6.446 11h11.108a1 1 0 0 0 .868-1.496l-1.714-3a1 1 0 0 0-.87-.504z\"/>",
  bike: "<path fill=\"currentColor\" d=\"M10 5a1 1 0 0 1 1-1h2.614a3 3 0 0 1 2.809 1.947l2.294 6.117a4.001 4.001 0 1 1-2.072.171L16.182 11L9.21 13.614A4 4 0 1 1 6 12h.022l-1.111-2H4a1 1 0 0 1 0-2h4a1 1 0 0 1 0 2h-.8l1.026 1.847l7.254-2.72l-.93-2.478A1 1 0 0 0 13.614 6H11a1 1 0 0 1-1-1\"/>",
  walk: "<path fill=\"currentColor\" d=\"M12 2a3 3 0 0 0-2.15 5.092L7.088 9.065a2 2 0 0 0-.553.599l-1.393 2.322a1 1 0 1 0 1.715 1.028l1.393-2.321l.323-.23l-.513 2.052a2 2 0 0 0 1.033 2.268l3.01 2.752l.908 3.632a1.1 1.1 0 0 0 1.067.833H15a1 1 0 0 0 0-2h-.22l-.737-2.95a2 2 0 0 0-.59-.991l-1.929-1.763c.194-.228.339-.502.416-.811l.66-2.638l1.018 1.164c.17.195.378.355.61.471l1.825.912a1 1 0 0 0 .894-1.789l-1.824-.912l-2.428-2.774A3.001 3.001 0 0 0 12 2\"/><path fill=\"currentColor\" d=\"M9.316 15.551a1 1 0 0 1 .633 1.265l-.426 1.276a2 2 0 0 1-.483.782l-1.657 1.657a1 1 0 0 1-1.59 1.176l-.493-.493a1.01 1.01 0 0 1 0-1.428l2.326-2.326l.425-1.276a1 1 0 0 1 1.265-.633\"/>",
  doc: "<path fill=\"currentColor\" d=\"M12 8.5a1.5 1.5 0 0 0 1.5 1.5H20v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6zm0 3.38a1 1 0 0 0-.707.293l-2.121 2.12a1 1 0 0 0 1.414 1.415l.414-.414V18a1 1 0 0 0 2 0v-2.706l.414.414a1.001 1.001 0 0 0 1.415-1.414l-2.122-2.121A1 1 0 0 0 12 11.88m2-9.836a2 2 0 0 1 1 .542L19.414 7a2 2 0 0 1 .541 1H14z\"/>",
  pin: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M7 7a5 5 0 1 1 6 4.9V17a1 1 0 1 1-2 0v-5.1A5 5 0 0 1 7 7m2.489 9.1a1 1 0 0 1-.838 1.14c-1.278.195-2.293.489-2.96.815c-.335.164-.534.314-.637.422l-.021.024c.033.038.09.095.19.168c.28.207.749.435 1.418.644C7.968 19.728 9.863 20 12 20s4.032-.272 5.359-.687c.67-.209 1.138-.437 1.418-.644c.1-.073.157-.13.19-.168l-.021-.024c-.103-.108-.302-.258-.637-.422c-.667-.326-1.682-.62-2.96-.815a1 1 0 0 1 .301-1.977c1.388.211 2.622.547 3.539.996c.457.224.884.5 1.208.842c.33.347.603.82.603 1.4c0 .81-.524 1.4-1.034 1.776c-.53.392-1.233.702-2.01.945c-1.57.49-3.674.778-5.956.778s-4.387-.288-5.955-.778c-.778-.243-1.48-.553-2.01-.945C3.524 19.902 3 19.313 3 18.5c0-.579.273-1.052.603-1.4c.325-.342.751-.617 1.208-.84c.917-.45 2.152-.786 3.538-.997a1 1 0 0 1 1.14.838\" clip-rule=\"evenodd\"/>",
  ticket: "<path fill=\"currentColor\" d=\"M13 4a1 1 0 0 1 .995.897l.01.206a1 1 0 0 0 1.99 0l.01-.206A1 1 0 0 1 17 4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2a1 1 0 0 1-.995-.898l-.01-.204a1 1 0 0 0-1.99 0l-.01.204A1 1 0 0 1 13 20H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm2 9a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0v-1a1 1 0 0 0-1-1m0-5a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1\"/>",
} as const;

export type ModeIconName = keyof typeof BODIES;

export function ModeIcon({ name, size = 26 }: { name: ModeIconName; size?: number }) {
  return <svg className="q-mi" width={size} height={size} viewBox="0 0 24 24" aria-hidden dangerouslySetInnerHTML={{ __html: BODIES[name] }} />;
}

/** A kind's (or its ticket's mode's) icon: a plane, a bed's building, a train from the side, a taxi from the front. */
export function modeIconOf(kind: string | null, mode: string | null = null): ModeIconName {
  switch (mode ?? kind) {
    case "flight":
      return "plane";
    case "stay":
      return "hotel";
    case "train":
    case "metro":
      return "train";
    case "walk":
      return "walk";
    case "ferry":
      return "ship";
    case "bus":
      return "bus";
    case "minibus":
    case "rv":
      return "van";
    case "car":
      return "car";
    case "moto":
      return "scooter";
    case "bike":
      return "bike";
    case "pass":
      return "ticket";
    default:
      return mode && mode !== kind ? modeIconOf(kind) : "taxi";
  }
}

export type Stage = "options" | "planned" | "bought" | "ticket";

/**
 * The four steps' mark (onay paketi 2026-10-22, "planlamanın dört adımı"): a dashed ring (options), a ring with its dot
 * (planned), a ring with its tick (bought), a filled tick (its ticket in hand). The shape says it as much as the colour.
 */
export function StageGlyph({ stage, size = 18 }: { stage: Stage; size?: number }) {
  const tick = (c: string) => <path d="M6.4 10.3l2.4 2.4 4.8-5" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <svg className={`q-sg ${stage}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      {stage === "options" && <circle cx="10" cy="10" r="7.6" fill="#fff" stroke="var(--q-sg-opt)" strokeWidth="2" strokeDasharray="3 2.4" />}
      {stage === "planned" && (
        <>
          <circle cx="10" cy="10" r="7.6" fill="#fff" stroke="var(--q-acc)" strokeWidth="2" />
          <circle cx="10" cy="10" r="3.3" fill="var(--q-acc)" />
        </>
      )}
      {stage === "bought" && (
        <>
          <circle cx="10" cy="10" r="7.6" fill="#fff" stroke="var(--q-ok)" strokeWidth="2" />
          {tick("var(--q-ok)")}
        </>
      )}
      {stage === "ticket" && (
        <>
          <circle cx="10" cy="10" r="9.2" fill="var(--q-ok)" />
          {tick("#fff")}
        </>
      )}
    </svg>
  );
}

/** The mark on a row's picture's corner. */
export const StageBadge = ({ stage }: { stage: Stage }) => (
  <span className="q-sb" aria-hidden>
    <StageGlyph stage={stage} size={19} />
  </span>
);
