/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/xpcom",
    "firebug/lib/locale",
    "firefile/lib/jquery",
    "firefile/lib/csstransformer"
],
function(Obj, FBTrace, Xpcom, Locale, $, CssTransformer) {
    
	var CssSaver = {
		save: function(href) {
            try{
                if(Firebug.FireFile.styleSheetExists(href)) {
                    // Get stylesheet data
                    var index = Firebug.FireFile.styleSheetIndexByHref(href);
                    var stylesheet = Firebug.FireFile.modifiedStylesheets[index];

                    var contents = CssTransformer.generateCSSContents(Firebug.FireFile.modifiedStylesheets[index]);
					if(contents === false) {throw "Unable to create css file";}
                    var href = Firebug.FireFile.modifiedStylesheets[index].href;
                	var site = Firebug.FireFile.getHrefInAllowedSites(href);
                    this.sendFile(index, contents, href, site, function(response) {
                        
                        if(response.success) {
                            // Handle success
                            Firebug.FireFile.styleSheetStatus[href] = "done";
                            Firebug.FireFile.modifiedStylesheets.splice(index,1);
                			Firebug.FireFile.setStatus("closed");
                			Firebug.FireFile.updateNotify("fferror", 8, -1000, response.message);
                			Firebug.FireFile.updateNotify("ffnotify", 4, 1, response.message);
                        }else{
                            // Handle error
                            Firebug.FireFile.updateNotify("fferror", 8, 1, response.message);
                            Firebug.FireFile.setStatus("closed");
                            Firebug.FireFile.styleSheetStatus[href] = "error";
                        }

                        // Update UI                        
                        Firebug.FireFile.visualUpdateHandler(true);
                    });
                    
                    Firebug.FireFile.styleSheetStatus[href] = "saving";
                    // CALL REFRESHER
                    Firebug.FireFile.visualUpdateHandler();
                }
            }catch(e){
                
                // ERROR OUTPUT WHEN NOT IN REGISTERED SITES
                Firebug.FireFile.updateNotify("fferror", 8, 1, "FileErrors");
                Firebug.FireFile.setStatus("closed");
                Firebug.FireFile.styleSheetStatus[href] = "error";
                // CALL REFRESHER
                Firebug.FireFile.visualUpdateHandler();

                return false;
            }
		},
		sendFile: function(index, contents, href, site, callback) {

            var url, token;

            // Fix href
            var qpos = href.search(/\?/);
            if(qpos !== false && qpos != -1) {
                href = href.substr(0, qpos);
            }
            
            if(site === true) {
                // FireFile Server API Call
                url = "http://www.firefile.at/api/push";
                token = Firebug.getPref("extensions.firefile", "token");
            }else{
                url = site.url;
                token = site.hash;
            }

            // Set status
            Firebug.FireFile.setStatus("open");
            
            // Send request
            $.ajax({
                url: url,
                dataType: 'json',
                type: 'POST',
                data: {
                    username: Firebug.getPref("extensions.firefile", "username"),
                    file: href,
                    contents: contents,
                    token: token
                },
                success: function(response, status, jqXHR) {
                    Firebug.FireFile.addDebugInfo("Response", response);
                    callback(response);
                },
                error: function(jqXHR) {
                    Firebug.FireFile.addDebugInfo("Response", {
                        success: false, 
                        message: jqXHR.responseText
                    });
                    callback({
                        success: false,
                        message: "A server error occured!"
                    });
                }
                
            });

            Firebug.FireFile.addDebugInfo("Request", {
                token: token, 
                url: url,
                contents: contents,
                href: href
            });

            return true;

        }
	};
    
    return CssSaver;

});
