# Inbox Swifter
Email analytics on Email .MBOX dumps to help you get to Inbox Zero:

- Produces a histogram bucketed by sender
- Allows you to omit friendly emails
- Supplies Gmail-friendly filter commands so you can auto-archive quickly
- Is run 100% offline so your personal email data never leaves your computer

You can get an MBox of your Inbox email using Google Takeout:
https://takeout.google.com/settings/takeout

## To setup:
$ npm install

## To run
$ node inbox-swifter.js

## In action
Note that I fiddled with the output data to make it more private. So the
histogram numbers are really low, but you should get the idea.
![Screenshot](https://user-images.githubusercontent.com/184923/91682720-4dc0c980-eb07-11ea-86a1-6f39038c0cd1.png)
