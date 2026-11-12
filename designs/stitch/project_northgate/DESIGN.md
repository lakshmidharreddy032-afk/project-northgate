---
name: Project Northgate
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4a5f7f'
  primary: '#001229'
  on-primary: '#ffffff'
  primary-container: '#0f2744'
  on-primary-container: '#798fb1'
  inverse-primary: '#b2c8ed'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#041223'
  on-tertiary: '#ffffff'
  tertiary-container: '#192739'
  on-tertiary-container: '#808ea4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b2c8ed'
  on-primary-fixed: '#021c39'
  on-primary-fixed-variant: '#324866'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#d5e3fc'
  tertiary-fixed-dim: '#b9c7df'
  on-tertiary-fixed: '#0d1c2e'
  on-tertiary-fixed-variant: '#3a485b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '600'
    lineHeight: 1.375rem
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.035em
  tabular-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: '0'
  tabular-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies an institutional-grade, mission-critical operational posture designed for compliance officers, legal analysts, and financial crime investigators. The visual language conveys absolute precision, evidentiary rigor, and regulatory confidence. 

The aesthetic is grounded in modern corporate minimalism with an emphasis on high-density information architecture. Every interface decision prioritizes cognitive ergonomics: minimizing eye strain during extended analytical shifts, preventing operational errors during ownership resolution, and providing immediate perceptual clarity for complex legal structures. Visual embellishments, decorative gradients, rounded organic motifs, and illustrative distractions are strictly avoided in favor of architectural clarity, structural grid lines, and high-legibility alphanumeric data presentation.

## Colors

The palette establishes an authoritative, institutional light environment. High-contrast slate neutrals anchor data structures, while chromatic accents are reserved strictly for navigation state, active focus, and explicit regulatory statuses.

### Core Architecture
- **Base Canvas:** `#f8fafc` (Slate 50) and `#f1f5f9` (Slate 100) serve as non-reflective background foundations.
- **Surface Layer:** Pure `#ffffff` defines interactive worksheets, intake cards, data grids, and dossier panels.
- **Borders & Dividers:** Subtle, structural borders strictly anchored to `#e2e8f0` (Slate 200) with `#cbd5e1` (Slate 300) reserved for active grid column headers and focus boundaries.
- **Primary Brand / Action:** `#0f2744` (Deep Institutional Navy) functions as the principal visual weight for key interaction points, primary toolbars, and active shell states.
- **Interactive Focus / Secondary:** `#2563eb` (Controlled Slate-Blue) provides interactive cues, active tabs, breadcrumb links, and selection rings.

### Typography Hierarchy
- **Primary Text:** `#0f172a` (Slate 900) for primary entity titles, financial values, and critical identifiers.
- **Secondary Text:** `#334155` (Slate 700) for field labels, metadata titles, and tabular attributes.
- **Muted Text:** `#64748b` (Slate 500) for timestamps, system GUIDs, and inactive indicators.

### Semantic Triage & Verification System
Semantic alerts must never be softened with pastel ambiguity; they convey precise verification states:
- **Critical Discrepancy / Mismatch:** `#dc2626` (Red 600) with subtle `#fef2f2` container backing and `#fecaca` stroke.
- **Warning / Review Required:** `#d97706` (Amber 600) with `#fffbeb` container backing and `#fde68a` stroke.
- **Verified / Clear Match:** `#16a34a` (Green 600) with `#f0fdf4` container backing and `#bbf7d0` stroke.
- **Informational / Unreconciled:** `#0284c7` (Sky 600) with `#f0f9ff` container backing and `#bae6fd` stroke.

## Typography

The typographic engine uses a calibrated implementation of `Inter`, augmented by `JetBrains Mono` exclusively for transactional identifiers, LEI codes, routing numbers, and percentage-based ownership reconciliations.

### Hierarchy Guidelines
- **Numeric & Identity Precision:** All financial figures, entity registry numbers, tax IDs, and percentage calculations must use open-type tabular lining numerals (`font-variant-numeric: tabular-nums`) or the dedicated `JetBrains Mono` role.
- **Field Labels:** System metadata labels (e.g., "BENEFICIAL OWNERSHIP THRESHOLD", "INCORPORATION COUNTRY") utilize `label-sm` rendered in uppercase styling with deliberate tracking (+0.035em) to enforce vertical scanning cadence.
- **Reading Comfort:** Standard data review columns utilize `body-md` (13px equivalent), which balances maximum information density per vertical fold while remaining fully legible under prolonged scrutiny.

## Layout & Spacing

The layout is built upon an ultra-dense, multi-pane workbench structure designed for multi-monitor workstations (1440px to 2560px), with fallback adaptations for 1024px laptops.

### Grid & Composition Engine
- **Master Workbench Canvas:** Utilizes a fluid 12-column layout divided into persistent operational regions:
  - **Left Rail (Persistent):** Collapsible navigation & global queue overview (64px collapsed, 240px expanded).
  - **Primary Work Area (Split Pane):** Variable width split-pane (typically 60/40 or 50/50) supporting intake triage lists alongside ownership reconciliation trees.
  - **Right Inspector (Drawer / Context Pane):** 360px to 420px width dedicated to evidentiary documentation, audit trails, and sanction match details.
