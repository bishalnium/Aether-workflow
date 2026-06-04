import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace text
function replaceExactly(target, replacement) {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedTarget = target.replace(/\r\n/g, '\n');
  const normalizedReplacement = replacement.replace(/\r\n/g, '\n');
  
  const pos = normalizedContent.indexOf(normalizedTarget);
  if (pos === -1) {
    console.error(`ERROR: Target not found! Target preview:\n${target.substring(0, 150)}`);
    return false;
  }
  const secondPos = normalizedContent.indexOf(normalizedTarget, pos + 1);
  if (secondPos !== -1) {
    console.warn(`WARNING: Multiple matches found for target!`);
  }
  
  content = normalizedContent.replace(normalizedTarget, normalizedReplacement).replace(/\n/g, '\r\n');
  console.log(`Successfully replaced target.`);
  return true;
}

// 1. Replace getEdgePath definition (lines 1113-1117)
const oldGetEdgePath = `const getEdgePath = (source: Position, target: Position) => {
  const deltaX = target.x - source.x;
  const controlPointX = deltaX * 0.5;
  return \`M\${source.x},\${source.y} C\${source.x + controlPointX},\${source.y} \${target.x - controlPointX},\${target.y} \${target.x},\${target.y}\`;
};`;

const newGetEdgePath = `const getEdgePath = (
  source: Position, 
  target: Position, 
  sourceSide: 'left' | 'right' | 'top' | 'bottom' = 'right', 
  targetSide: 'left' | 'right' | 'top' | 'bottom' = 'left'
) => {
  const isSourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
  const isTargetHorizontal = targetSide === 'left' || targetSide === 'right';
  
  if (isSourceHorizontal && isTargetHorizontal) {
    const deltaX = target.x - source.x;
    const controlPointX = Math.max(30, Math.abs(deltaX) * 0.5);
    const sourceCPX = sourceSide === 'right' ? source.x + controlPointX : source.x - controlPointX;
    const targetCPX = targetSide === 'left' ? target.x - controlPointX : target.x + controlPointX;
    return \`M\${source.x},\${source.y} C\${sourceCPX},\${source.y} \${targetCPX},\${target.y} \${target.x},\${target.y}\`;
  } else {
    const deltaY = target.y - source.y;
    const controlPointY = Math.max(30, Math.abs(deltaY) * 0.5);
    const sourceCPY = sourceSide === 'bottom' ? source.y + controlPointY : source.y - controlPointY;
    const targetCPY = targetSide === 'top' ? target.y - controlPointY : target.y + controlPointY;
    return \`M\${source.x},\${source.y} C\${source.x},\${sourceCPY} \${target.x},\${targetCPY} \${target.x},\${target.y}\`;
  }
};`;

console.log('Replacing getEdgePath definition...');
replaceExactly(oldGetEdgePath, newGetEdgePath);

// 2. Add connectingSide state variable and showHelpFor state (around lines 1120-1130)
const oldStates = `  // --- STATE ---
  const [zoom, setZoom] = useState<number>(1);`;

const newStates = `  // --- STATE ---
  const [zoom, setZoom] = useState<number>(1);
  const [connectingSide, setConnectingSide] = useState<'left' | 'right' | 'top' | 'bottom'>('right');
  const [showHelpFor, setShowHelpFor] = useState<string | null>(null);`;

console.log('Adding state variables...');
replaceExactly(oldStates, newStates);

// 3. Replace handleMouseDownHandle and handleMouseUpHandle
const oldEventHandlers = `  // Track which endpoint we're connecting from
  const [connectingEndpoint, setConnectingEndpoint] = useState<number>(0);

  const handleMouseDownHandle = (e: React.MouseEvent, nodeId: string, endpointIdx: number = 0) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setConnectingNodeId(nodeId);
    setConnectingEndpoint(endpointIdx);
    // Initial mouse pos in World Space
    setMousePos({ 
      x: (e.clientX - canvasRect.left) / zoom - pan.x, 
      y: (e.clientY - canvasRect.top) / zoom - pan.y 
    });
  };

  const handleMouseUpHandle = (e: React.MouseEvent, targetNodeId: string, targetEndpointIdx: number = 0) => {
      e.stopPropagation();
      if (connectingNodeId && connectingNodeId !== targetNodeId) {
          const exists = edges.find(e => e.source === connectingNodeId && e.target === targetNodeId && e.sourceEndpoint === connectingEndpoint && e.targetEndpoint === targetEndpointIdx);
          if (!exists) {
            const newEdge: WorkflowEdge = {
                id: \`e-\${connectingNodeId}-\${connectingEndpoint}-\${targetNodeId}-\${targetEndpointIdx}\`,
                source: connectingNodeId,
                target: targetNodeId,
                sourceEndpoint: connectingEndpoint,
                targetEndpoint: targetEndpointIdx,
            };
            setEdges([...edges, newEdge]);
            addLog('success', \`Connected nodes\`);
          }
      }
      setConnectingNodeId(null);
      setConnectingEndpoint(0);
  };`;

const newEventHandlers = `  // Track which endpoint we're connecting from
  const [connectingEndpoint, setConnectingEndpoint] = useState<number>(0);

  const handleMouseDownHandle = (e: React.MouseEvent, nodeId: string, endpointIdx: number = 0, side: 'left' | 'right' | 'top' | 'bottom' = 'right') => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setConnectingNodeId(nodeId);
    setConnectingEndpoint(endpointIdx);
    setConnectingSide(side);
    // Initial mouse pos in World Space
    setMousePos({ 
      x: (e.clientX - canvasRect.left) / zoom - pan.x, 
      y: (e.clientY - canvasRect.top) / zoom - pan.y 
    });
  };

  const handleMouseUpHandle = (e: React.MouseEvent, targetNodeId: string, targetEndpointIdx: number = 0, side: 'left' | 'right' | 'top' | 'bottom' = 'left') => {
      e.stopPropagation();
      if (connectingNodeId && connectingNodeId !== targetNodeId) {
          const exists = edges.find(e => 
            e.source === connectingNodeId && 
            e.target === targetNodeId && 
            e.sourceEndpoint === connectingEndpoint && 
            e.targetEndpoint === targetEndpointIdx &&
            (e.sourceSide || 'right') === connectingSide &&
            (e.targetSide || 'left') === side
          );
          if (!exists) {
            const newEdge: WorkflowEdge = {
                id: \`e-\${connectingNodeId}-\${connectingSide}-\${connectingEndpoint}-\\text{\${targetNodeId}}-\${side}-\${targetEndpointIdx}\`.replace(/\\\\/g, ''),
                source: connectingNodeId,
                target: targetNodeId,
                sourceEndpoint: connectingEndpoint,
                targetEndpoint: targetEndpointIdx,
                sourceSide: connectingSide,
                targetSide: side,
            };
            setEdges([...edges, newEdge]);
            addLog('success', \`Connected nodes\`);
          }
      }
      setConnectingNodeId(null);
      setConnectingEndpoint(0);
  };`;

console.log('Replacing connection handlers...');
replaceExactly(oldEventHandlers, newEventHandlers);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
