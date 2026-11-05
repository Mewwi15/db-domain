export type ChangeEvent = { id: number; type: string; time: string; schema: string; table: string };
export type EventState = {
  events: ChangeEvent[];
  eventCount: number;
  revisions: Record<string, number>;
  schemaRevisions: Record<string, number>;
};

export function appendDatabaseEvent(state: EventState, event: Omit<ChangeEvent, "id">): EventState {
  const id = state.eventCount + 1;
  const key = JSON.stringify([event.schema, event.table]);
  return {
    events: [{ ...event, id }, ...state.events].slice(0, 50),
    eventCount: id,
    revisions: { ...state.revisions, [key]: (state.revisions[key] ?? 0) + 1 },
    schemaRevisions: { ...state.schemaRevisions, [event.schema]: (state.schemaRevisions[event.schema] ?? 0) + 1 },
  };
}
