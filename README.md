## [Install FireFile from firefile.at](http://www.firefile.at)
## [Install FireFile from Mozilla Addons](https://addons.mozilla.org/de/firefox/addon/firefile/)

## FireFile Firebug Extension

Firefile is a Firebug extension that allows you to save the CSS files edited with firebug live to your web server by transfering it to a server- side script, which then handles css saving.
FireFile remembers all modifications done to a website (all modified css files) and, by clicking on the lower- right FireFile icon, allows you to bulk save or download all changes made.

## INSTALLATION

Download the latest version from github (Download- Button) in ".zip" file format, rename to ".xpi" and open with firefox

## FEATURES

* Remote saving css changes
* firefile.at webservice integration (see www.firefile.at)

## Version History

* 0.9.2 (28.12.2012)
** Fixed bug that caused firefile not to register sites if the addon bar icon was not added
** Implemented FireFile Webservice feature

* 0.9.1 (13.12.2012)
** Added compatibility for Firefox 17 (Firebug 1.11)
** Implemented AMD & bootstrapped architecture
** Fixed major issue with domplate interaction

* 0.9.0 (14.01.2012)
** Added compatibility for Firefox 9.0.1 (Firebug 1.9.0)
** Added support for all style rule types (@fontface, @media, etc)
** Improved comment display and comment saving
** Improved css beautification
** Removed feature: css3 autoconversion to other browsers (scheduled for later release)

* 0.8.8 (30.08.2011)
** Added compatibility for Firefox 6.0 (Firebug 1.8) - thanks to nightwing@github

* 0.8.7 (15.04.2011)
** Added compatibility for Firefox 4.0

* 0.8.6 (16.12.2010)
** feature: Added possibility to cancel changes in FireFile registered sites list (via "cancel" icon)
** feature: Added context menu option to cancel all changes made
** feature: Canceling changes also reloads the canceled css- files (and so resets the firebug changes)
** bugfix: !important declarations are no more ignored
** bugfix: FireFile changes get dismissed when context is destroyed (reload, close)
** meta: Updated Help Content (when no site is registered)

* 0.8.5 (15.12.2010)
** First stable release
