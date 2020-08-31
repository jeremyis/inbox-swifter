# Inbox Swifter
Email analytics on [.MBOX dump files](https://en.wikipedia.org/wiki/Mbox) to help you get to Inbox Zero:

- Produces a histogram bucketed by sender
- Allows you to omit certain emailers (i.e. so you can manually review their emails)
- Supplies Gmail-friendly filter commands so you can auto-archive quickly
- Runs **100% offline so your personal email data never leaves your computer**

You can get an MBox file of your Inbox email using Google Takeout. Be sure to indicate only emails from your inbox:
https://takeout.google.com/settings/takeout

## To setup:
$ npm install

## To run
$ node inbox-swifter.js

## In action
Note that the data is obviously faked!
![Screenshot](https://user-images.githubusercontent.com/184923/91683874-a6459600-eb0a-11ea-9881-b3409cd56415.png)
