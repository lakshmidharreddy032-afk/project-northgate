from __future__ import annotations

from app.models.schemas import OwnershipNode


def _round2(value: float) -> float:
    return round(value, 2)


def recalculate_ownership_tree(
    nodes: list[OwnershipNode],
    ubo_threshold_pct: float = 25.0,
) -> list[OwnershipNode]:
    """Deterministically compute cumulative effective equity (%) and UBO flags.

    Implements FATF / 5AMLD recursive path multiplication:
        Effective % = Π (Direct % × Tier Ownership %)
    AI Gateway / LLM agents are strictly prohibited from overriding these values.
    """
    cloned = [n.model_copy(deep=True) for n in nodes]
    by_id = {n.id: n for n in cloned}

    def compute_effective(node: OwnershipNode, visited: set[str] | None = None) -> tuple[float, list[float]]:
        if node.kind == "TARGET" or not node.parentId:
            return 100.0, []
        seen = set(visited or set())
        if node.id in seen:
            return 0.0, []
        seen.add(node.id)
        parent = by_id.get(node.parentId)
        if not parent or parent.kind == "TARGET":
            return _round2(node.directPct), [node.directPct]
        parent_eff, chain = compute_effective(parent, seen)
        effective = _round2((parent_eff * node.directPct) / 100.0)
        return effective, [*chain, node.directPct]

    for node in cloned:
        if node.kind == "TARGET":
            node.effectivePct = 100.0
            node.isQualifiedUbo = False
            node.formulaLabel = "100.0% Direct Target"
            continue

        effective, chain = compute_effective(node)
        node.effectivePct = effective

        if node.kind == "NATURAL_PERSON":
            node.isQualifiedUbo = effective >= ubo_threshold_pct
            if len(chain) > 1:
                chain_str = " × ".join(f"{v:.1f}%" for v in chain)
                node.formulaLabel = f"Formula: {chain_str} = {effective:.2f}%"
            else:
                node.formulaLabel = f"Direct Equity: {effective:.2f}%"
            if node.determinationStatus == "MINORITY_EXEMPT" and node.isQualifiedUbo:
                node.determinationStatus = "CONFIRMED"
        else:
            node.isQualifiedUbo = False
            node.formulaLabel = f"{node.directPct:.1f}% Direct"

    return cloned


def compute_direct_ownership_sum(nodes: list[OwnershipNode]) -> float:
    return _round2(sum(n.directPct for n in nodes if n.tier == 1 and n.kind != "TARGET"))
