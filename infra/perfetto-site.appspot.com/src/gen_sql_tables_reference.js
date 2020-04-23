// Copyright (C) 2020 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Generation of reference from protos

'use strict';

const fs = require('fs');
const path = require('path');
const argv = require('yargs').argv

// Removes \n due to 80col wrapping and preserves only end-of-sentence line
// breaks.
// TODO dedupe, this is copied from the other gen_proto file.
function singleLineComment(comment) {
  comment = comment || '';
  comment = comment.trim();
  comment = comment.replace(/\.\n/g, '<br>');
  comment = comment.replace(/\n/g, ' ');
  return comment;
}

// Returns an object describing the table as follows:
// { name: 'HeapGraphObjectTable',
//   cols: [ {name: 'upid',            type: 'uint32_t', optional: false },
//           {name: 'graph_sample_ts', type: 'int64_t',  optional: false },
function parseTableDef(tableDefName, tableDef) {
  const tableDesc = {
    name: '',
    comment: '',
    cols: [],
  };
  let lastParam = null;
  const colComment = {};
  for (const line of tableDef.split('\n')) {
    if (line.startsWith('#define')) continue;  // Skip the first line.
    let m;
    if (line.startsWith('//')) {
      let comm = line.replace(/^\s*\/\/\s*/, '');
      if (m = comm.match(/@param ([^ ]+) (.*)/)) {
        lastParam = m[1];
        comm = m[2];
      }
      if (lastParam === null) {
        tableDesc.comment += `${comm}\n`;
      } else {
        colComment[lastParam] = `${colComment[lastParam] || ''}${comm}\n`;
      }
      continue;
    }
    if (m = line.match(/^\s*NAME\((\w+)\s*,/)) {
      tableDesc.name = m[1];
      continue;
    }
    if (m = line.match(/PERFETTO_TP_ROOT_TABLE|PARENT/)) {
      // TODO parent.
      continue;
    }
    if (m = line.match(/^\s*C\(([^,]+)\s*,\s*(\w+)/)) {
      let colType = m[1];
      let colName = m[2];
      let optional = false;
      if (m = colType.match(/Optional<(.*)>/)) {
        colType = m[1];
        optional = true;
      }
      if (colType === 'StringPool::Id') {
        colType = 'string';
      }
      tableDesc.cols.push({
        name: colName,
        type: colType,
        optional: optional,
        comment: colComment[colName] || '' });
      continue;
    }
    throw new Error(`Cannot parse line "${line}" from ${tableDefName}`);
  }
  return tableDesc;
}


function parseTablesInCppFile(filePath) {
  const hdr = fs.readFileSync(filePath, 'UTF8');
  const regex = /^\s*PERFETTO_TP_TABLE\((\w+)\)/mg;
  let match = regex.exec(hdr);
  const tables = [];
  while (match != null) {
    const tableDefName = match[1];
    match = regex.exec(hdr);

    // Now let's extract the table definition, that looks like this:
    // // Some
    // // Multiline
    // // Comment
    // #define PERFETTO_TP_STACK_PROFILE_FRAME_DEF(NAME, PARENT, C) \
    // NAME(StackProfileFrameTable, "stack_profile_frame")        \
    // PERFETTO_TP_ROOT_TABLE(PARENT, C)                          \
    // C(StringPool::Id, name)                                    \
    // C(StackProfileMappingTable::Id, mapping)                   \
    // C(int64_t, rel_pc)                                         \
    // C(base::Optional<uint32_t>, symbol_set_id)
    //
    // Where PERFETTO_TP_STACK_PROFILE_FRAME_DEF is |tableDefName|.
    let pattern = `(^[ ]*//.*\n)*`;
    pattern += `^\s*#define\\s+${tableDefName}\\s*\\(`;
    pattern += `(.*\\\\\\s*\n)+`;
    pattern += `.+`;
    const r = new RegExp(pattern, 'mi');
    const tabMatch = r.exec(hdr);
    if (!tabMatch) {
      console.error(`could not find table ${tableDefName}`);
      continue;
    }
    tables.push(parseTableDef(tableDefName, tabMatch[0]));
  }
  return tables;
}


function tableToMarkdown(table) {
  let md = `## ${table.name}\n\n`;
  md += table.comment + '\n\n';
  md += 'Column | Type | Optional | Description\n';
  md += '------ | ---- | -------- | -----------\n';
  for (const col of table.cols) {
    md += `${col.name} | ${col.type} | ${col.optional} | ${singleLineComment(col.comment)}\n`
  }
  md += '\n\n';
  return md;
}

function main() {
  const inFile = argv['i'];
  const outFile = argv['o'];
  if (!inFile) {
    console.error('Usage: -i hdr1.h -i hdr2.h -[-o out.md]');
    process.exit(1);
  }

  // Can be either a string (-i single) or an array (-i one -i two).
  const inFiles = (inFile instanceof Array) ? inFile : [inFile];

  const tables = Array.prototype.concat(...inFiles.map(parseTablesInCppFile));
  const md = String.prototype.concat(...tables.map(tableToMarkdown));
  if (outFile) {
    fs.writeFileSync(outFile, md);
  } else {
    console.log(md);
  }
  process.exit(0);
}

main();
