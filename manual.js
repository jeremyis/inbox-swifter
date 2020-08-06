const _ = require('lodash');
const MBox = require('node-mbox');
const MailParser  = require('mailparser').MailParser;
const devnull = require('dev-null');
const process = require('process');
const readline = require('readline');

let allTime = {}; // Key: from sender, value: count
let recent = {};
let numRead = 0;
let numProcessed = 0;
let pendingAttachments = 0;

let RECENT_THRESHOLD = Date.now() - 30*24*60*60*1000;
let NUM_REPORT = 100;

let COMPLETED = false;

const READ_LINE_INTERFACE = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

startup();

function startup() {
  let args = process.argv.slice(2);
  let file = args.length > 0 ? args[0] : null;

  if (file) {
    processFile(file)
    return;
  }

  READ_LINE_INTERFACE.question("Path to mbox file? Default is './Inbox.mbox': ", (file) => {
    if ((file || '').trim().length == 0) {
      file = 'Inbox.mbox';
    }
    processFile(file);
  })
}

function processFile(file) {
  console.log(['Processing file ', file, '......'].join(''));
  const mbox = new MBox(file);
  mbox.on('message', onMessage);
  mbox.on('end', () => {
    COMPLETED = true;
    report(() => process.exit());
  });
  mbox.on('error', (e) => {
    console.log(["Error with MBox parsing", e]);
    process.exit();
  });
}

function processHeaders(mp) {
  return new Promise((resolve, reject) => {
    mp.on('headers', function(headers) {
      numProcessed++;
      report();
      if (numProcessed % 1000 == 0) {
        console.log ([numProcessed, 'processed.', numRead, 'read.'].join(' '));
      }

      let from = headers.get('from').value[0].address;
      //console.log(headers.get('subject'));
        // 2020-01-16T17:03:19.000Z,

      if (!allTime[from]) {
        allTime[from] = 0;
      }
      allTime[from]++;

      let date = headers.get('date');
      if (date < RECENT_THRESHOLD) {
        return;
      }
      if (!recent[from]) {
        recent[from] = 0;
      }
      recent[from]++;
      /*
      if (!!date && date) {
      }
      */
      /*
      // to is hard
      for (let v of ['to', 'delivered-to', 'bcc', 'cc']) {
        let to = headers.get(v);
        if (to != null) {
          if (v == 'delivered-to') {
            to = to[0];
          }
          console.log(to.value[0].address);
          break;
        }
      }
      */
      resolve([from, headers.get('subject')]);
    });
  })
}

function processAttachment(mp) {
  return new Promise((resolve, reject) => {
    mp.on('data', data => {
      pendingAttachments++;
      let size = null;
      if (data.type === 'attachment') {
        data.content.pipe(devnull());
        data.content.on('end', () =>{
          pendingAttachments--;
          // try to summarize
          data.release();
          size = data.size;
          resolve(size);
        });
      return;
      }

      let c = data.text != null ? data.text : data.html;
      if (!c) {
        return reject("No length content!!!");
      }
      size = c.length;
      return resolve(size);
      //console.log(data.text.length); // 2 bytes per char
      //console.log(data.size);
    });
  });
}
async function onMessage(msg) {
    numRead++;
    let mp = new MailParser({streamAttachments: true});
    let promises = [processHeaders];
    //promises.push(processAttachment);
    promises.map((x) => x.call(null, mp));

    //console.log(['ERROR', headers, attachments]);
    Promise.all(promises).then((ps) => {
      //console.log(["### RESULTS"].concat(ps));
    }).catch((error) => {
      console.log(['ERROR', error]);
    });
    // 1. confirm size is correct
    // 2. try to track size by sender
    mp.write(msg);
    mp.end();
};

let reported = false;
function report(completed) {
  if (numRead != numProcessed) {
    return;
  }
  if (reported) return;
  if (!COMPLETED) return;
  reported = true;
  console.log ([numProcessed, 'processed.', numRead, 'read.'].join(' '));
  if (numProcessed == 0) {
    completed();
    return;
  }
  console.log("Reporting...");
  let sortedAllTime = Object.keys(allTime).sort((a, b) => {
    let va = allTime[a];
    let vb = allTime[b];
    return vb - va;
  });
  let sortedRecent = Object.keys(recent).sort((a, b) => {
    let va = recent[a];
    let vb = recent[b];
    return vb - va;
  })

  console.log("\n### RECENT");
  for (let i = 0; i <= NUM_REPORT; i++) {
    console.log([i, sortedRecent[i], recent[ sortedRecent[i] ] ].join(' '));
  }

  console.log("\n### ALL TIME");
  for (let i = 0; i <= NUM_REPORT; i++) {
    let id = ['#', i, ')'].join('');
    console.log([id, sortedAllTime[i], allTime[ sortedAllTime[i] ] ].join(' '));
  }
  makeAndPrintHistogram(allTime, sortedAllTime);

  gmailFilterCommand();
  completed();
}

function makeAndPrintHistogram(counts, sortedKeys) {
  let histogramBoundaries = [0, 10, 20, 50];
  let histogram = new Array(histogramBoundaries.length).fill(0);
  let minI = histogramBoundaries.length - 1

  sortedKeys.forEach((email) => {
    // Keep in mind, these are sorted starting from the biggest;
    let min = histogramBoundaries[minI];
    let num = counts[email];
    while (num < min) {
      minI--;
      min = histogramBoundaries[minI];
    }
    histogram[minI]++;
  });

  // Print histogram
  let prettyBoundaries = histogramBoundaries.concat(['inf']);
  for (let i = 0; i < prettyBoundaries.length - 1; i++) {
    console.log([
        [prettyBoundaries[i], prettyBoundaries[i+1]].join('-'),
        ': ',
        histogram[i]
      ].join('')
    );
  }
}

function gmailFilterCommand() {
  let directions = [
    "\n\n",
    'Please indicate which items you\'d like to exclude from the filter statement.',
    "If you'd like to supply a list of included items only, put 'include' first.",
    'Separate the list with non-alphanumeric characters. The IDs should be positive integers: '
  ].join(' ')

  READ_LINE_INTERFACE.question(directions, (list) => {
    let excludeList = true;
    let onlyIds = [];
    list.split(/[^A-Za-z0-9]/).forEach((val) => {
      if (_.isString(val) && val.trim() == 'input') {
        excludeList = false;
        return;
      }
      if (!_.isNumber(val)) {
        console.log(['Warning "', val, '" is not a valid ID'].join(''));
        return;
      }
      onlyIds.push(val);
    });
    let ids = onlyIds;
    if (excludeList) {
      let indices = _.range(0, Math.min(NUM_REPORT + 1, allTime.length));
      ids = _.indices(indices, onlyIds);
    }

    let fromString = 'from:';
    let froms = onlyIds.map((x) => sortedAllTime[x]).join(fromString);
    froms = [fromString, froms].join('');

    let command = ['in:inbox AND (', froms.join(' OR '), ')'].join('');
    let copy = [
      "Copy and paste the following command into Gmail to search for ",
      "emails in your inbox from these senders"
    ].join('')
    console.log(copy);
    console.log(command);
  });
}
