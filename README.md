# Inbox Swifter
Email analytics on [.MBOX dump files](https://en.wikipedia.org/wiki/Mbox) to help you get to Inbox Zero without declarig bankruptcy. The idea is
many unread emails are likely from a long-tail of transactional or promotional senders (think Uber and Amazon receipts or the monthly ad email from the various stores you've shopped at). By performing some lightweight analytics, the tool will spit out some Gmail search queries that you can use to "declare bankruptcy" only on emails like this leaving only the unique messages for you to review. 

- Produces a histogram bucketed by sender
- Allows you to omit certain emailers (i.e. so you can manually review their emails)
- Supplies Gmail-friendly filter commands so you can auto-archive quickly
- Runs **100% offline so your personal email data never leaves your computer**



## To setup:
$ npm install

## To run

### Step 1: get a .mbox export 
You can get an MBox file of your Inbox email using [Google Takeout](https://takeout.google.com/settings/takeout). 

Be sure to indicate **only emails from your inbox** (or whichever set of filters you'd like to clean):
![Google Takeout Screenshot](https://user-images.githubusercontent.com/184923/91684594-ce35f900-eb0c-11ea-81d8-56d6442efb20.png)

It can take anywhere from several minutes to hours to get your export. Google will email you a link.

### Step 2: run Inbox Swifter!
For ease of use, put the mbox file in the `inbox-swifter` directory; you can supply a file path so any directory will work.
$ node inbox-swifter.js

## In action
Note that the data is obviously faked!
![Screenshot](https://user-images.githubusercontent.com/184923/91683874-a6459600-eb0a-11ea-9881-b3409cd56415.png)
