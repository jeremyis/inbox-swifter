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

function commandLineInput(text) {
  return new Promise ((resolve, reject) => {
    READ_LINE_INTERFACE.question([text, ": "].join(''), (...args) => resolve.apply(null, args));
  });
}
function startup() {
  let args = process.argv.slice(2);
  let file = args.length > 0 ? args[0] : null;

  let msg = [
    "How many unique senders do you want to limit the analysis to? ",
    "Default is ",  NUM_REPORT
  ].join('');
  let input = commandLineInput(msg)
    .then( (v) => NUM_REPORT = v == null || v.trim().length == 0 ? NUM_REPORT : parseInt(v.trim()) )
    .catch( (e) => console.log(e));

  if (file) {
    input
      .then(() => processFile(file))
      .catch( (e) => console.log(e));
    return;
  }
  input
    .then( () => commandLineInput("Path to mbox file? Default is './Inbox.mbox'") )
    .then( (file) => {
      if ((file || '').trim().length == 0) {
        file = 'Inbox.mbox';
      }
      processFile(file);
    })
    .catch( (e) => console.log(e));
}

function processFile(file) {
  console.log(["\n", 'Processing file "', file, '"......'].join(''));
  const mbox = new MBox(file);
  mbox.on('message', onMessage);
  mbox.on('end', () => {
    console.log("Completed reading file. Processing could still be in progress.");
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
      if (date > RECENT_THRESHOLD) {
        if (!recent[from]) {
          recent[from] = 0;
        }
        recent[from]++;
      }
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
    mp.on('error', (e) => {
      console.log("ERROR");
      console.log(e);
    })
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
function onMessage(msg) {
    numRead++;
    let mp = new MailParser({streamAttachments: true});
    /*
    let promises = [processHeaders];
    //promises.push(processAttachment);

    //console.log(['ERROR', headers, attachments]);
    promises.map((x) => x.call(null, mp));
    Promise.all(promises).then((ps) => {
      //console.log(["### RESULTS"].concat(ps));
      // 1. confirm size is correct
      // 2. try to track size by sender

      // Since processing takes time and we're async, we could need to process here;
      // we've read all messages and the last processing took some time.
      report(() => process.exit());
    }).catch((error) => {
      console.log(['ERROR', error]);
    });
    */
    processHeaders(mp).then((x) => {
      report(() => process.exit());
    }).catch((error) => {
      console.log(['ERROR processingHeaders', error]);
    });
    mp.write(msg);
    mp.end();
};

let reported = false;
function report(completedCb) {
  //console.log(['report', numRead, numProcessed, reported, COMPLETED]);
  if (numRead != numProcessed) {
    return;
  }
  if (reported) return;
  if (!COMPLETED) return;

  if (!completedCb) {
    completedCb = () => {};
  }

  reported = true;
  console.log ([numProcessed, 'processed.', numRead, 'read.'].join(' '));
  if (numProcessed == 0) {
    completedCb();
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

  let numRecent = 50;
  console.log("\n### RECENT (Top " + numRecent + ")");
  for (let i = 0; i <= numRecent; i++) {
    console.log([i, sortedRecent[i], recent[ sortedRecent[i] ] ].join(' '));
  }

  console.log("\n### ALL TIME");
  for (let i = 0; i <= NUM_REPORT; i++) {
    let id = ['#', i, ')'].join('');
    console.log([id, sortedAllTime[i], allTime[ sortedAllTime[i] ] ].join(' '));
  }
  makeAndPrintHistogram(allTime, sortedAllTime);

  gmailFilterCommand(sortedAllTime, completedCb);
}

function makeAndPrintHistogram(counts, sortedKeys) {
  let histogramBoundaries = [0, 2, 5, 10, 20, 50];
  let histogram = new Array(histogramBoundaries.length).fill(0);
  let totalEmails = new Array(histogramBoundaries.length).fill(0);
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
    totalEmails[minI] += num;
  });

  let numOfemails = totalEmails.reduce((a, b) =>  a + b, 0);
  let percentages = totalEmails.map((t) => ((100.0)*t/numOfemails));
  let percentagesFormatted = percentages.map((n) => [n.toFixed(2), '%'].join(''));
  // Print histogram
  console.log("\n## Histogram");
  console.log("Binned by # of emails from this email address");
  console.log("Values are # of emails in the bin and % of total emails this accounts for");
  let prettyBoundaries = histogramBoundaries.concat(['inf']);
  for (let i = 0; i < prettyBoundaries.length - 1; i++) {
    console.log([
        [prettyBoundaries[i], prettyBoundaries[i+1]].join('-'),
        ': ', histogram[i],
        ' (', percentagesFormatted[i], ')'
      ].join('')
    );
  }
}

function gmailFilterCommand(sortedEmails, completedCb) {
  let INCLUDE_KEYWORD
  let directions = [
    "\n\n",
    'Please indicate which items you\'d like to exclude from the filter statement.',
    "If you'd like to supply a list of included items only, put '", INCLUDE_KEYWORD,  "' first.",
    'Separate the list with non-alphanumeric characters. The IDs should be positive integers'
  ].join(' ')

  commandLineInput(directions).then( (list) => {
    let excludeList = true;
    let onlyIds = [];
    list.split(/[^A-Za-z0-9]/).forEach((val) => {
      if (_.isString(val) && val.trim() == INCLUDE_KEYWORD) {
        excludeList = false;
        return;
      }
      val = parseInt(val);
      if (!_.isNumber(val)) {
        console.log(['Warning "', val, '" is not a valid ID'].join(''));
        return;
      }
      onlyIds.push(val);
    });
    let ids = onlyIds;
    if (excludeList) {
      let indices = _.range(0, Math.min(NUM_REPORT + 1, sortedEmails.length));
      ids = _.without(indices, ...onlyIds);
    }

    let getFilterCommands = (ids) => {
      let fromString = 'from:';
      let froms = ids.map((x) => [ fromString, sortedEmails[x] ].join(''));

      let length = 30;
      let results = [];
      for (let i = 0; i < froms.length; i += length) {
        let subFroms = froms.slice(i, i + length);
        results.push(
          ['in:inbox AND (', fromString, subFroms.join(' OR '), ')'].join('')
        );
      }

      return results;
    };

    let copy = [
      "Copy and paste the following command(s) into Gmail to search for ",
      "emails in your inbox from these senders.\n",
      "Note that the emails may be be split into multiple commands as google as a search limit.\n\n\n\n"
    ].join('')
    console.log(copy);
    console.log(getFilterCommands(ids).join("\n\n\n"));

    if (excludeList && onlyIds.length > 0) {
      console.log("\n\nAnd if you're curious, here's the command to see your excluded list:\n\n");
      console.log(getFilterCommands(onlyIds).join("\n\n"));
    }
    completedCb();
  });
}