- **Vertical Rhythm:** Fixed 4px spatial baseline. Component internal heights are strictly bounded (e.g., standard table rows are 32px or 36px high; inputs are 32px).
- **Responsive Adaptations:** Below 1280px, the multi-pane layout shifts to an accessible tabbed workbench rather than horizontal side-by-side compression, maintaining data-table readability without horizontal data clipping.

## Elevation & Depth

This design system rejects deep atmospheric drop shadows and floating skeuomorphic layers. Visual separation is achieved through crisp 1px structural boundaries (`#e2e8f0`), strategic background contrast transitions (`#f8fafc` canvas vs `#ffffff` cards), and precise low-profile elevation tokens.

### Layer Matrix
- **Level 0 (Base Canvas):** `#f8fafc` — Background surface containing all root wrappers and table backing plates.
- **Level 1 (Card & Panel Surface):** `#ffffff` with a uniform 1px solid border (`#e2e8f0`). No shadow is cast; edges provide complete mechanical separation.
- **Level 2 (Active Focus / Hover Overlays):** `#ffffff` with a razor-thin containment shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.05)` and border color shift to `#cbd5e1`.
- **Level 3 (Dropdown Menus, Triage Popovers, Context Tooltips):** `#ffffff` with `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and border `#cbd5e1`.
- **Level 4 (Modal Workbenches & Document Viewers):** `#ffffff` with `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` flanked by a dim slate backdrop backdrop scrim (`rgba(15, 23, 42, 0.4)`).

## Shapes

The interface language is structured, architectural, and compact. A roundedness index of `1` provides soft, precise 4px corners across the system.

### Geometry Rules
- **Micro Elements (Tags, Inputs, Cells, Buttons):** Standard radius of `0.25rem` (4px). This softens raw digital corners while maintaining the severe, block-like scannability expected of institutional software.
- **Panels, Split Panes, Table Enclosures:** `0.375rem` (6px) or `0.5rem` (8px) maximum boundary curvature.
- **Status Pills:** Status chips and verification indicators retain a small `0.25rem` (4px) structural corner rather than a full circular capsule to reinforce an analytical, non-consumer aesthetic.

## Components

### Buttons & Interactive Controls
- **Primary Button:** `#0f2744` background, `#ffffff` text, 4px border radius, 32px height, 12px horizontal padding. Hover shifts to `#1e3a5f`.
- **Secondary Button:** Pure white `#ffffff` background, 1px solid `#e2e8f0` border, `#0f172a` text. Hover shifts to `#f8fafc` with `#cbd5e1` border.
- **Destructive Button:** Pure white background, 1px solid `#fca5a5` border, `#dc2626` text. Hover shifts to `#fef2f2`.
- **Icon / Utility Actions:** 28px × 28px square bounding box, borderless until hover, used for row actions (e.g., view source document, expand corporate tier).

### Data Tables & Intake Queue
- **Density:** Table rows are constrained to 36px standard (32px compact mode).
- **Headers:** `#f8fafc` background, `#334155` text color, uppercase `label-sm` typography, 1px bottom border `#cbd5e1`.
- **Cell Divider:** 1px horizontal border `#f1f5f9`. Row hover trigger: `#f8fafc` transition.
- **Selection State:** Light tint `#f0f7ff` with a 2px solid `#2563eb` left-edge indicator bar.

### Status Chips & Badges
Chips are composed of a tinted background, subtle matching perimeter border, high-contrast semantic text, and a 6px geometric dot indicator:
- **Verified / Clean Match:** `#f0fdf4` background, `#bbf7d0` border, `#15803d` text.
- **Discrepancy / Alert:** `#fef2f2` background, `#fecaca` border, `#b91c1c` text.
- **Pending / Action Required:** `#fffbeb` background, `#fde68a` border, `#b45309` text.
- **Unverified / Draft:** `#f1f5f9` background, `#e2e8f0` border, `#475569` text.

### Form Inputs & Triage Controls
- **Height & Padding:** 32px height, 8px horizontal padding, `body-md` typography.
- **Default State:** `#ffffff` surface, 1px solid `#cbd5e1` border.
- **Focus State:** 1px solid `#2563eb` border with a 2px concentric halo of `rgba(37, 99, 235, 0.15)`. No default browser outlines.
- **Error State:** 1px solid `#dc2626` border with a 2px concentric halo of `rgba(220, 38, 38, 0.15)`.

### Ownership Reconciliation Tree & Entity Graph Nodes
- **Structure:** Hierarchical parent-child nodes connected by 1px solid `#cbd5e1` orthogonal connector lines.
- **Entity Node Card:** Fixed-width 240px card with a pure white surface, 1px solid `#e2e8f0` border, and a 3px vertical left accent indicating the entity tier.
- **Ownership Percentage Pill:** Tabular mono badge (`tabular-mono-sm`) pinned to the top right of the node card displaying exact equity/voting percentages (e.g., `51.00%` direct, `25.50%` effective). Nodes totaling < 100% flag an immediate amber warning chip.

### Dossier & Evidentiary Cards
- Clean `#ffffff` containers with 12px internal padding. Card headers feature a distinct 1px bottom divider `#f1f5f9` separating identity metadata from evidentiary PDF attachments or register extracts.