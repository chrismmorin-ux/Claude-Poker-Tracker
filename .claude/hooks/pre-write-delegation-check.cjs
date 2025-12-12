/** 
 * Pre Write Delegation Check Hook - Checks if a file has been assigned locally or remotely before writing it out
 */
const fs = require('fs');
const path = require('path');

function isFileAssignedToLocalModel(projectContent, filePath) {
    const basename = path.basename(filePath);
    
    // Parse project content for task tables and check if file basename matches a local model assignment in the 'Task' or 'Owner:' fields
    let match;
    const lines = projectContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        // Look for Task | ... | Model: deepseek, qwen, local:* in the current line and check if it's assigned to this file basename
        match = lines[i].match(/\|?\s*Task\s*\|\s*(.*?)\s*\|\s*Model:\s*(deepseek|qwen|local:[^\|]*${basename}[^\|]*)\s*\|?(?:Status: .*)?/i);
        if (match) {
            return { assigned: true, taskId: match[1], model: match[2] };
        }
    }
    
    // If no local assignment found, check for remote assignments in the 'Model' column of a table row that mentions this file basename
    const pattern = new RegExp(`\\|[^|]*${basename.replace(/\./g, '\\.')}[^|]*\\|[^|]*\\|([^|]*(deepseek|qwen)[^|]*\\|){2,}`, 'i');
    match = projectContent.match(pattern);
    if (match) {
        return { assigned: true, taskId: null, model: match[1] };
    }
    
    // If no assignment found at all
    return { assigned: false, taskId: null, model: null };
}
