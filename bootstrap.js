/* See license.txt for terms of usage */

// ********************************************************************************************* //
// XPCOM

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

// ********************************************************************************************* //
// Constants

// Default preferences for bootstrap extensions are registered dynamically.
var defaultPrefs =
{
    "DBG_FIREFILE": true,
}

// ********************************************************************************************* //
// Firefox Bootstrap API

function install(data, reason) {}
function uninstall(data, reason) {}
function startup(data, reason) { firebugStartup(); }
function shutdown(data, reason) { firebugShutdown(); }

// ********************************************************************************************* //
// Firebug Bootstrap API

/**
 * Executed by Firebug framework when Firebug is started. Since the order of Firebug
 * and its bootstrapped extensions is not guaranteed this function is executed twice
 * (of course the registration happens just once):
 *
 * 1) When Firebug is loaded
 * 2) When this extension is loaded
 *
 * If Firebug is not loaded an exception happens
 */
function firebugStartup()
{

    try {
        Cu.import("resource://firebug/loader.js");
        FirebugLoader.registerBootstrapScope(this);
        FirebugLoader.registerDefaultPrefs(defaultPrefs);
    }
    catch (e) {
    }
    
}


/**
 * Executed by Firefox when this extension shutdowns.
 */
function firebugShutdown()
{
    try
    {
        Cu.import("resource://firebug/loader.js");
        FirebugLoader.unregisterBootstrapScope(this);
    }
    catch (e)
    {
        Cu.reportError(e);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

/**
 * Executed by Firebug framework for every browser window. Use this function to append
 * any new elements into the browser window (browser.xul). Don't forget to remove
 * these elements in topWindowUnload.
 * 
 * @param {Window} win The browser window
 */
function topWindowLoad(win)
{   
    // Add navbar button
    var doc = win.document;
    var button = doc.createElement("toolbarbutton");
    var firebugButtonId = "firebug-button";
    var firefileButtonId = "firefile-button";
    button.setAttribute("id", firefileButtonId);
    button.setAttribute("label", "FireFile");
    button.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
    button.style.listStyleImage = "url(chrome://FireFile/skin/status_disabled.png)";
    button.setAttribute("tooltiptext", "FireFileToolTip");
    restorePosition(doc, button);
    var navBar = doc.getElementById("nav-bar");
        
    if(navBar) {
        var currentSet = navBar.getAttribute("currentset").split(",");
        var exists = currentSet.indexOf(firefileButtonId);
        var atPosition = currentSet.indexOf(firebugButtonId) + 1;
        if(exists == -1) {
            // Add button
            currentSet.push(firefileButtonId);
            navBar.setAttribute("currentset", currentSet.join(","));
            doc.persist(navBar.id, "currentset");
            win.alert("added button");
        }
    }
}

restorePosition = function(doc, button) {
  function $(sel, all)
    doc[all ? "querySelectorAll" : "getElementById"](sel);
    
  ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(button);
    
  let toolbar, currentset, idx,
      toolbars = $("toolbar", true);
  for (let i = 0; i < toolbars.length; ++i) {
    let tb = toolbars[i];
    currentset = tb.getAttribute("currentset").split(","),
    idx = currentset.indexOf(button.id);
    if (idx != -1) {
      toolbar = tb;
      break;
    }
  }
    
  // saved position not found, using the default one, if any
  if (!toolbar && (button.id in positions)) {
    let [tbID, beforeID] = positions[button.id];
    toolbar = $(tbID);
    [currentset, idx] = persist(doc, toolbar, button.id, beforeID);
  }
    
  if (toolbar) {
    if (idx != -1) {
      // inserting the button before the first item in `currentset`
      // after `idx` that is present in the document
      for (let i = idx + 1; i < currentset.length; ++i) {
        let before = $(currentset[i]);
        if (before) {
          toolbar.insertItem(button.id, before);
          return;
        }
      }
    }
    toolbar.insertItem(button.id);
  }
};

/**
 * Executed by Firebug framework when this extension
 * @param {Object} win
 */
function topWindowUnload(win)
{
    // TODO: remove global browser window overlays
}

/**
 * Entire Firebug UI is running inside an iframe (firebugFrame.xul). This function
 * is executed by Firebug framework when the frame is loaded. This happens when
 * the user requires Firebug for the first time (doesn't have to happen during the
 * Firefox session at all)
 * 
 * @param {Window} win The Firebug window
 */
function firebugFrameLoad(Firebug)
{
    
    // Register trace listener the customizes trace logs coming from this extension
    // * helloBootAMD; is unique prefix of all messages that should be customized.
    // * DBG_HELLOBOOTAMD is a class name with style defined in the specified stylesheet.
    Firebug.registerTracePrefix("fireFile;", "DBG_FIREFILE", true, "chrome://firefile/skin/skin.css");

    // The registration process will automatically look for 'main' module and load it.
    // The is the same what happens in a XUL overlay applied on:
    // chrome://firebug/content/firebugOverlay.xul
    var config = {id: "firefile@strebitzer.at"};
    Firebug.registerExtension("firefile", config);
    
}

function firebugFrameUnload(Firebug)
{
    if (!Firebug.isInitialized)
        return;

    Firebug.unregisterExtension("firefile");
    Firebug.unregisterTracePrefix("fireFile;");
}

// ********************************************************************************************* //
