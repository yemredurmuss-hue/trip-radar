// Hazırlık open (v82 geçişi aşama 7; tasarım notu "v83 ek · Hazırlık", the prototype's z83_prep.py): "Bilmen gerekenler"
// first (T8 b), then "2/6 hazır · güne göre sıralı" with "Hazırları gizle" and "Daha fazla öner", the chores by their day
// (T3 a: the stored ones and the ones worked out from the trip, lib/prepDays.ts), and at the end the folded Bavul (T6 a,
// lib/prepPack.ts). Everything is read from the board (the plan's EmptyEnv and CardEnv, and chrome.storage.local), so
// the category's shell only passes its entries.
import { useMemo, useState } from "react";
import { catDomKey, recordOf, type CatEntry } from "../../lib/categories";
import type { CityWeather } from "../../lib/climate";
import { L } from "../../lib/i18n";
import { packLooking } from "../../lib/looking";
import { tripPlaybook } from "../../lib/playbooks";
import { countryName, knowRows, knowSub } from "../../lib/prepKnow";
import { bagFact, drivesOnTrip, kindWord, packSub, packView, rulesAsk, rulesPack, stayCities, tripDays } from "../../lib/prepPack";
import { entryDomId } from "../../lib/progress";
import { useEmptyEnv } from "../cards/emptyEnv";
import { useCardEnv } from "../cards/PlanCard";
import { Bavul } from "./prep/Bavul";
import { KnowCard } from "./prep/KnowCard";
import { PrepIcon } from "./prep/PrepIcons";
import { PrepRow } from "./prep/PrepRow";
import { packInputOf, usePackAi } from "./prep/usePackAi";
import { usePrep } from "./prep/usePrep";
import { useLooking } from "./v82/Searching";

export function PrepList({ entries }: { entries: CatEntry[] }) {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const model = usePrep(entries);
  const { trip, items, tasks, summary, range, countries, facts, mine } = model;
  const [hideDone, setHideDone] = useState(false);
  const domIds = useMemo(() => new Map(entries.map((e) => [recordOf(e)?.id, entryDomId(catDomKey(e))])), [entries]);

  // The Bavul: the AI's list once made, else the trip's own.
  const cities = useMemo(() => stayCities(items), [items]);
  const weather = cities.map((c) => env.weather?.(c) ?? null).filter((w): w is CityWeather => w != null);
  const kind = kindWord(trip.intent);
  const list = trip.packing?.list ?? null;
  const main = facts.country;
  const bag = bagFact(items);
  const groups =
    list?.groups ??
    rulesPack({
      weather,
      range,
      kind: kind ? { title: kind, lines: tripPlaybook(trip).prep() } : null,
      country: main,
      countryName: main ? countryName(main) : null,
      home: model.passport,
      plug: model.plug,
      visa: facts.visa,
      money: model.money && !model.money.own ? model.money.name : null,
      driving: drivesOnTrip(items),
    });
  const view = packView({
    groups,
    ask: list ? list.ask : rulesAsk(range),
    answers: trip.packing?.answers ?? {},
    ready: trip.packing?.ready ?? [],
    records: model.packs,
    recordsTitle: kind ?? L("Eklediklerin", "Added by you"),
    never: mine.never,
    always: mine.always,
  });
  const month = range ? new Date(`${range.start}T12:00:00Z`).toLocaleDateString(L("tr-TR", "en-GB"), { month: "long", timeZone: "UTC" }) : null;
  const sub = packSub({
    name: model.name,
    month: month ? month.charAt(0).toLocaleUpperCase(L("tr-TR", "en-GB")) + month.slice(1) : null,
    weather: weather.length > 0,
    days: tripDays(range),
    kind: kind?.toLocaleLowerCase(L("tr-TR", "en-GB")) ?? null,
    places: list != null,
  });
  const pack = packInputOf(model, weather, travellers);
  usePackAi(trip, pack.input, pack.ready);


  const packing = useLooking(packLooking, trip.id) && list == null;
  const know = knowRows({ countries, passport: model.passport, money: model.money, plug: model.plug, tips: list?.tips ?? [] });
  const shown = hideDone ? tasks.filter((t) => !t.done) : tasks;
  return (
    <div className="q-pbody" aria-label={L("Hazırlık", "Prep")}>
      <KnowCard rows={know} sub={knowSub(countries.slice(0, 3))} />
      <div className="q-ph1">
        {tasks.length > 0 && <span className="q-pc2">{L(`${summary.done}/${summary.total} hazır`, `${summary.done}/${summary.total} ready`)}</span>}
        {tasks.some((t) => t.day) && <small>{L("güne göre sıralı", "by day")}</small>}
        <span className="q-sp" />
        {summary.done > 0 && (
          <button type="button" className="q-phide" aria-pressed={hideDone} onClick={() => setHideDone(!hideDone)}>
            {hideDone ? L("Hazırları göster", "Show the ready ones") : L("Hazırları gizle", "Hide the ready ones")}
          </button>
        )}
        {env.ask && (
          <button type="button" className="q-ai sm" onClick={() => env.ask!(L("Bu gezi için hazırlık listesine eklenecek birkaç şey daha öner (alınacaklar, yapılacak başvurular, yanına alınacaklar).", "Suggest a few more things for this trip's prep list (things to buy, to apply for, to pack)."))}>
            <PrepIcon name="spark" size={14} />
            {L("Daha fazla öner", "Suggest more")}
          </button>
        )}
      </div>
      <ul className="q-prows">
        {shown.map((t) => (
          <PrepRow key={t.key} task={t} trip={trip} today={model.today} shopHome={model.shopHome} domId={t.item ? domIds.get(t.item.id) : undefined} />
        ))}
        <Bavul view={view} sub={sub} bag={bag} model={model} looking={packing} />
      </ul>
    </div>
  );
}
