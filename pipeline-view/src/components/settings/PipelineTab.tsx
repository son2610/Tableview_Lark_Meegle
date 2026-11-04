import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, Input, Toast } from '@douyinfe/semi-ui';
import { IconBranch, IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import { FieldType } from '../../types';
import type { NodeConfig, PipelineGraph as GraphModel, SelectOption } from '../../types';
import { buildGraph, defaultLinearEdges } from '../../core/graph';
import { guessStatusCategory } from '../../core/config';
import { layoutGraph } from '../../core/layout';
import { useI18n } from '../../i18n';
import { PipelineGraph } from '../PipelineGraph';
import { NodeCard } from './NodeCard';
import type { NodeWarning } from './NodeCard';
import { EMPTY_NODE, Notice, fieldOf } from './shared';
import type { TabProps } from './shared';

const EMPTY_OPTIONS: SelectOption[] = [];

export interface PipelineTabProps extends TabProps {
  addStageOption(name: string, fieldId?: string): Promise<string | null>;
  /** Cycle found in the draft edges (node ids), if any. */
  cycle: string[] | null;
}

/**
 * Warnings for the designer. The "main" root is the first root that leads somewhere; other
 * roots are only reachable by starting a record there.
 */
export function nodeWarnings(graph: GraphModel): Map<string, NodeWarning> {
  const warnings = new Map<string, NodeWarning>();
  const outDegree = (id: string) => graph.successors.get(id)?.length ?? 0;
  const inDegree = (id: string) => graph.predecessors.get(id)?.length ?? 0;
  const mainRoot = graph.roots.find((id) => outDegree(id) > 0) ?? graph.roots[0];
  for (const node of graph.nodes) {
    let warning: NodeWarning = null;
    if (graph.nodes.length > 1 && inDegree(node.id) === 0 && outDegree(node.id) === 0) warning = 'isolated';
    else if (inDegree(node.id) === 0 && node.id !== mainRoot) warning = 'unreachable';
    warnings.set(node.id, warning);
  }
  return warnings;
}

export function PipelineTab({ ctx, draft, update, addStageOption, cycle }: PipelineTabProps) {
  const { t } = useI18n();
  const stageField = fieldOf(ctx, draft.stageFieldId);
  const statusField = fieldOf(ctx, draft.statusFieldId);
  const options = stageField?.options ?? EMPTY_OPTIONS;
  const graph = useMemo(() => buildGraph(options, draft.edges), [options, draft.edges]);
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const warnings = useMemo(() => nodeWarnings(graph), [graph]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(options.length > 0 ? [options[0].id] : []));
  const [focused, setFocused] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (focused) cardRefs.current.get(focused)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focused]);

  if (!stageField) {
    return (
      <div className="pv-set-tab">
        <Notice tone="warning">{t('settings.pipeline.noStage')}</Notice>
      </div>
    );
  }

  const excluded = new Set([
    draft.stageFieldId,
    draft.statusFieldId,
    draft.historyFieldId,
    draft.enteredAtFieldId,
    draft.pathFieldId,
  ]);
  const candidateFields = ctx.fields.filter((f) => !excluded.has(f.id));
  const userFields = ctx.fields.filter((f) => f.type === FieldType.User);

  const statusOptions = statusField?.options ?? [];
  const categoryOf = (o: SelectOption) => draft.statusCategories[o.id] ?? guessStatusCategory(o.name);
  const defaultStatus =
    statusOptions.find((o) => o.id === draft.defaultEntryStatusId) ??
    statusOptions.find((o) => categoryOf(o) === 'todo') ??
    statusOptions[0];

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const focusNode = (id: string) => {
    setExpanded((prev) => new Set(prev).add(id));
    setFocused(id);
  };

  const setSuccessors = (nodeId: string, targets: string[]) =>
    update((d) => {
      // The first manual edit turns the implicit linear flow into an explicit edge list.
      const base = d.edges ?? defaultLinearEdges(options);
      const kept = base.filter((e) => e.from !== nodeId);
      return { ...d, edges: kept.concat(targets.filter((to) => to !== nodeId).map((to) => ({ from: nodeId, to }))) };
    });

  const updateNode = (nodeId: string, fn: (node: NodeConfig) => NodeConfig) =>
    update((d) => ({ ...d, nodes: { ...d.nodes, [nodeId]: fn(d.nodes[nodeId] ?? EMPTY_NODE) } }));

  const submitNewNode = async () => {
    const name = newName.trim();
    if (!name) return;
    if (options.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) {
      Toast.warning(t('settings.pipeline.addNode.duplicate', { name }));
      return;
    }
    setBusy(true);
    const id = await addStageOption(name, stageField.id);
    setBusy(false);
    if (!id) {
      Toast.error(t('settings.pipeline.addNode.failed'));
      return;
    }
    Toast.success(t('settings.pipeline.addNode.done', { name }));
    setNewName('');
    setAdding(false);
    focusNode(id);
  };

  const cyclePath = cycle
    ? cycle
        .concat(cycle.slice(0, 1))
        .map((id) => graph.nodeById.get(id)?.name ?? id)
        .join(' → ')
    : '';

  return (
    <div className="pv-set-tab">
      <p className="pv-set-intro">{t('settings.pipeline.intro', { field: stageField.name })}</p>

      {cycle && (
        <Banner type="danger" fullMode={false} bordered closeIcon={null} description={t('settings.error.cycle', { path: cyclePath })} />
      )}

      <section className="pv-pipe-preview">
        <div className="pv-pipe-preview__bar">
          <span className="pv-pipe-preview__title">{t('settings.pipeline.preview')}</span>
          <span className="pv-pipe-preview__meta">
            {t('settings.pipeline.count', { count: options.length })} ·{' '}
            {draft.edges === null ? t('settings.pipeline.mode.linear') : t('settings.pipeline.mode.custom')}
          </span>
          <span className="pv-pipe-preview__actions">
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<IconRefresh />}
              disabled={draft.edges === null}
              onClick={() => update((d) => ({ ...d, edges: null }))}
            >
              {t('settings.pipeline.resetLinear')}
            </Button>
            <Button size="small" theme="light" type="primary" icon={<IconPlus />} onClick={() => setAdding(true)} disabled={adding}>
              {t('settings.pipeline.addNode')}
            </Button>
          </span>
        </div>

        {adding && (
          <div className="pv-pipe-preview__add">
            <Input
              autoFocus
              value={newName}
              maxLength={100}
              placeholder={t('settings.pipeline.addNode.placeholder')}
              onChange={setNewName}
              onEnterPress={() => void submitNewNode()}
              disabled={busy}
            />
            <Button theme="solid" type="primary" loading={busy} disabled={!newName.trim()} onClick={() => void submitNewNode()}>
              {t('common.create')}
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}

        <div className="pv-pipe-preview__canvas">
          {options.length === 0 ? (
            <div className="pv-pipe-preview__empty">
              <IconBranch />
              {t('settings.pipeline.noOptions')}
            </div>
          ) : (
            <PipelineGraph
              graph={graph}
              layout={layout}
              mode="preview"
              selectedNodeId={focused}
              onNodeClick={focusNode}
              optionColors={ctx.optionColors}
            />
          )}
        </div>
      </section>

      <div className="pv-pipe-nodes">
        {graph.nodes.map((node) => (
          <NodeCard
            key={node.id}
            ctx={ctx}
            graph={graph}
            node={node}
            config={draft.nodes[node.id] ?? EMPTY_NODE}
            expanded={expanded.has(node.id)}
            focused={focused === node.id}
            warning={warnings.get(node.id) ?? null}
            candidateFields={candidateFields}
            userFields={userFields}
            statusField={statusField}
            defaultStatusName={defaultStatus?.name}
            cardRef={(el) => {
              if (el) cardRefs.current.set(node.id, el);
              else cardRefs.current.delete(node.id);
            }}
            onToggle={() => toggle(node.id)}
            onSuccessorsChange={(ids) => setSuccessors(node.id, ids)}
            onChange={(fn) => updateNode(node.id, fn)}
          />
        ))}
      </div>
    </div>
  );
}
