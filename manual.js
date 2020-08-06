const MBox = require('node-mbox');
const MailParser  = require('mailparser').MailParser;
const process = require('process');
const devnull = require('dev-null');

let allTime = {}; // Key: from sender, value: count
let recent = {};
let numRead = 0;
let numProcessed = 0;
let pendingAttachments = 0;

let RECENT_THRESHOLD = Date.now() - 30*24*60*60*1000;
let NUM_REPORT = 50;

let COMPLETED = false;
const mbox = new MBox('Inbox.mbox');
mbox.on('message', onMessage);
mbox.on('end', () => {
  COMPLETED = true;
  report();
});
mbox.on('error', (e) => {
  console.log(["Error with MBox parsing", e]);
  process.exit();
});
// READ notion

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
    let promises = [processHeaders, processAttachment].map((x) => x.call(null, mp));
    // homework: why doesn't await work here?
    /*
    let headers = await processHeaders(mp);
    console.log('headers taken');
    let attachments = await processAttachment(mp);
    */

    //console.log(['ERROR', headers, attachments]);
    Promise.all(promises).then((ps) => {
      console.log(["### RESULTS"].concat(ps));
      if (ps[0][1] == 'Life Planning Exercises' ) {
        process.exit();
      }
    }).catch((error) => {
      console.log(['ERROR', error]);
    });
    // 1. confirm size is correct
    // 2. try to track size by sender
    mp.write(msg);
    mp.end();
};

let reported = false;
function report() {
  if (numRead != numProcessed) {
    return;
  }
  if (reported) return;
  if (!COMPLETED) return;
  reported = true;
  console.log ([numProcessed, 'processed.', numRead, 'read.'].join(' '));
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

  console.log("### RECENT");
  for (let i = 0; i <= NUM_REPORT; i++) {
    console.log([i, sortedRecent[i], recent[ sortedRecent[i] ] ].join(' '));
  }

  console.log("### ALL TIME");
  for (let i = 0; i <= NUM_REPORT; i++) {
    console.log([i, sortedAllTime[i], allTime[ sortedAllTime[i] ] ].join(' '));
  }

}
