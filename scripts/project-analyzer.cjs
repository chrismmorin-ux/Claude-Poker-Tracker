#!/usr/bin/env node
/**
 * project-analyzer.cjs - Analyze a project file and return next steps
 *
 * Usage: node scripts/project-analyzer.cjs <project-slug-or-number>
 *
 * Output JSON:
 * {
 *   "status": "complete" | "in_progress" | "not_found",
 *   "project": { name, filename, status },
 *   "phases": { total, complete, current },
 *   "nextSteps": [...],  // If in_progress
 *   "closeout": {...}    // If complete
 * }
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'docs', 'projects');
const ARCHIVE_DIR = path.join(__dirname, '..', 'docs', 'archive');

function findProject(query) {
  const files = fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.match(/^\d+\.\d+\.\d+-.*\.project\.md$/))
    .sort();

  // If query is a number, find by position (1-indexed)
  if (/^\d+$/.test(query)) {
    const index = parseInt(query, 10) - 1;
    const activeProjects = files.map(f => {
      const content = fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8');
      const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
      const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
      return { filename: f, status, isActive: status.includes('Active') };
    }).filter(p => p.isActive || p.status.includes('NEXT'));

    if (index === 0 && activeProjects.length > 0) {
      return activeProjects[0].filename;
    }
    if (index === 1 && activeProjects.length > 1) {
      return activeProjects[1].filename;
    }
    // Fall back to position in all projects
    return files[index] || null;
  }

  // Search by slug
  const slug = query.toLowerCase().replace(/\s+/g, '-');
  return files.find(f => f.toLowerCase().includes(slug)) || null;
}

function analyzeProject(filename) {
  const filepath = path.join(PROJECTS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');

  // Extract metadata
  const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
  const nameMatch = content.match(/^#\s+(.+)/m);

  const projectStatus = statusMatch ? statusMatch[1].trim() : 'Unknown';
  const projectName = nameMatch ? nameMatch[1].trim() : filename;

  // Find all implementation phases
  // Handles: "## Phase 1:", "### Phase 1:", "## Phase 1: Name [COMPLETE]", "## Phase 1: Name [x] COMPLETE", "## Phase 1: Name ✅ COMPLETE"
  const phasePattern = /##\s*#?\s*Phase\s+(\d+|[A-Z])[:\s]+([^\n]+)/gi;
  const phases = [];
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseTitle = match[2].trim();

    // Skip test sections (e.g., "Phase 1 Tests", "Phase 2 Tests")
    if (/^tests?\s*$/i.test(phaseTitle.replace(/\[.*\]|✅|COMPLETE/gi, '').trim())) continue;

    // Detect completion markers: ✅, [COMPLETE], [x] COMPLETE, [x], <- COMPLETE
    const isComplete = /✅|COMPLETE|\[x\]/i.test(phaseTitle);
    const isCurrent = /<-\s*CURRENT/i.test(phaseTitle);

    // Get phase content (until next phase or end)
    const phaseStart = match.index;
    const nextPhaseMatch = content.slice(phaseStart + match[0].length).match(/##\s*#?\s*Phase\s+(\d+|[A-Z])/i);
    const phaseEnd = nextPhaseMatch
      ? phaseStart + match[0].length + nextPhaseMatch.index
      : content.length;
    const phaseContent = content.slice(phaseStart, phaseEnd);

    // Find incomplete tasks in this phase
    const incompleteTasks = [];
    const taskPattern = /- \[ \]\s+(.+)/g;
    let taskMatch;
    while ((taskMatch = taskPattern.exec(phaseContent)) !== null) {
      incompleteTasks.push(taskMatch[1].trim());
    }

    // Clean up title - remove completion markers
    const cleanTitle = phaseTitle
      .replace(/✅\s*/g, '')
      .replace(/\[x\]\s*/gi, '')
      .replace(/\[COMPLETE\]\s*/gi, '')
      .replace(/COMPLETE\s*/gi, '')
      .replace(/<-\s*CURRENT\s*/gi, '')
      .trim();

    phases.push({
      number: phaseNum,
      title: cleanTitle,
      isComplete,
      isCurrent,
      incompleteTasks
    });
  }

  const completePhases = phases.filter(p => p.isComplete).length;
  const totalPhases = phases.length;
  // Prefer explicitly marked current phase, otherwise first incomplete
  const currentPhase = phases.find(p => p.isCurrent) || phases.find(p => !p.isComplete);
  const allComplete = completePhases === totalPhases && totalPhases > 0;

  // Find unchecked items in file checklist or testing plan
  const uncheckPattern = /- \[ \]\s+(.+)/g;
  const allUnchecked = [];
  while ((match = uncheckPattern.exec(content)) !== null) {
    allUnchecked.push(match[1].trim());
  }

  // Build result
  const result = {
    status: allComplete ? 'complete' : 'in_progress',
    project: {
      name: projectName,
      filename,
      filepath,
      status: projectStatus
    },
    phases: {
      total: totalPhases,
      complete: completePhases,
      current: currentPhase ? currentPhase.number : null,
      list: phases
    }
  };

  if (allComplete) {
    result.closeout = {
      message: 'All phases are complete. This project should be closed out.',
      steps: [
        'Verify all functionality works as expected',
        'Update project status from "Active" to "Complete"',
        'Update BACKLOG.md to remove/archive this project',
        'Check off any remaining checklist items',
        'Create a brief summary of what was accomplished'
      ],
      uncheckedItems: allUnchecked.length,
      statusNeedsUpdate: projectStatus.includes('Active')
    };
  } else {
    result.nextSteps = {
      phase: currentPhase ? currentPhase.number : 1,
      phaseTitle: currentPhase ? currentPhase.title : 'Unknown',
      tasks: currentPhase ? currentPhase.incompleteTasks : allUnchecked.slice(0, 5),
      message: currentPhase
        ? `Continue with Phase ${currentPhase.number}: ${currentPhase.title}`
        : 'Review unchecked items in the project file'
    };
  }

  return result;
}

