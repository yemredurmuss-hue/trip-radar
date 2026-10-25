// One Hazırlık chore (v82 T3 a, the prototype's .q-pr1): the tick, the title with its note and where it came from
// ("uçuş kartından"), its day on the right (orange when near, "geçti" once gone by), a shop or the official page, "Hazır" once done ("Yapıldı ·
// 12 Eki" on hover), and for a stored chore the row's ⋯ (C29: rename, move to Yapılacak şeyler); × takes it off with "Geri al".
import { L } from "../../../lib/i18n";
import { setDone, setPrep, shortDay } from "../../../lib/ideas";
import { prepDayText, prepDayTone, prepFromText, prepHiddenKey, type PrepTask } from "../../../lib/prepDays";
import { shopLabel, shopLinks, type Provider } from "../../../lib/providers";
import type { Trip } from "../../../lib/types";
import { setCancelDone, setHidden, setInstalled, setVisaDone, updateTrip } from "../../actions";
import { CardMenu, type MenuEntry } from "../../cards/CardShell";
import { Editable, InlineEdit, useInlineEdit } from "../../cards/InlineEdit";
import { NAME_IN_PLACE } from "../../../lib/inlineEdit";
import { useCardEnv } from "../../cards/PlanCard";
import { PrepIcon } from "./PrepIcons";

/** A shop's mark as the prototype draws it (Amazon, Trendyol, Hepsiburada), else the register's letter on its colour. */
export function ShopLink({ provider, url }: { provider: Provider; url: string }) {
  const own = { amazon: ["amz", "q-amz", "a"], trendyol: ["ty", "q-ty", "t"], hepsiburada: ["hb", "q-hb", "h"] } as const;
  const mark = provider.id in own ? own[provider.id as keyof typeof own] : null;
  return (
    <a className={`q-buy1${mark ? ` ${mark[0]}` : ""}`} href={url} target="_blank" rel="noreferrer" data-shop={provider.id}>
      {mark ? (
        <span className={mark[1]} aria-hidden>
          {mark[2]}
        </span>
      ) : (
        <span className="q-logo" aria-hidden style={{ background: provider.logo.color }}>
          {provider.logo.letter}
        </span>
      )}
      {shopLabel(provider)}
    </a>
  );
}

/** Ticks a chore as what it is: its record, the eSIM's "Kurdum", or a mark on the trip (the visa: with "Vize alındı"). */
export async function tickTask(trip: Trip, task: PrepTask, done: boolean): Promise<void> {
  if (task.tick === "record" && task.item) return void (await setDone(task.item, done));
  if (task.tick === "installed" && task.of) return setInstalled(task.of, done);
  // P3 (F30): the switched booking cancelled on its site ("İptal ettim").
  if (task.tick === "cancel" && task.of) return setCancelDone(task.of, done);
  // The visa: one mark with Belgeler's "Var"/"Yok".
  if (task.tick === "visa") return setVisaDone(trip.id, done, task.key, task.key === "visa:schengen");
  await updateTrip(trip.id, (t) => {
    const { [task.key]: _was, ...rest } = t.prepDone ?? {};
    return { ...t, prepDone: done ? { ...rest, [task.key]: Date.now() } : rest };
  });
}

export function PrepRow({ task, trip, today, shopHome, domId }: { task: PrepTask; trip: Trip; today: string; shopHome: string | null; domId?: string }) {
  const row = <PrepRowFace task={task} trip={trip} today={today} shopHome={shopHome} domId={domId} />;
  return task.item ? (
    <InlineEdit item={task.item} only={["name"]}>
      {row}
    </InlineEdit>
  ) : (
    row
  );
}

function PrepRowFace({ task, trip, today, shopHome, domId }: { task: PrepTask; trip: Trip; today: string; shopHome: string | null; domId?: string }) {
  const env = useCardEnv();
  const edit = useInlineEdit();
  const { done, item } = task;
  const shop = !done && item ? (shopLinks(item.name, shopHome)[0] ?? null) : null;
  // "Yapıldı · 12 Eki" on "Hazır" (the chore's own tick, a worked-out one's mark).
  const doneOn = task.doneAt != null ? shortDay(new Date(task.doneAt).toISOString().slice(0, 10)) : null;
  const doneTip = doneOn ? L(`Yapıldı · ${doneOn}`, `Done · ${doneOn}`) : null;
  // Its day: orange when near, "geçti" once gone by (row 144).
  const tone = prepDayTone(task, today);
  const menu: MenuEntry[] = item
    ? [
        // 0.39.0: "Adını değiştir" isn't drawn (NAME_IN_PLACE; Emre: the chat corrects it).
        ...(NAME_IN_PLACE ? [{ label: L("Adını değiştir", "Rename"), run: () => edit?.go("name") }] : []),
        // Not a chore after all ("şemsiye al" to buy there): Yapılacak şeyler (C29).
        { label: L("Yapılacak şeyler'e taşı", "Move to Things to do"), run: () => void setPrep(item, false) },
      ]
    : [];
  const remove = () => {
    if (item) return env.remove(item);
    const key = prepHiddenKey(task.key);
    void setHidden(trip.id, key, true, task.title).then(() => env.offer({ kind: "hidden", tripId: trip.id, key, label: task.title }));
  };
  return (
    <li id={domId} className={`q-pr1${done ? " done" : ""}`} aria-label={task.title} data-task={task.key} data-item-id={item?.id} data-day={task.day ? prepDayText(task.day) : undefined}>
      <button type="button" className="q-ck" role="checkbox" aria-checked={done}
        aria-label={task.title}
        onClick={() => void tickTask(trip, task, !done)}>
        {done && <PrepIcon name="check" size={11} stroke={3.2} />}
      </button>
      <span className="q-pt1">
        <b>{item && edit?.open === "name" ? <Editable field="name">{item.name}</Editable> : task.title}</b>
        {(task.sub || task.from) && (
          <small>
            {task.sub}
            {task.from && (
              <>
                {task.sub && " "}
                <i className="q-ptag">{prepFromText(task.from)}</i>
              </>
            )}
          </small>
        )}
      </span>
      {task.day && (
        <span className={`q-pday${tone ? ` ${tone}` : ""}`}>
          {prepDayText(task.day)}
          {tone === "past" && ` · ${L("geçti", "passed")}`}
        </span>
      )}
      {shop ? (
        <ShopLink provider={shop.provider} url={shop.url} />
      ) : task.official && !done ? (
        <a className="q-buy1" href={task.official} target="_blank" rel="noreferrer">
          {task.tick === "cancel" ? L("Sitesinde iptal et ↗", "Cancel on its site ↗") : L("Resmî site ↗", "Official site ↗")}
        </a>
      ) : null}
      {done && (
        <span className="q-pdone" title={doneTip ?? undefined}>
          {L("Hazır", "Ready")}
        </span>
      )}
      <CardMenu entries={menu} />
      <button type="button" className="q-ib q-pdel" aria-label={L(`${task.title}: sil`, `${task.title}: delete`)} title={L("Sil", "Delete")} onClick={remove}>
        <PrepIcon name="x" size={14} stroke={2.4} />
      </button>
    </li>
  );
}
