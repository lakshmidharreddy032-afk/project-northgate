import React, { useEffect, useState } from 'react';
import { apiUrl } from '../api';
import {
  computeDirectOwnershipSum,
  type KycCase,
  type NorthgateView,
  type OwnershipNode,
  type PolicySettings,
  type UboDeterminationStatus,
} from '../shared/index';

interface OwnershipWorkbenchViewProps {
  activeCase: KycCase;
  policy: PolicySettings;
  onUpdateNode: (
    nodeId: string,
    payload: { determinationStatus: UboDeterminationStatus; analystNotes: string }
  ) => Promise<void>;
  onAddNode: (payload: {
    parentId: string;
    name: string;
    kind: OwnershipNode['kind'];
    legalForm: string;
    jurisdiction: string;
    directPct: number;
    analystNotes?: string;
  }) => Promise<void>;
  onCommitStructure: () => Promise<void>;
  onNavigate: (view: NorthgateView) => void;
}

export const OwnershipWorkbenchView: React.FC<OwnershipWorkbenchViewProps> = ({
  activeCase,
  policy,
  onUpdateNode,
  onAddNode,
  onCommitStructure,
  onNavigate,
}) => {
  const defaultFocus =
    activeCase.ownershipNodes.find((n) => n.determinationStatus === 'DISCREPANCY_PENDING') ??
    activeCase.ownershipNodes.find((n) => n.isQualifiedUbo) ??
    activeCase.ownershipNodes[0];

  const [selectedNodeId, setSelectedNodeId] = useState<string>(defaultFocus?.id ?? '');
  const [showEffective, setShowEffective] = useState(true);
  const [highlightUbo, setHighlightUbo] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [zoomPct, setZoomPct] = useState(100);

  const [determination, setDetermination] = useState<UboDeterminationStatus>('CONFIRMED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [newKind, setNewKind] = useState<OwnershipNode['kind']>('NATURAL_PERSON');
  const [newJurisdiction, setNewJurisdiction] = useState('United Kingdom (GB)');
  const [newDirectPct, setNewDirectPct] = useState('25');

  const selectedNode =
    activeCase.ownershipNodes.find((n) => n.id === selectedNodeId) ?? defaultFocus;

  useEffect(() => {
    const fallback =
      activeCase.ownershipNodes.find((n) => n.determinationStatus === 'DISCREPANCY_PENDING') ??
      activeCase.ownershipNodes.find((n) => n.isQualifiedUbo) ??
      activeCase.ownershipNodes[0];
    if (fallback && !activeCase.ownershipNodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(fallback.id);
    }
  }, [activeCase.id, activeCase.ownershipNodes, selectedNodeId]);

  useEffect(() => {
    if (selectedNode) {
      setDetermination(selectedNode.determinationStatus);
      setNotes(selectedNode.analystNotes);
    }
  }, [selectedNode?.id, selectedNode?.determinationStatus, selectedNode?.analystNotes]);

  const rootNode = activeCase.ownershipNodes.find((n) => n.tier === 0 || !n.parentId);
  const tier1Nodes = activeCase.ownershipNodes.filter((n) => n.tier === 1);
  const tier2Nodes = activeCase.ownershipNodes.filter((n) => n.tier >= 2);
  const qualifiedUboCount = activeCase.ownershipNodes.filter((n) => n.isQualifiedUbo).length;
  const directSum = computeDirectOwnershipSum(activeCase.ownershipNodes);

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setSaving(true);
    try {
      await onUpdateNode(selectedNode.id, {
        determinationStatus: determination,
        analystNotes: notes,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Number(newDirectPct);
    if (!newName.trim() || Number.isNaN(pct) || pct <= 0 || pct > 100) return;
    await onAddNode({
      parentId: newParentId || rootNode?.id || '',
      name: newName.trim(),
      kind: newKind,
      legalForm: newKind === 'NATURAL_PERSON' ? 'Natural Person' : 'Corporate Body',
      jurisdiction: newJurisdiction,
      directPct: pct,
    });
    setShowAddModal(false);
    setNewName('');
  };

  return (
    <div className="flex flex-col">
      {/* Workbench Header Ribbon */}
      <div className="bg-surface-container-lowest border-b border-slate-200 px-4 py-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px] text-secondary">account_tree</span>
              <h1 className="font-semibold text-[16px] text-on-surface">
                Ownership Structure &amp; UBO Reconciliation
              </h1>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden md:block" />
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-container-low text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span>{policy.ruleEngineVersion}</span>
              <span className="font-mono text-on-surface-variant">
                | UBO Threshold: ≥ {policy.uboThresholdPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewParentId(rootNode?.id ?? '');
                setShowAddModal(true);
              }}
              className="h-8 px-2.5 rounded bg-surface-container-low border border-slate-200 hover:bg-surface-container text-[12px] font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Node</span>
            </button>
            <a
              href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/ownership/export-csv`)}
              className="h-8 px-3 rounded bg-surface-container-low border border-slate-200 hover:bg-surface-container text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Cap Table CSV</span>
            </a>
            <button
              type="button"
              onClick={() => void onCommitStructure()}
              className={`h-8 px-3 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                activeCase.ownershipCommitted
                  ? 'bg-emerald-700 text-white'
                  : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>{activeCase.ownershipCommitted ? 'Structure Committed' : 'Commit Structure'}</span>
            </button>
          </div>
        </div>

        {/* Rule / Filter Toggles Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-4 flex-wrap text-[12px] font-medium">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEffective}
                onChange={(e) => setShowEffective(e.target.checked)}
                className="accent-secondary"
              />
              <span>Show Cumulative Effective %</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightUbo}
                onChange={(e) => setHighlightUbo(e.target.checked)}
                className="accent-secondary"
              />
              <span>Highlight ≥{policy.uboThresholdPct}% UBOs</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showBreakdown}
                onChange={(e) => setShowBreakdown(e.target.checked)}
                className="accent-secondary"
              />
              <span>Display Direct vs Indirect Breakdown</span>
            </label>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">shield_person</span>
              Identified UBOs: <strong className="text-on-surface">{qualifiedUboCount} Qualified</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">pie_chart</span>
              Direct Sum:{' '}
              <strong className={directSum === 100 ? 'text-on-surface' : 'text-amber-700'}>
                {directSum.toFixed(2)}%
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Primary Split Workbench */}
      <div className="p-4 flex flex-col xl:flex-row gap-4">
        {/* Left 60%: Tree + Cap Table Ledger */}
        <div className="w-full xl:w-[60%] flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-4 overflow-x-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Cap Table Hierarchy Tree
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high font-mono text-[11px] text-on-surface">
                  {tier2Nodes.length > 0 ? '3 Tiers' : '2 Tiers'} • {activeCase.ownershipNodes.length} Legal Nodes
                </span>
              </div>
              <div className="flex items-center gap-1 bg-surface-container-low px-1.5 py-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.min(120, z + 10))}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.max(80, z - 10))}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPct(100)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container"
                  title="Reset Zoom"
                >
                  <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
                </button>
              </div>
            </div>

            {/* Interactive Hierarchical Tree */}
            <div
              className="flex flex-col items-center py-2 transition-transform origin-top"
              style={{ transform: `scale(${zoomPct / 100})` }}
            >
              {/* Tier 0 Target Entity */}
              {rootNode && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(rootNode.id)}
                    className={`w-80 text-left bg-white border rounded p-3 transition-all ${
                      selectedNode?.id === rootNode.id
                        ? 'border-secondary ring-2 ring-secondary/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center">
                          <span className="material-symbols-outlined text-[14px]">apartment</span>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                            Operating Target Entity
                          </div>
                          <div className="font-semibold text-[13.5px] text-on-surface">{rootNode.name}</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-primary text-white font-mono text-[11px] font-semibold">
                        100.0%
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-on-surface-variant mt-2 pt-1.5 border-t border-slate-100">
                      {rootNode.registrationOrCitizenship}
                    </div>
                  </button>
                  {tier1Nodes.length > 0 && <div className="w-px h-6 bg-slate-300" />}
                </div>
              )}

              {/* Tier 1 Nodes */}
              {tier1Nodes.length > 0 && (
                <div className="relative flex flex-wrap justify-center gap-3 pt-2 border-t border-slate-300">
                  {tier1Nodes.map((node) => {
                    const children = tier2Nodes.filter((c) => c.parentId === node.id);
                    const isSelected = selectedNode?.id === node.id;
                    const uboHighlight = highlightUbo && node.isQualifiedUbo;
                    return (
                      <div key={node.id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`w-56 text-left bg-white border rounded p-2.5 border-l-[3px] transition-all ${
                            uboHighlight ? 'border-l-secondary' : 'border-l-primary-container'
                          } ${
                            isSelected
                              ? 'border-secondary ring-2 ring-secondary/20 bg-[#f0f7ff]'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                              {node.kind.replace('_', ' ')}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-semibold ${
                                uboHighlight
                                  ? 'bg-secondary text-white'
                                  : 'bg-surface-container-high text-on-surface'
                              }`}
                            >
                              {node.directPct.toFixed(1)}% Direct
                            </span>
                          </div>
                          <div className="font-semibold text-[13px] text-on-surface mt-1">{node.name}</div>
                          <div className="text-[11px] text-on-surface-variant mt-0.5">
                            {node.registrationOrCitizenship}
                          </div>
                          {showBreakdown && (
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                              <span className="text-on-surface-variant">{node.legalForm}</span>
                              <span className="font-mono text-secondary font-semibold">
                                {children.length > 0 ? `Parent of ${children.length} UBOs ↓` : node.pscStatus}
                              </span>
                            </div>
                          )}
                        </button>

                        {/* Tier 2 Children under this Tier 1 node */}
                        {children.length > 0 && (
                          <div className="flex flex-col items-center mt-1">
                            <div className="w-px h-5 bg-slate-300" />
                            <div className="flex flex-wrap justify-center gap-2.5 pt-2 border-t border-slate-300">
                              {children.map((child) => {
                                const childSelected = selectedNode?.id === child.id;
                                const childUbo = highlightUbo && child.isQualifiedUbo;
                                return (
                                  <button
                                    key={child.id}
                                    type="button"
                                    onClick={() => setSelectedNodeId(child.id)}
                                    className={`w-48 text-left bg-white border rounded p-2.5 border-l-[3px] transition-all ${
                                      childUbo ? 'border-l-secondary' : 'border-l-slate-300'
                                    } ${
                                      childSelected
                                        ? 'border-secondary ring-2 ring-secondary/20 bg-[#f0f7ff]'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
                                        Natural Person
                                      </span>
                                      {child.isQualifiedUbo && (
                                        <span className="px-1.5 py-0.5 rounded bg-secondary text-white font-mono text-[10px] font-semibold">
                                          UBO ≥{policy.uboThresholdPct}%
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-semibold text-[13px] text-on-surface mt-1">
                                      {child.name}
                                    </div>
                                    <div className="text-[11px] text-on-surface-variant">
                                      {child.registrationOrCitizenship}
                                    </div>
                                    {showEffective && (
                                      <div className="mt-2 pt-1.5 border-t border-slate-100">
                                        {showBreakdown && (
                                          <div className="font-mono text-[10px] text-on-surface-variant">
                                            {child.formulaLabel}
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between mt-1">
                                          <span className="text-[10.5px] font-semibold text-secondary">
                                            Effective UBO:
                                          </span>
                                          <span className="font-mono text-[12px] font-semibold text-secondary">
                                            {child.effectivePct.toFixed(2)}%
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
                  Qualified UBO (≥{policy.uboThresholdPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary-container" />
                  Corporate / Conduit Entity
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
                  Minority Holder (&lt;{policy.uboThresholdPct}%)
                </span>
              </div>
              <span className="font-mono">Formula: Effective % = Π (Direct % × Tier Ownership %)</span>
            </div>
          </div>

          {/* Cap Table Reconciliation Ledger */}
          <div className="bg-surface-container-lowest border border-slate-200 rounded overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[13px] text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">table_chart</span>
                <span>Cap Table Reconciliation Ledger</span>
              </div>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Calculated per 5AMLD Articles 3(6)(a)(i)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-slate-200 text-[10.5px] font-semibold uppercase text-on-surface-variant">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Form</th>
                    <th className="py-2 px-3">Jurisdiction</th>
                    <th className="py-2 px-3 text-right">Direct Equity</th>
                    <th className="py-2 px-3 text-right">Effective %</th>
                    <th className="py-2 px-3 text-right">UBO Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12px]">
                  {activeCase.ownershipNodes
                    .filter((n) => n.kind !== 'TARGET')
                    .map((node) => (
                      <tr
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`cursor-pointer ${
                          selectedNode?.id === node.id ? 'bg-[#f0f7ff]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-on-surface">{node.name}</td>
                        <td className="py-2 px-3 text-on-surface-variant">{node.legalForm}</td>
                        <td className="py-2 px-3 text-on-surface-variant">{node.jurisdiction}</td>
                        <td className="py-2 px-3 text-right font-mono">{node.directPct.toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-secondary">
                          {node.kind === 'HOLDING_CO' ? 'N/A (Holding)' : `${node.effectivePct.toFixed(2)}%`}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {node.isQualifiedUbo ? (
                            <span className="px-2 py-0.5 rounded bg-secondary text-white text-[10.5px] font-semibold">
                              Qualified UBO
                            </span>
                          ) : node.kind === 'HOLDING_CO' ? (
                            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-[10.5px] font-semibold">
                              Intermediate Tier
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant text-[10.5px] font-semibold">
                              Minority (&lt;{policy.uboThresholdPct}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 40%: Target Dossier, Disparity Analysis, Analyst Determination */}
        <div className="w-full xl:w-[40%] flex flex-col gap-3">
          {selectedNode && (
            <>
              <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Target Entity / Person Dossier
                    </div>
                    <h2 className="text-[18px] font-semibold text-on-surface mt-0.5">
                      {selectedNode.name}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedNode.isQualifiedUbo
                          ? 'bg-secondary text-white'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {selectedNode.isQualifiedUbo ? 'UBO Status: Confirmed' : selectedNode.kind.replace('_', ' ')}
                    </span>
                    <div className="font-mono text-[11px] text-secondary mt-1">
                      {selectedNode.effectivePct.toFixed(1)}% Cumulative Effective
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-[12px]">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Entity Role</div>
                    <div className="font-semibold text-on-surface mt-0.5">
                      {selectedNode.isQualifiedUbo ? 'Ultimate Beneficial Owner' : selectedNode.legalForm}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Holding Route</div>
                    <div className="font-medium text-on-surface mt-0.5">{selectedNode.holdingRoute}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Screening Result</div>
                    <div className="font-medium text-on-surface mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      {selectedNode.screeningResult}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-on-surface-variant">PSC Status</div>
                    <div className="font-medium text-on-surface mt-0.5">{selectedNode.pscStatus}</div>
                  </div>
                </div>
              </div>

              {selectedNode.addressDiscrepancy && (
                <div className="bg-surface-container-low border border-secondary/30 rounded p-3 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary mt-0.5">warning</span>
                  <div>
                    <div className="font-semibold text-[12.5px] text-on-surface">
                      Address Discrepancy Flagged
                    </div>
                    <p className="text-[11.5px] text-on-surface-variant mt-0.5">
                      {selectedNode.addressDiscrepancy}
                    </p>
                  </div>
                </div>
              )}

              {selectedNode.declaredProfile && selectedNode.registryProfile && (
                <div className="bg-surface-container-lowest border border-slate-200 rounded p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px] text-on-surface">
                      Evidentiary Disparity Analysis
                    </span>
                    <span className="text-[11px] text-on-surface-variant">Dual-Source Validation</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11.5px] pt-2 border-t border-slate-100">
                    <div className="flex flex-col gap-2">
                      <div className="font-semibold text-[10.5px] uppercase text-on-surface-variant flex items-center justify-between">
                        <span>Declared in Packet</span>
                        <span className="font-mono px-1 bg-surface-container-low rounded">
                          {selectedNode.declaredProfile.docRef}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] text-on-surface-variant uppercase">Full Legal Name</div>
                        <div className="font-semibold text-on-surface">{selectedNode.declaredProfile.fullLegalName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-on-surface-variant uppercase">Date of Birth</div>
                        <div>{selectedNode.declaredProfile.dateOfBirth}</div>
                      </div>
                      <div className="p-2 rounded bg-surface-container-low">
                        <div className="text-[10px] text-on-surface-variant uppercase">Declared Address</div>
                        <div className="font-medium text-on-surface">{selectedNode.declaredProfile.declaredAddress}</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="font-semibold text-[10.5px] uppercase text-on-surface-variant flex items-center justify-between">
                        <span>{selectedNode.registryProfile.sourceName}</span>
                        <span className="px-1 bg-secondary text-white rounded text-[9.5px]">Live Gov API</span>
                      </div>
                      <div>
                        <div className="text-[10px] text-on-surface-variant uppercase">Registered Name</div>
                        <div className="font-semibold text-on-surface">{selectedNode.registryProfile.registeredName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-on-surface-variant uppercase">Month &amp; Year of Birth</div>
                        <div>{selectedNode.registryProfile.monthYearOfBirth}</div>
                      </div>
                      <div className="p-2 rounded bg-surface-container-low">
                        <div className="text-[10px] text-on-surface-variant uppercase">Registered Service Address</div>
                        <div className="font-medium text-on-surface">
                          {selectedNode.registryProfile.registeredServiceAddress}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Document Traceability */}
              <div className="bg-surface-container-lowest border border-slate-200 rounded p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px] text-on-surface">Source Document Traceability</span>
                  <span className="font-mono text-[10.5px] text-on-surface-variant">Traceability Engine v4.2</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {activeCase.documents.slice(0, 2).map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onNavigate('document-viewer')}
                      className="p-2 rounded bg-surface-container-low border border-slate-200 hover:border-secondary text-left flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[11.5px] text-on-surface truncate">{doc.fileName}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">
                          Page {doc.currentPage} • {doc.status}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">
                        open_in_new
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Analyst Determination & Sign-off */}
              <form
                onSubmit={handleSaveVerification}
                className="bg-surface-container-lowest border border-slate-200 rounded p-3.5 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px] text-on-surface">
                    Analyst Determination &amp; Sign-off
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono text-[10.5px] text-on-surface-variant">
                    Analyst: M. Vance
                  </span>
                </div>

                <div>
                  <label className="block text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1">
                    Verification Determination Status
                  </label>
                  <select
                    value={determination}
                    onChange={(e) => setDetermination(e.target.value as UboDeterminationStatus)}
                    className="w-full h-8 px-2 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-secondary"
                  >
                    <option value="CONFIRMED">Confirmed Qualified UBO / Verified</option>
                    <option value="DISCREPANCY_PENDING">Discrepancy Pending — POA Clarification Required</option>
                    <option value="MINORITY_EXEMPT">Non-UBO Minority Exempt (&lt;{policy.uboThresholdPct}%)</option>
                    <option value="INTERMEDIATE_TIER">Intermediate Holding Tier (Look-Through Active)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1">
                    Mandatory Analyst Notes / Override Justification
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-[12px] focus:outline-none focus:border-secondary"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    Immutable audit timestamp applied
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-8 px-3.5 rounded bg-primary text-white font-semibold text-[12px] flex items-center gap-1.5 hover:bg-primary-container"
                  >
                    <span className="material-symbols-outlined text-[15px]">save</span>
                    <span>{saving ? 'Saving...' : 'Save Verification'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Add Ownership Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-semibold text-[15px] text-on-surface">Add Ownership Entity / UBO Node</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Parent Node
              </label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded text-[12px] bg-white"
              >
                {activeCase.ownershipNodes
                  .filter((n) => n.kind !== 'NATURAL_PERSON')
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      Tier {n.tier}: {n.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Entity / Natural Person Name
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Dr. Alistair Reed"
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Node Kind
                </label>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as OwnershipNode['kind'])}
                  className="w-full h-8 px-2 border border-slate-300 rounded text-[12px] bg-white"
                >
                  <option value="NATURAL_PERSON">Natural Person (UBO)</option>
                  <option value="HOLDING_CO">Holding Company</option>
                  <option value="DIRECT_SHAREHOLDER">Direct Shareholder</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Direct Equity %
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step="0.1"
                  required
                  value={newDirectPct}
                  onChange={(e) => setNewDirectPct(e.target.value)}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded font-mono text-[12px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Jurisdiction / Citizenship
              </label>
              <input
                type="text"
                value={newJurisdiction}
                onChange={(e) => setNewJurisdiction(e.target.value)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-8 px-3 border border-slate-200 rounded text-[12px] font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="h-8 px-3.5 bg-primary text-white rounded text-[12px] font-semibold">
                Add &amp; Recalculate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
