/* See license.txt for terms of usage */

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

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
    // var isFb = false;
    try {
        Cu.import("resource://firebug/loader.js");
        FirebugLoader.registerBootstrapScope(this);
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
    button.addEventListener("command", function() {
        // Load Firebug and set FireFile Panel
        var requireScope = {};
        Cu.import("resource://firebug/mini-require.js", requireScope);
        var require = requireScope.require;
        var config = {
            baseUrl: "resource://",
            paths: {"firebug": "chrome://firebug/content"}
        };
        require(config, [
            "firebug/lib/trace"
        ], function(FBTrace) {
            win.Firebug.browserOverlay.startFirebug(function() {
                win.Firebug.toggleBar(true);
                win.Firebug.FireFile.clickStatus();
            });
        });
    }, false);
    restorePosition(win, button);
    var navBar = doc.getElementById("nav-bar");
    if(navBar) {
        var currentSet = navBar.getAttribute("currentset").split(",");
        var exists = currentSet.indexOf(firefileButtonId);
        var atPosition = currentSet.indexOf(firebugButtonId) + 1;
        if(exists == -1) {
            currentSet.push(firefileButtonId);
            navBar.setAttribute("currentset", currentSet.join(","));
            doc.persist(navBar.id, "currentset");
        }
    }
}

function topWindowUnload(win)
{
    // nothing to do here
}

function firebugFrameLoad(Firebug)
{
    
    // Register trace prefix
    Firebug.registerTracePrefix("fireFile;", "DBG_FIREFILE", true);

    // Register firefile extension
    var config = {id: "firefile@strebitzer.at"};
    Firebug.registerExtension("firefile", config);
    
}

function firebugFrameUnload(Firebug)
{
    if (!Firebug.isInitialized) {
        return;
    }
        
    // Unregister firefile extension
    Firebug.unregisterExtension("firefile");
    Firebug.unregisterTracePrefix("fireFile;");
}

/**
 * Helper function to restore the addon- button in the toolbar
 * 
 * @param {Window} win The browser window
 * @param button The button element
 */
restorePosition = function(win, button) {
    var doc = win.document;
    var toolbar;
    var currentset;
    var idx;
    var toolbars = doc.querySelectorAll("toolbar");
    var toolbox = doc.getElementById("navigator-toolbox");
    toolbox.palette.appendChild(button);
    for (let i = 0; i < toolbars.length; ++i) {
        var tb = toolbars[i];
        currentset = tb.getAttribute("currentset").split(","),
        idx = currentset.indexOf(button.id);
        if (idx != -1) {
            toolbar = tb;
            break;
        }
    }
    
    if (!toolbar && (button.id in positions)) {
        var [tbID, beforeID] = positions[button.id];
        toolbar = doc.getElementById(tbID);
        [currentset, idx] = persist(doc, toolbar, button.id, beforeID);
    }
    
    if (toolbar) {
        if (idx != -1) {
            for (let i = idx + 1; i < currentset.length; ++i) {
                let before = doc.getElementById(currentset[i]);
                if (before) {
                    toolbar.insertItem(button.id, before);
                    return;
                }
            }
        }
        toolbar.insertItem(button.id);
    }
};