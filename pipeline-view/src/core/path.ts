import { FieldType } from '../types';
import type {
  CellValue,
  FieldMeta,
  HistoryEntry,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  SelectOption,
  TransitionKind,
} from '../types';
import { ancestors, descendants, dominators, topoOrder } from './graph';

/*
 * The "Steps passed" field (config.pathFieldId): a MultiSelect whose selected options are the
 * steps a record went through. Options are matched to nodes by NAME (trimmed, Unicode NFC), so
 * the field can be created by hand in Lark and options can be ticked by hand for old records.
 * Options that match no node belong to the user and are never removed by the plugin.
 */

/** Key that matches a path option with a node: the name trimmed and in Unicode NFC. */
export function pathKey(name: string): string {
  return (typeof name === 'string' ? name : String(name ?? '')).trim().normalize('NFC');
}

/** The configured path field when it still exists as a MultiSelect, else undefined. */
export function getPathField(config: PipelineConfig, fieldById: Map<string, FieldMeta>): FieldMeta | undefined {
  const field = config.pathFieldId ? fieldById.get(config.pathFieldId) : undefined;
  return field && field.type === FieldType.MultiSelect ? field : undefined;
}

/** {id, text} items of a select cell (malformed items skipped). */
function cellItems(value: CellValue): { id?: unknown; text?: unknown }[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return items.filter((item): item is { id?: unknown; text?: unknown } => typeof item === 'object' && item !== null);
}

/**
 * The path field with the options a cell proves exist added: items whose id is not among the
 * field's options and whose text names none of them. The cell is read from the host, so such an
 * option was just created elsewhere (the cached field metadata is older): it must be kept on
 * write, and a step it names must neither be created again nor read as having no option.
 */
export function withCellOptions(field: FieldMeta, value: CellValue): FieldMeta {
  const options = field.options ?? [];
  const extra: SelectOption[] = [];
  for (const { id, text } of cellItems(value)) {
    if (typeof id !== 'string' || id === '' || typeof text !== 'string') continue;
    if (options.some((o) => o.id === id) || extra.some((o) => o.id === id)) continue;
    if (options.some((o) => pathKey(o.name) === pathKey(text))) continue;
    extra.push({ id, name: text, color: 0 });
  }
  return extra.length > 0 ? { ...field, options: [...options, ...extra] } : field;
}

/**
 * Options selected in a path cell, resolved against the field so they carry the current names:
 * an item is matched by option id, else by its text. Items matching no option are dropped
 * (pass the field through withCellOptions first to keep them). De-duplicated, in cell order.
 */
export function selectedPathOptions(field: FieldMeta, value: CellValue): SelectOption[] {
  const options = field.options ?? [];
  const out: SelectOption[] = [];
  for (const { id, text } of cellItems(value)) {
    const option =
      (typeof id === 'string' ? options.find((o) => o.id === id) : undefined) ??
      (typeof text === 'string' ? options.find((o) => pathKey(o.name) === pathKey(text)) : undefined);
    if (option && !out.some((o) => o.id === option.id)) out.push(option);
  }
  return out;
}

/** Node ids per name key (several nodes may share a name). */
export function nodeIdsByName(graph: PipelineGraph): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const key = pathKey(node.name);
    byKey.set(key, [...(byKey.get(key) ?? []), node.id]);
  }
  return byKey;
}

/** Selected options split into the nodes they name and the user's own (non-node) options. */
export function splitPathOptions(graph: PipelineGraph, selected: SelectOption[]): { nodes: Set<string>; others: SelectOption[] } {
  const byKey = nodeIdsByName(graph);
  const nodes = new Set<string>();
  const others: SelectOption[] = [];
  for (const option of selected) {
    const ids = byKey.get(pathKey(option.name));
    if (ids) ids.forEach((id) => nodes.add(id));
    else others.push(option);
  }
  return { nodes, others };
}

/** Nodes whose name has no option in the path field: the field cannot say whether they were passed. */
export function nodesWithoutOption(graph: PipelineGraph, field: FieldMeta): Set<string> {
  const keys = new Set((field.options ?? []).map((o) => pathKey(o.name)));
  return new Set(graph.nodes.filter((n) => !keys.has(pathKey(n.name))).map((n) => n.id));
}

/** The record's path cell read against the field: the nodes it ticks and the nodes it cannot tick. */
export function readPathCell(
  graph: PipelineGraph,
  record: RecordData,
  config: PipelineConfig,
  fieldById: Map<string, FieldMeta>,
): { ticked: Set<string>; noOption: Set<string> } | null {
  const configured = getPathField(config, fieldById);
  if (!configured) return null;
  const value = record.fields[configured.id];
  const field = withCellOptions(configured, value);
  return { ticked: splitPathOptions(graph, selectedPathOptions(field, value)).nodes, noOption: nodesWithoutOption(graph, field) };
}

/** Node ids named by the record's path cell (empty when the field is not configured or the cell is empty). */
export function readPathNodeIds(
  graph: PipelineGraph,
  record: RecordData,
  config: PipelineConfig,
  fieldById: Map<string, FieldMeta>,
): Set<string> {
  return readPathCell(graph, record, config, fieldById)?.ticked ?? new Set();
}

