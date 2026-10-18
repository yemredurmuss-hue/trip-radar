// The ticket family's fixed frame (plan v82: a flight, a train, a transfer, any other way of travel): the ticket (the
// carrier's line, the two cities with their stations and hours, the chips) | the same side column as the stay family's
// (FrameCard). Phase 3b draws it, with its options as rows (OptionRow), the connecting flight's two stubs (D7), the flight
// day's live strip (C4), Ayarlandı and Dahil (D2, D10). Until then no category sends a ticket here (CategoryPlan's
// V82_SECTIONS holds stay and other only).
import type { ReactNode } from "react";
import type { FrameCardProps } from "./FrameCard";

/** What the ticket frame takes: what the stay family's does (its forms, the side column's actions, Ayrıntı). */
export type FrameTicketProps = FrameCardProps;

export function FrameTicket(_: FrameTicketProps): ReactNode {
  return null;
}
