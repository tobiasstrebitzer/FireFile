/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
    "firefile/firefileModule",
    "firefile/firefilePanel",
    "firefile/lib/csstransformer"
],
function(FBTrace, FirefileModule, FirefilePanel) {

    var FireFileApp = {
        
        initialize: function() {
            
            if (FBTrace.DBG_FIREFILE) {
                FBTrace.sysout("fireFile; FireFile extension initialize");
            }
            
            Firebug.registerModule(FirefileModule);
            Firebug.registerPanel(FirefilePanel);

            Firebug.registerStylesheet("chrome://firefile/skin/skin.css");
            Firebug.registerStringBundle("chrome://firefile/locale/firefile.properties");

        },

        shutdown: function() {

            if (FBTrace.DBG_FIREFILE) {
                FBTrace.sysout("fireFile; FireFile extension shutdown");
            }

            Firebug.unregisterModule(FirefileModule);
            Firebug.unregisterPanel(FirefilePanel);
            
            Firebug.unregisterStylesheet("chrome://firefile/skin/skin.css");
            Firebug.unregisterStringBundle("chrome://firefile/locale/firefile.properties");

        }
        
    }

    return FireFileApp;

});