/**
 * What ticked steps say about the route to `current`, which is what the plugin writes: one tick
 * per step, so the route is recorded step by step back from the current node through ticked
 * predecessors. Where that walk reaches a step (other than a root) none of whose predecessors is
 * ticked, the record got there by a route the cell does not record (the stage was changed
 * outside the plugin, the cell was filled by hand, or a step had no option): the steps before it
 * are `uncovered`, like those before a history log that starts mid-way. So are the steps the
 * field has no option for (`noOption`). Every other strict ancestor not ticked was not passed.
 * `certain` = the steps on every route to the current node or to a ticked ancestor: they were
 * passed whatever the cell says.
 */
export function pathCoverage(
  graph: PipelineGraph,
  current: string,
  ticked: Set<string>,
  noOption: Set<string>,
): { uncovered: Set<string>; certain: Set<string> } {
  const before = ancestors(graph, current);
  const certain = dominators(graph, current);
  for (const id of ticked) if (before.has(id)) dominators(graph, id).forEach((d) => certain.add(d));

  const uncovered = new Set<string>();
  const tail = [current];
  const seen = new Set(tail);
  for (let i = 0; i < tail.length; i++) {
    const preds = graph.predecessors.get(tail[i]) ?? [];
    const tickedPreds = preds.filter((p) => ticked.has(p));
    if (preds.length > 0 && tickedPreds.length === 0) ancestors(graph, tail[i]).forEach((id) => uncovered.add(id));
    for (const p of tickedPreds) {
      if (seen.has(p)) continue;
      seen.add(p);
      tail.push(p);
    }
  }
  for (const id of noOption) if (before.has(id)) uncovered.add(id);
  return { uncovered, certain };
}

/**
 * The steps of the current run that a history log proves, replayed the way the plugin maintains
 * the path field: start → {to}; advance → + {from, to}; rollback → + {to} minus the descendants
 * of `to`; complete → + {to}. Names are matched like path options (trimmed, NFC); names that
 * match no node are ignored.
 */
export function replayHistory(graph: PipelineGraph, history: HistoryEntry[]): Set<string> {
  const byKey = nodeIdsByName(graph);
  const ids = (name: string | undefined) => (name ? byKey.get(pathKey(name)) ?? [] : []);
  let route = new Set<string>();
  for (const entry of history) {
    if (entry.kind === 'start') route = new Set();
    if (entry.kind === 'advance') ids(entry.from).forEach((id) => route.add(id));
    ids(entry.to).forEach((id) => route.add(id));
    if (entry.kind === 'rollback') {
      for (const id of ids(entry.to)) for (const later of descendants(graph, id)) route.delete(later);
    }
  }
  return route;
}

/**
 * Steps passed after a transition, from the steps passed before it:
 *   start    → {to} (a fresh start forgets earlier steps)
 *   advance  → existing ∪ {current, to}
 *   rollback → (existing ∪ {to}) minus the descendants of `to` (they will be walked again)
 *   complete → existing ∪ {current}
 * For advance / complete, existing ticks that are neither the current node nor one of its
 * ancestors are dropped first: they belong to a route the record left without the plugin (its
 * stage was changed in the grid). `current` / `to` may be null when unknown; they are then not
 * added (an advance without a current node keeps the ticks leading to `to`).
 */
export function pathAfter(
  graph: PipelineGraph,
  existing: Set<string>,
  kind: TransitionKind,
  current: string | null,
  to: string | null,
): Set<string> {
  let next = kind === 'start' ? new Set<string>() : new Set(existing);
  const at = kind === 'advance' ? current ?? to : kind === 'complete' ? current : null;
  if (at !== null && graph.nodeById.has(at)) {
    const route = ancestors(graph, at).add(at);
    next = new Set([...next].filter((id) => route.has(id)));
  }
  const add = (id: string | null) => {
    if (id !== null && graph.nodeById.has(id)) next.add(id);
  };
  switch (kind) {
    case 'start':
      add(to);
      break;
    case 'advance':
      add(current);
      add(to);
      break;
    case 'rollback':
      add(to);
      if (to !== null) for (const id of descendants(graph, to)) next.delete(id);
      break;
    case 'complete':
      add(current);
      break;
  }
  return next;
}

/**
 * Cell value for the path field: the options of `nodeIds` ordered by topoOrder of their nodes,
 * then the user's own options in their original order; null when nothing is selected.
 * Nodes whose name has no option in the field are left out (see missingPathNodes).
 */
export function pathCellValue(
  graph: PipelineGraph,
  field: FieldMeta,
  nodeIds: Set<string>,
  others: SelectOption[],
): CellValue {
  const optionByKey = new Map<string, SelectOption>();
  for (const o of field.options ?? []) if (!optionByKey.has(pathKey(o.name))) optionByKey.set(pathKey(o.name), o);
  const picked: SelectOption[] = [];
  const add = (o: SelectOption | undefined) => {
    if (o && !picked.some((p) => p.id === o.id)) picked.push(o);
  };
  for (const id of topoOrder(graph)) {
    if (nodeIds.has(id)) add(optionByKey.get(pathKey(graph.nodeById.get(id)?.name ?? '')));
  }
  others.forEach(add);
  return picked.length > 0 ? picked.map((o) => ({ id: o.id, text: o.name })) : null;
}

/** Nodes of `nodeIds` (in topoOrder) whose name has no option in the path field. */
export function missingPathNodes(graph: PipelineGraph, field: FieldMeta, nodeIds: Set<string>): string[] {
  const keys = new Set((field.options ?? []).map((o) => pathKey(o.name)));
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const id of topoOrder(graph)) {
    if (!nodeIds.has(id)) continue;
    const key = pathKey(graph.nodeById.get(id)?.name ?? '');
    if (!key || keys.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push(id);
  }
  return missing;
}
