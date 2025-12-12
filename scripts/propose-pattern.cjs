// Import required modules
const fs = require('fs');
const natural = require('natural');
const levenshtein = require('fast-levenshtein');

// Read task log file
let data = fs.readFileSync('.claude/logs/local-model-tasks.log', 'utf8');
let lines = data.split('\n').filter(Boolean); // Filter out empty strings from array of logs

const errorSignatures = [];
for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes('ERROR')) {
        const signature = natural.JaroWinkler.get(lines[i], 'Error'); // Get the similarity score between current line and "error" string using Jaro-Winkler algorithm
        errorSignatures.push({signature: lines[i], index: i}); 
    }
}
// Sort by signature in descending order (highest first)
const sorted = errorSignatures.sort((a, b) => { return a.similarity - b.similarity; });
sorted.reverse(); // Reverse to get highest similarity at the top of array

let patternsToPropose = [];
for(let i=0;i<lines.length-1;i++){
    if (levenshtein.get(lines[i], lines[i+1]) < 5) { // If levenshtein distance between current line and next is less than a certain threshold, consider them similar failures
        patternsToPropose.push({line: lines[i], count: i});
    } else if (patternsToPropose.length >= 2){
        break;
    }
}
if(patternsToPropose.length < 2) { // If no new pattern detected, output 'No new patterns detected' and exit the program
    console.log('No new patterns detected');
    process.exit();
} else {
// Output JSON proposal for human review based on failure-pattern schema template
const jsonOutput = `{ "proposedPattern": "${patternsToPropose[0].line}", 
"similarFailuresCount": ${patternsToPropose.length}, 
"failureLogs": [${patternsToPropose.map(p => JSON.stringify(p)).join(',')}] }`;
console.log(jsonOutput); // Output to stdout
}
