const o=require(process.argv[2]);
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
for (const [k,v] of Object.entries(o)) {
  if (only && !only.test(k)) continue;
  const m = v.made ?? v;
  console.log("\n=== "+k);
  if (v.parsed) console.log("parsed:", JSON.stringify({where:v.parsed.where, start:v.parsed.start, duration:v.parsed.duration, who:v.parsed.who}));
  if (m.HATA||m.error) { console.log(JSON.stringify(m)); continue; }
  if (!m.live) { console.log(JSON.stringify(m, null, 0).slice(0, 3000)); continue; }
  if (m.where !== undefined) {
  console.log("where:",m.where,"| event:",m.intentEvent,"| pb:",m.playbook,"| q:",(m.pbQuestions||[]).join(","),"| intent:",JSON.stringify(m.tripIntent));
  console.log("title:",m.title,"| dates:",JSON.stringify(m.dates),"| road:",m.road,"| stayAs:",JSON.stringify(m.stayAs),"| trav:",JSON.stringify(m.travellers));
  console.log("countries:",JSON.stringify(m.countries));
  for (const i of m.items) console.log("  item:",i.cat+"/"+(i.kind??"-"),"|",i.name,"|",i.city,"|",i.d,"|",i.from??"","→",i.to??"",i.stayKind?"stayKind="+i.stayKind:"",i.noBooking?"noBooking":"","adults="+i.adults, i.note?("note="+i.note):"");
  }
  for (const [kk, vv] of Object.entries(m)) if (!["where","intentEvent","playbook","pbQuestions","tripIntent","title","dates","road","stayAs","budget","travellers","countries","items","live"].includes(kk)) console.log("  ", kk, ":", JSON.stringify(vv).slice(0, 1500));
  const L=m.live;
  console.log("  range:",JSON.stringify(L.range),"nights:",JSON.stringify(L.nights), "loose:", L.looseStays);
  console.log("  blocks:",L.stayBlocks.join(" | "));
  console.log("  legs:",L.legs.join(" | "));
  for (const s of L.sections) console.log("  SEC",s.id,"(",s.status,") prep="+s.prep,"hidden="+s.hidden,"\n     - "+s.entries.join("\n     - "));
  console.log("  rules:",L.rules.join(" | "));
  console.log("  shape:",L.shape);
}
