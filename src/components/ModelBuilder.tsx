import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { EmptyActiveProject } from './EmptyActiveProject';
import { Plus, Trash, ArrowRight, GitFork, Download } from 'lucide-react';

interface Node {
  id: string;
  variableId: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  hypothesisCode: string;
  type: 'direct' | 'mediating' | 'moderating';
}

export const ModelBuilder: React.FC = () => {
  const { activeProject, updateProject, language } = useProject();

  // ── All hooks MUST be above any early return ──────────────────────────────
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [fromVar, setFromVar] = useState('');
  const [toVar, setToVar] = useState('');
  const [edgeType, setEdgeType] = useState<'direct' | 'mediating' | 'moderating'>('direct');
  const [roleVar, setRoleVar] = useState('');

  useEffect(() => {
    if (!activeProject) return;
    if (activeProject.variables.length > 0) {
      setNodes(prevNodes => {
        return activeProject.variables.map((v, i) => {
          const existing = prevNodes.find(n => n.variableId === v.id);
          if (existing) {
            return { ...existing, id: `node-${v.id}` };
          }
          
          let x = 100;
          let y = 100 + i * 110;
          if (v.type === 'independent') { x = 80;  y = 120 + i * 90; }
          else if (v.type === 'mediator')   { x = 280; y = 180; }
          else if (v.type === 'dependent')  { x = 480; y = 120 + (i - 1) * 90; }
          else if (v.type === 'moderator')  { x = 280; y = 50; }
          else if (v.type === 'control')    { x = 280; y = 300; }
          return { id: `node-${v.id}`, variableId: v.id, x, y };
        });
      });

      const initialEdges: Edge[] = activeProject.hypotheses.map((h, i) => ({
        id: `edge-${h.id}`,
        fromNodeId: `node-${h.independentVarId}`,
        toNodeId: `node-${h.dependentVarId}`,
        hypothesisCode: `H${i + 1}`,
        type: h.moderatorVarId ? 'moderating' : h.mediatorVarId ? 'mediating' : 'direct'
      }));
      setEdges(initialEdges);
    }
  }, [activeProject]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Early return AFTER all hooks ─────────────────────────────────────────
  if (!activeProject) {
    return (
      <EmptyActiveProject
        language={language}
        illustration={<GitFork size={40} />}
        description={language === 'ar' ? 'أنشئ مشروعًا من اختيار المسار لبناء نموذج المتغيرات.' : 'Create a project from path selection to build the variable model.'}
      />
    );
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      dragOffset.current = { x: e.clientX - node.x, y: e.clientY - node.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const clampedX = Math.max(10, Math.min(rect.width - 150, x));
    const clampedY = Math.max(10, Math.min(rect.height - 70, y));
    setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: clampedX, y: clampedY } : n));
  };

  const handleMouseUp = () => setDraggingNodeId(null);

  const getVariableLabel = (id: string) => {
    const v = activeProject.variables.find(varItem => varItem.id === id);
    if (!v) return '';
    return language === 'ar' ? v.nameAr : v.nameEn;
  };

  const handleAddEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromVar || !toVar || fromVar === toVar) return;
    const independentVariable = activeProject.variables.find(variable => variable.id === fromVar);
    const dependentVariable = activeProject.variables.find(variable => variable.id === toVar);
    if (independentVariable?.type !== 'independent' || dependentVariable?.type !== 'dependent') return;
    if ((edgeType === 'mediating' || edgeType === 'moderating') && !roleVar) return;

    // Check duplicate local edge
    const exists = edges.some(edge =>
      edge.fromNodeId === `node-${fromVar}` && edge.toNodeId === `node-${toVar}`
    );
    if (exists) return;

    const hypothesisId = `hyp-${Date.now()}`;
    const newHyp = {
      id: hypothesisId,
      questionId: '',
      textAr: `توجد علاقة ذات دلالة إحصائية بين ${getVariableLabel(fromVar)} و ${getVariableLabel(toVar)}.`,
      textEn: `There is a statistically significant relationship between ${getVariableLabel(fromVar)} and ${getVariableLabel(toVar)}.`,
      type: 'directional' as const,
      independentVarId: fromVar,
      dependentVarId: toVar,
      mediatorVarId: edgeType === 'mediating' ? roleVar : undefined,
      moderatorVarId: edgeType === 'moderating' ? roleVar : undefined
    };


    const updatedHypotheses = [...(activeProject.hypotheses || []), newHyp];

    updateProject({
      ...activeProject,
      hypotheses: updatedHypotheses
    });

    setFromVar('');
    setToVar('');
    setRoleVar('');
  };

