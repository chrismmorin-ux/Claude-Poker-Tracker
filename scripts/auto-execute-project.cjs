const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const showdown  = require('showdown');
const Ajv = require('ajv');
const ajv = new Ajv();

// Local Task Schema for validation
const localTaskSchema = {
    type: 'object',
    properties: {
        taskName: { type: 'string' },
        description: { type: 'string' },
        assignee: { type: 'string' }
    },
    required: ['taskName']
};

// CLI argument for project name
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide a project name as an argument');
    process.exit(1);
}
const projectName = args[0];

// Path to the Project file
let filePath;
try {
    filePath = path.join(__dirname, 'docs', 'projects', `${projectName}.md`);
    if (!fs.existsSync(filePath)) throw new Error();
} catch (e) {
    console.error(`Project ${projectName} not found.`);
    process.exit(1);
}

// Read and parse the markdown file for <details> sections with JSON blocks 
const converter = new showdown.Converter();
let rawMd;
try {
    const mdBuffer = fs.readFileSync(filePath, 'utf8');
    rawMd = converter.makeHtml(mdBuffer);
} catch (e) {
    console.error('Failed to read or parse the project file.');
    process.exit(1);
}

// Extract JSON blocks from <details> sections 
const tasksRegex = /<details>([\s\S]*?)<\/details>/g;
let match, taskSpecsArray = [];
while ((match = tasksRegex.exec(rawMd)) !== null) {
    const detailsContent = match[1]; // content inside the <details> tag 
    
    if (/\`\`\`json([\s\S]*?)<\/code>/g.test(detailsContent)) {
        taskSpecsArray.push({...JSON.parse($2)});
    } else console.warn('No JSON block found in details section.');
}
if (!taskSpecsArray.length) process.exit(1); // No tasks to execute 

// Validate extracted specs against local-tasks schema and convert them into LOCAL_TASKS format  
const validatedTasks = taskSpecsArray.filter((spec, index)=>{
    const validSpec = ajv.validate(localTaskSchema, spec);
    if (!validSpec) console.error(`Invalid Task Spec at position ${index}`); 
    return validSpec; // Only include the specs that pass validation in final array  
}).map(task => `///LOCAL_TASKS\n${JSON.stringify(task)}\n`);
if(!validatedTasks.length){console.log('No tasks to execute');process.exit(1);} 
// No valid task specifications found after conversion and filtering, so exit script  

// Pipe the converted specs into dispatcher for execution via child_process   
const pipeToDispatcher = (data) => {
    const processExec = exec('./dispatcher.cjs add-tasks', (error, stdout, stderr) => {
        if (error) console.log(`exec error: ${error}`); 
        else console.log(`stdout: ${stdout}`);
        assignNextTasks(); // Call dispatcher to allocate next tasks after each successful execution  
    });
     processExec.stdin.write(data);
     processExec.stdin.end();
}
const data = validatedTasks.join('\n'); 
pipeToDispatcher(data);
