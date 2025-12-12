const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function extractTasksFromMarkdown(filePath) {
    const markdownContent = fs.readFileSync(filePath, 'utf-8');
    const taskRegex = /<details[^>]*?>([\s\S]*?)<\/details>/g;
    let match;
    while ((match = taskRegex.exec(markdownContent)) !== null) {
        console.log('Task found:', match[1]);
    }
}

function extractJsonFromCodeBlock(codeBlock) {
    const jsonStartMarker = '
