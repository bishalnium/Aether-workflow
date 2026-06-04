import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

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

// 1. Replace Handles Block
const oldHandles = `                {/* Input Handles - Multiple */}
                {Array.from({ length: inputCount }).map((_, idx) => {
                  const yOffset = inputCount === 1 ? '50%' : \`\${20 + (60 / (inputCount)) * (idx + 0.5)}%\`;
                  return (
                    <div 
                      key={\`in-\${idx}\`}
                      className="absolute -left-3 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      style={{ top: yOffset, transform: 'translateY(-50%)' }}
                      onMouseUp={(e) => handleMouseUpHandle(e, node.id, idx)}
                      title={\`Input \${idx + 1}\`}
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-cherry transition-colors" />
                      {inputCount > 1 && (
                        <span className="absolute -left-3 text-[8px] text-gray-500 font-mono">{idx + 1}</span>
                      )}
                    </div>
                  );
                })}

                {/* Output Handles - Multiple */}
                {Array.from({ length: outputCount }).map((_, idx) => {
                  const yOffset = outputCount === 1 ? '50%' : \`\${20 + (60 / (outputCount)) * (idx + 0.5)}%\`;
                  return (
                    <div 
                      key={\`out-\${idx}\`}
                      className="absolute -right-3 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      style={{ top: yOffset, transform: 'translateY(-50%)' }}
                      onMouseDown={(e) => handleMouseDownHandle(e, node.id, idx)}
                      title={\`Output \${idx + 1}\`}
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-emerald-400 transition-colors" />
                      {outputCount > 1 && (
                        <span className="absolute -right-3 text-[8px] text-gray-500 font-mono">{idx + 1}</span>
                      )}
                    </div>
                  );
                })}`;

const newHandles = `                {/* Input Handles - Multiple */}
                {Array.from({ length: inputCount }).map((_, idx) => {
                  const yOffset = inputCount === 1 ? '50%' : \`\${20 + (60 / (inputCount)) * (idx + 0.5)}%\`;
                  return (
                    <div 
                      key={\`in-\${idx}\`}
                      className="absolute -left-3 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      style={{ top: yOffset, transform: 'translateY(-50%)' }}
                      onMouseUp={(e) => handleMouseUpHandle(e, node.id, idx, 'left')}
                      title={\`Input \${idx + 1}\`}
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-cherry transition-colors" />
                      {inputCount > 1 && (
                        <span className="absolute -left-3 text-[8px] text-gray-500 font-mono">{idx + 1}</span>
                      )}
                    </div>
                  );
                })}

                {/* Output Handles - Multiple */}
                {Array.from({ length: outputCount }).map((_, idx) => {
                  const yOffset = outputCount === 1 ? '50%' : \`\${20 + (60 / (outputCount)) * (idx + 0.5)}%\`;
                  return (
                    <div 
                      key={\`out-\${idx}\`}
                      className="absolute -right-3 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      style={{ top: yOffset, transform: 'translateY(-50%)' }}
                      onMouseDown={(e) => handleMouseDownHandle(e, node.id, idx, 'right')}
                      title={\`Output \${idx + 1}\`}
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-emerald-400 transition-colors" />
                      {outputCount > 1 && (
                        <span className="absolute -right-3 text-[8px] text-gray-500 font-mono">{idx + 1}</span>
                      )}
                    </div>
                  );
                })}

                {/* Integration Top (Config Input) Handle */}
                {(() => {
                  const isIntegration = node.data.category === 'Integrations' || node.data.category === 'Database';
                  return isIntegration && (
                    <div 
                      className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      onMouseUp={(e) => handleMouseUpHandle(e, node.id, 0, 'top')}
                      title="Config Input"
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-cherry transition-colors" />
                    </div>
                  );
                })()}

                {/* Integration Bottom (Config Output) Handle */}
                {(() => {
                  const isIntegration = node.data.category === 'Integrations' || node.data.category === 'Database';
                  return isIntegration && (
                    <div 
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50 group/handle"
                      onMouseDown={(e) => handleMouseDownHandle(e, node.id, 0, 'bottom')}
                      title="Config Output"
                    >
                      <div className="w-3 h-3 bg-black border-2 border-gray-500 rounded-full group-hover/handle:border-white group-hover/handle:bg-emerald-400 transition-colors" />
                    </div>
                  );
                })()}`;

console.log('Replacing node handles inside map...');
replaceExactly(oldHandles, newHandles);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Reconstruction phase 2 complete!');
