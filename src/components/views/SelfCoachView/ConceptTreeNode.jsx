/**
 * @file ConceptTreeNode — wraps a ConceptRow + (when umbrella expanded)
 * its children rows. Manages local expand-state per node + threads
 * inspector-open / drill-this / mastery + composite lookup down to rows.
 *
 * Per `feedback_scf_learning_state_not_tier_rank.md`:
 *   - Umbrella expansion is ALWAYS opt-in; children render only when
 *     the user explicitly opens the umbrella. Mirrors the founder's
 *     selected tree IA from 2026-05-06.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React, { useState } from 'react';
import { ConceptRow } from './ConceptRow';
import { CompositionInspector } from './CompositionInspector';
import { getChildrenOf, CONCEPT_REGISTRY } from '../../../utils/skillAssessment/tierConceptMap';
import { getLesson } from '../../../utils/skillAssessment/lessonRegistry';

/**
 * @param {object} props
 * @param {string} props.conceptId
 * @param {Object<string, object>} props.masteriesByConceptId
 * @param {Object<string, object>} props.compositesByConceptId
 * @param {object} props.weights
 * @param {object} props.toggles
 * @param {Function} props.onDrillThis - (conceptId) => void
 */
export const ConceptTreeNode = ({
  conceptId,
  masteriesByConceptId,
  compositesByConceptId,
  weights,
  toggles,
  onDrillThis,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [inspectorOpenId, setInspectorOpenId] = useState(null);

  const meta = CONCEPT_REGISTRY[conceptId];
  if (!meta) return null;
  const isUmbrella = meta.kind === 'rule-anchored-umbrella';
  const children = isUmbrella ? getChildrenOf(conceptId) : [];

  const renderRowAndInspector = (id, indentLevel, allowExpandToggle) => {
    const mastery = masteriesByConceptId[id] || null;
    const composite = compositesByConceptId[id] || { compositeScore: 0, breakdown: { leak: 0, drill: 0, test: 0, recent: 0 } };
    const lesson = getLesson(id);
    const inspectorOpen = inspectorOpenId === id;
    const childMeta = CONCEPT_REGISTRY[id];
    const childIsUmbrella = childMeta?.kind === 'rule-anchored-umbrella';

    return (
      <React.Fragment key={id}>
        <ConceptRow
          conceptId={id}
          mastery={mastery}
          composite={composite}
          lesson={lesson}
          isUmbrella={allowExpandToggle && childIsUmbrella}
          expanded={allowExpandToggle && childIsUmbrella ? expanded : false}
          onToggleExpand={allowExpandToggle && childIsUmbrella ? () => setExpanded((v) => !v) : undefined}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpenId((curr) => (curr === id ? null : id))}
          onDrillThis={() => onDrillThis(id)}
          indentLevel={indentLevel}
        />
        {inspectorOpen && (
          <div style={{ paddingLeft: `${indentLevel * 1.5}rem` }}>
            <CompositionInspector
              concept={{ conceptId: id, meta: childMeta }}
              mastery={mastery}
              composite={composite}
              weights={weights}
              toggles={toggles}
            />
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div data-testid={`concept-tree-node-${conceptId}`}>
      {renderRowAndInspector(conceptId, 0, true)}
      {isUmbrella && expanded && children.map((childId) => renderRowAndInspector(childId, 1, false))}
    </div>
  );
};
