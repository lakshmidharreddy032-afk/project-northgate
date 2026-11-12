import type { OwnershipNode } from './index.js';

/**
 * Recomputes cumulative effective equity percentages and UBO qualification flags
 * across an ownership hierarchy tree using FATF / 5AMLD recursive multiplication:
 * Effective % = Π (Direct % × Tier Ownership %).
 */
export function recalculateOwnershipTree(
  nodes: OwnershipNode[],
  uboThresholdPct = 25.0
): OwnershipNode[] {
  const byId = new Map<string, OwnershipNode>();
  const cloned = nodes.map((node) => ({ ...node }));
  for (const node of cloned) {
    byId.set(node.id, node);
  }

  function computeEffective(node: OwnershipNode, visited = new Set<string>()): { effective: number; chain: number[] } {
    if (node.kind === 'TARGET' || !node.parentId) {
      return { effective: 100, chain: [] };
    }
    if (visited.has(node.id)) {
      return { effective: 0, chain: [] };
    }
    visited.add(node.id);
    const parent = byId.get(node.parentId);
    if (!parent || parent.kind === 'TARGET') {
      return { effective: round2(node.directPct), chain: [node.directPct] };
    }
    const parentRes = computeEffective(parent, visited);
    const effective = round2((parentRes.effective * node.directPct) / 100);
    return { effective, chain: [...parentRes.chain, node.directPct] };
  }

  for (const node of cloned) {
    if (node.kind === 'TARGET') {
      node.effectivePct = 100;
      node.isQualifiedUbo = false;
      node.formulaLabel = '100.0% Direct Target';
      continue;
    }

    const { effective, chain } = computeEffective(node);
    node.effectivePct = effective;

    if (node.kind === 'NATURAL_PERSON') {
      node.isQualifiedUbo = effective >= uboThresholdPct;
      if (chain.length > 1) {
        node.formulaLabel = `Formula: ${chain.map((v) => `${v.toFixed(1)}%`).join(' × ')} = ${effective.toFixed(2)}%`;
      } else {
        node.formulaLabel = `Direct Equity: ${effective.toFixed(2)}%`;
      }
      if (node.determinationStatus === 'MINORITY_EXEMPT' && node.isQualifiedUbo) {
        node.determinationStatus = 'CONFIRMED';
      }
    } else {
      node.isQualifiedUbo = false;
      node.formulaLabel = `${node.directPct.toFixed(1)}% Direct`;
    }
  }

  return cloned;
}

export function computeDirectOwnershipSum(nodes: OwnershipNode[]): number {
  const sum = nodes
    .filter((n) => n.tier === 1 && n.kind !== 'TARGET')
    .reduce((acc, n) => acc + n.directPct, 0);
  return round2(sum);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