const deleteEdge = (id: string) => {
  const hypId = id.startsWith('edge-') ? id.substring(5) : id;
  const updatedHypotheses = (activeProject.hypotheses || []).filter(h => h.id !== hypId);

  updateProject({
    ...activeProject,
    hypotheses: updatedHypotheses
  });
};

  const getVariableTypeColor = (type: string) => {
    switch (type) {
      case 'independent': return 'border-[var(--ds-primary)] bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]';
      case 'dependent':   return 'border-success bg-[var(--ds-success-soft)] text-success';
      case 'mediator':    return 'border-info bg-info/10 text-[var(--ds-information)]';
      case 'moderator':   return 'border-warning bg-warning/10 text-warning';
      case 'control':     return 'border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]';
      default:            return 'border-[var(--ds-border-subtle)]';
    }
  };

  const handleExportSVG = () => {
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420" style="background-color: #0b0f19;">`;
    
    svgContent += `
      <defs>
        <marker id="arrow-v2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ds-chart-4)" />
        </marker>
        <marker id="arrow-mod" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ds-chart-5)" />
        </marker>
      </defs>
    `;

    // Add edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.fromNodeId);
      const toNode   = nodes.find(n => n.id === edge.toNodeId);
      if (!fromNode || !toNode) return;
      const x1 = fromNode.x + 70, y1 = fromNode.y + 30;
      const x2 = toNode.x + 70,   y2 = toNode.y + 30;
      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      const isMod = edge.type === 'moderating';
      
      svgContent += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isMod ? 'var(--ds-chart-5)' : 'var(--ds-chart-4)'}" stroke-width="2" stroke-dasharray="${edge.type === 'mediating' ? '5,5' : '0'}" marker-end="${isMod ? 'url(#arrow-mod)' : 'url(#arrow-v2)'}" />
        <circle cx="${midX}" cy="${midY}" r="12" fill="${isMod ? 'var(--ds-chart-5)' : 'var(--ds-chart-4)'}" />
        <text x="${midX}" y="${midY + 4}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">${edge.hypothesisCode}</text>
      `;
    });

    // Add nodes
    nodes.forEach(node => {
      const variable = activeProject.variables.find(v => v.id === node.variableId);
      if (!variable) return;
      
      let strokeColor = '#4C5D8A';
      let fillColor = '#0B1F33';
      if (variable.type === 'dependent') { strokeColor = '#0B5D3B'; fillColor = '#041E14'; }
      else if (variable.type === 'mediator') { strokeColor = '#2E5A80'; fillColor = '#081726'; }
      else if (variable.type === 'moderator') { strokeColor = '#C6A15B'; fillColor = '#0B1F33'; }
      else if (variable.type === 'control') { strokeColor = '#6B7585'; fillColor = '#0B1F33'; }

      const label = language === 'ar' ? variable.nameAr : variable.nameEn;

      svgContent += `
        <rect x="${node.x}" y="${node.y}" width="144" height="60" rx="12" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />
        <text x="${node.x + 72}" y="${node.y + 20}" fill="#9AA3B0" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="1">${variable.type.toUpperCase()}</text>
        <text x="${node.x + 72}" y="${node.y + 40}" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">${label.substring(0, 20)}${label.length > 20 ? '...' : ''}</text>
      `;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conceptual_model_${activeProject.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">

      <PathPanel accent="var(--ds-path-research)">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-ink m-0">
              {language === 'ar' ? 'مصمم النموذج المفاهيمي التفاعلي' : 'Interactive Conceptual Model Designer'}
            </h3>
            <p className="text-xs text-secondary m-0">
              {language === 'ar'
                ? 'اسحب الصناديق لترتيب المتغيرات، وأضف روابط المسار الممثلة للفرضيات.'
                : 'Drag boxes to rearrange variables and add path lines representing hypotheses.'}
            </p>
          </div>
          <Button
            onClick={handleExportSVG}
            variant="secondary"
            className="flex items-center gap-1.5 px-4 py-2 font-bold cursor-pointer text-xs rounded-lg"
          >
            <Download size={13} />
            <span>{language === 'ar' ? 'تصدير النموذج كصورة SVG' : 'Export SVG Diagram'}</span>
          </Button>
        </div>
      </PathPanel>

      <Card className="p-6 space-y-4">

        {/* Add Edge Form */}
        <form onSubmit={handleAddEdge} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          {/* From */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[var(--ds-text-muted)] mb-1 uppercase tracking-wider">
              {language === 'ar' ? 'من المتغير (المستقل)' : 'From (IV)'}
            </label>
            <select
              value={fromVar}
              onChange={(e) => setFromVar(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              <option value="">--</option>
              {activeProject.variables.filter(v => v.type === 'independent').map(v => (
                <option key={v.id} value={v.id}>{getVariableLabel(v.id)}</option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[var(--ds-text-muted)] mb-1 uppercase tracking-wider">
              {language === 'ar' ? 'إلى المتغير (التابع)' : 'To (DV)'}
            </label>
            <select
              value={toVar}
              onChange={(e) => setToVar(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              <option value="">--</option>
              {activeProject.variables.filter(v => v.type === 'dependent').map(v => (
                <option key={v.id} value={v.id}>{getVariableLabel(v.id)}</option>
              ))}
            </select>
          </div>

          {/* Mediator/Moderator variable (only relevant when relation type requires one) */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[var(--ds-text-muted)] mb-1 uppercase tracking-wider">
              {edgeType === 'moderating'
                ? (language === 'ar' ? 'المتغير المعدِّل' : 'Moderator Variable')
                : (language === 'ar' ? 'المتغير الوسيط' : 'Mediator Variable')}
            </label>
            <select
              value={roleVar}
              onChange={(e) => setRoleVar(e.target.value)}
              disabled={edgeType === 'direct'}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] disabled:opacity-40"
            >
              <option value="">--</option>
              {activeProject.variables
                .filter(v => v.type === (edgeType === 'moderating' ? 'moderator' : 'mediator'))
                .map(v => (
                  <option key={v.id} value={v.id}>{getVariableLabel(v.id)}</option>
                ))}
            </select>
          </div>

          {/* Relation type */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[var(--ds-text-muted)] mb-1 uppercase tracking-wider">
              {language === 'ar' ? 'نوع العلاقة' : 'Relation Type'}
            </label>
            <select
              value={edgeType}
              onChange={(e) => {
                setEdgeType(e.target.value as 'direct' | 'mediating' | 'moderating');
                setRoleVar('');
              }}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg p-2 text-xs font-semibold text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              <option value="direct">{language === 'ar' ? 'مباشرة' : 'Direct'}</option>
              <option value="mediating">{language === 'ar' ? 'وساطة' : 'Mediating'}</option>
              <option value="moderating">{language === 'ar' ? 'تعديل' : 'Moderating'}</option>
            </select>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="flex items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-bold cursor-pointer"
          >
            <Plus size={14} />
            <span>{language === 'ar' ? 'أضف رابطاً' : 'Add Path'}</span>
          </Button>
        </form>
      </Card>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-[420px] border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-lg relative overflow-hidden svg-canvas shadow-sm"
      >
        {/* SVG edges layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow-v2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ds-chart-4)" />
            </marker>
            <marker id="arrow-mod" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ds-chart-5)" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const fromNode = nodes.find(n => n.id === edge.fromNodeId);
            const toNode   = nodes.find(n => n.id === edge.toNodeId);
            if (!fromNode || !toNode) return null;
            const x1 = fromNode.x + 70, y1 = fromNode.y + 30;
            const x2 = toNode.x + 70,   y2 = toNode.y + 30;
            const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
            const isMod = edge.type === 'moderating';
            return (
              <g key={edge.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMod ? 'var(--ds-chart-5)' : 'var(--ds-chart-4)'}
                  strokeWidth={2}
                  strokeDasharray={edge.type === 'mediating' ? '5,5' : '0'}
                  markerEnd={isMod ? 'url(#arrow-mod)' : 'url(#arrow-v2)'}
                />
                <g transform={`translate(${midX - 12}, ${midY - 12})`}>
                  <circle r={12} cx={12} cy={12} fill={isMod ? 'var(--ds-chart-5)' : 'var(--ds-chart-4)'} />
                  <text x={12} y={16} fill="#ffffff" fontSize={9} fontWeight="bold" textAnchor="middle">
                    {edge.hypothesisCode}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Draggable nodes */}
        {nodes.map((node) => {
          const variable = activeProject.variables.find(v => v.id === node.variableId);
          if (!variable) return null;
          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              style={{ left: node.x, top: node.y }}
              className={`absolute w-36 h-[60px] border-2 rounded-lg flex flex-col justify-center items-center px-2 py-1 select-none shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow z-10 ${getVariableTypeColor(variable.type)}`}
            >
              <span className="text-[9px] uppercase font-black tracking-wider opacity-60">
                {variable.type}
              </span>
              <span className="text-xs font-bold text-[var(--ds-text-primary)] text-center truncate w-full mt-0.5">
                {language === 'ar' ? variable.nameAr : variable.nameEn}
              </span>
            </div>
          );
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--ds-text-muted)]">
            <GitFork size={32} className="opacity-30" />
            <p className="text-xs font-semibold opacity-50">
              {language === 'ar' ? 'أضف متغيرات للمشروع لتظهر هنا تلقائياً' : 'Add variables to the project to visualize them here'}
            </p>
          </div>
        )}
      </div>

      {/* Edges / paths list */}
      {edges.length > 0 && (
        <Card className="p-5 space-y-3">
          <h4 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
            {language === 'ar' ? 'قائمة الفرضيات والمسارات المعرفة بالمشروع' : 'Hypotheses & Defined Path Lines'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {edges.map((e) => (
              <div
                key={e.id}
                className="flex justify-between items-center p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg text-xs font-semibold text-[var(--ds-text-secondary)]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="bg-action text-on-action w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px]">
                    {e.hypothesisCode}
                  </span>
                  <span className="truncate max-w-[60px]">{getVariableLabel(nodes.find(n => n.id === e.fromNodeId)?.variableId || '')}</span>
                  <ArrowRight size={12} className="shrink-0" />
                  <span className="truncate max-w-[60px]">{getVariableLabel(nodes.find(n => n.id === e.toNodeId)?.variableId || '')}</span>
                </div>
                <button
                  onClick={() => deleteEdge(e.id)}
                  className="text-danger hover:text-danger cursor-pointer transition-colors shrink-0"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
