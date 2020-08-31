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
![Screenshot](https://user-images.githubusercontent.com/184923/91683874-a6459600-eb0a-11ea-9881-b3409cd56415.png)