// Analyze archived project by filename
function analyzeArchivedProject(filename) {
  const filepath = path.join(ARCHIVE_DIR, filename);
  if (!fs.existsSync(filepath)) return null;

  const content = fs.readFileSync(filepath, 'utf8');

  // Use same analysis logic but with archive filepath
  const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
  const nameMatch = content.match(/^#\s+(.+)/m);

  const projectStatus = statusMatch ? statusMatch[1].trim() : 'Unknown';
  const projectName = nameMatch ? nameMatch[1].trim() : filename;

  const phasePattern = /##\s*#?\s*Phase\s+(\d+|[A-Z])[:\s]+([^\n]+)/gi;
  const phases = [];
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseTitle = match[2].trim();
    if (/^tests?\s*$/i.test(phaseTitle.replace(/\[.*\]|✅|COMPLETE/gi, '').trim())) continue;

    const isComplete = /✅|COMPLETE|\[x\]/i.test(phaseTitle);
    const isCurrent = /<-\s*CURRENT/i.test(phaseTitle);

    const cleanTitle = phaseTitle
      .replace(/✅\s*/g, '')
      .replace(/\[x\]\s*/gi, '')
      .replace(/\[COMPLETE\]\s*/gi, '')
      .replace(/COMPLETE\s*/gi, '')
      .replace(/<-\s*CURRENT\s*/gi, '')
      .trim();

    phases.push({ number: phaseNum, title: cleanTitle, isComplete, isCurrent });
  }

  return {
    project: { name: projectName, filename, status: projectStatus },
    phases: { total: phases.length, complete: phases.filter(p => p.isComplete).length, list: phases }
  };
}

// Main
const query = process.argv[2];
const testArchive = process.argv[3] === '--archive';

if (!query) {
  console.error('Usage: node scripts/project-analyzer.cjs <project-slug-or-number> [--archive]');
  process.exit(1);
}

if (testArchive) {
  // Test mode: analyze an archived project
  try {
    const archiveFiles = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.project.md'));
    const file = archiveFiles.find(f => f.toLowerCase().includes(query.toLowerCase()));
    if (file) {
      const analysis = analyzeArchivedProject(file);
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      console.log(JSON.stringify({ status: 'not_found', query }, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

const filename = findProject(query);
if (!filename) {
  console.log(JSON.stringify({ status: 'not_found', query }, null, 2));
  process.exit(0);
}

const analysis = analyzeProject(filename);
console.log(JSON.stringify(analysis, null, 2));
